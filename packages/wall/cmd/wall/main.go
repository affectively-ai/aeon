/*
wall — curl for Aeon Flow Protocol

Named after Wally Wallington, whose rotational techniques inspired the
Aeon Flow Protocol. Where curl curls, wall rotates.

A command-line tool that speaks native Aeon Flow binary to servers,
with full support for fork/race/collapse/poison semantics.
Supports both TCP and UDP transports.

Usage:

	wall aeon://localhost:4001/api/users
	wall --udp aeon://localhost:4001/api/users
	wall --fork aeon://localhost:4001/index.html /css/app.css /js/app.js /img/hero.png
	wall --race aeon://cache:4001/data aeon://origin:4001/data
	wall --http http://localhost:8080/api/users
	wall --compare aeon://localhost:4001/api/users http://localhost:8080/api/users

Modes:

	Single request:   wall aeon://host:port/path
	Fork (parallel):  wall --fork aeon://host:port/root /path1 /path2 ...
	Race:             wall --race aeon://host1/path aeon://host2/path
	HTTP fallback:    wall --http http://host/path
	Compare:          wall --compare aeon://host/path http://host/path

Transport:

	--udp   Use UDP datagrams instead of TCP. Each frame is one datagram.
	        The 10-byte header contains stream_id + sequence, so frames
	        can arrive out of order and be reassembled. Ideal for
	        latency-sensitive workloads where retransmission is wasteful.

Output:

	By default, prints the response body to stdout (like curl).
	Use -v for verbose output with frame-by-frame timing.
	Use --waterfall for a visual waterfall diagram.
	Use --json for machine-readable JSON output.
*/
package main

import (
	"encoding/binary"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// ═══════════════════════════════════════════════════════════════════════════════
// Aeon Flow Protocol Constants and Types
// ═══════════════════════════════════════════════════════════════════════════════

const (
	HeaderSize    = 10
	MaxPayload    = 0xFFFFFF
	FlagFork      = 0x01
	FlagRace      = 0x02
	FlagCollapse  = 0x04
	FlagPoison    = 0x08
	FlagFIN       = 0x10
)

// Frame is a single Aeon Flow protocol frame.
type Frame struct {
	StreamID uint16
	Sequence uint32
	Flags    uint8
	Length   uint32
	Payload  []byte
}

// FrameEvent records a frame with timing information.
type FrameEvent struct {
	Frame    Frame
	Time     time.Time
	Elapsed  time.Duration
	Direction string // "send" or "recv"
}

// ═══════════════════════════════════════════════════════════════════════════════
// Codec
// ═══════════════════════════════════════════════════════════════════════════════

// EncodeFrame encodes a frame into a byte slice.
func EncodeFrame(f Frame) []byte {
	buf := make([]byte, HeaderSize+int(f.Length))
	binary.BigEndian.PutUint16(buf[0:2], f.StreamID)
	binary.BigEndian.PutUint32(buf[2:6], f.Sequence)
	buf[6] = f.Flags
	buf[7] = byte((f.Length >> 16) & 0xFF)
	buf[8] = byte((f.Length >> 8) & 0xFF)
	buf[9] = byte(f.Length & 0xFF)
	if f.Length > 0 && f.Payload != nil {
		copy(buf[HeaderSize:], f.Payload)
	}
	return buf
}

// DecodeFrame decodes a frame from a byte slice.
// Returns the frame and the number of bytes consumed.
func DecodeFrame(buf []byte) (Frame, int, error) {
	if len(buf) < HeaderSize {
		return Frame{}, 0, fmt.Errorf("buffer too short for header: %d < %d", len(buf), HeaderSize)
	}

	var f Frame
	f.StreamID = binary.BigEndian.Uint16(buf[0:2])
	f.Sequence = binary.BigEndian.Uint32(buf[2:6])
	f.Flags = buf[6]
	f.Length = uint32(buf[7])<<16 | uint32(buf[8])<<8 | uint32(buf[9])

	total := HeaderSize + int(f.Length)
	if len(buf) < total {
		return Frame{}, 0, fmt.Errorf("buffer too short for payload: %d < %d", len(buf), total)
	}

	if f.Length > 0 {
		f.Payload = buf[HeaderSize:total]
	}

	return f, total, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// Connection
// ═══════════════════════════════════════════════════════════════════════════════

// AeonConn wraps a TCP or UDP connection to an Aeon Flow server.
type AeonConn struct {
	conn         net.Conn
	udp          bool
	nextStreamID uint16
	events       []FrameEvent
	startTime    time.Time
	verbose      bool
}

// Dial connects to an Aeon Flow server over TCP.
func Dial(addr string) (*AeonConn, error) {
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("connect %s: %w", addr, err)
	}
	return &AeonConn{
		conn:         conn,
		nextStreamID: 0,
		startTime:    time.Now(),
	}, nil
}

// DialUDP connects to an Aeon Flow server over UDP.
// Each frame is sent as a single UDP datagram.
// The 10-byte header's stream_id + sequence fields enable
// out-of-order reassembly without TCP's head-of-line blocking.
func DialUDP(addr string) (*AeonConn, error) {
	udpAddr, err := net.ResolveUDPAddr("udp", addr)
	if err != nil {
		return nil, fmt.Errorf("resolve %s: %w", addr, err)
	}
	conn, err := net.DialUDP("udp", nil, udpAddr)
	if err != nil {
		return nil, fmt.Errorf("connect udp %s: %w", addr, err)
	}
	return &AeonConn{
		conn:         conn,
		udp:          true,
		nextStreamID: 0,
		startTime:    time.Now(),
	}, nil
}

// Close closes the connection.
func (c *AeonConn) Close() error {
	return c.conn.Close()
}

// AllocStream allocates the next stream ID (even = client-initiated).
func (c *AeonConn) AllocStream() uint16 {
	id := c.nextStreamID
	c.nextStreamID += 2
	return id
}

// Send sends a frame on the connection.
func (c *AeonConn) Send(f Frame) error {
	buf := EncodeFrame(f)
	_, err := c.conn.Write(buf)
	if err != nil {
		return err
	}

	c.events = append(c.events, FrameEvent{
		Frame:     f,
		Time:      time.Now(),
		Elapsed:   time.Since(c.startTime),
		Direction: "send",
	})

	if c.verbose {
		fmt.Fprintf(os.Stderr, "> stream=%d seq=%d flags=0x%02x len=%d (%s)\n",
			f.StreamID, f.Sequence, f.Flags, f.Length, flagNames(f.Flags))
	}

	return nil
}

// Recv reads the next frame from the connection.
func (c *AeonConn) Recv() (Frame, error) {
	header := make([]byte, HeaderSize)
	if _, err := io.ReadFull(c.conn, header); err != nil {
		return Frame{}, err
	}

	f, _, err := DecodeFrame(header)
	if err != nil {
		return Frame{}, err
	}

	if f.Length > 0 {
		payload := make([]byte, f.Length)
		if _, err := io.ReadFull(c.conn, payload); err != nil {
			return Frame{}, err
		}
		f.Payload = payload
	}

	c.events = append(c.events, FrameEvent{
		Frame:     f,
		Time:      time.Now(),
		Elapsed:   time.Since(c.startTime),
		Direction: "recv",
	})

	if c.verbose {
		fmt.Fprintf(os.Stderr, "< stream=%d seq=%d flags=0x%02x len=%d (%s)\n",
			f.StreamID, f.Sequence, f.Flags, f.Length, flagNames(f.Flags))
	}

	return f, nil
}

// SendRequest sends an HTTP-style request as a DATA frame.
func (c *AeonConn) SendRequest(streamID uint16, method, path string, headers map[string]string) error {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%s %s HTTP/1.1\r\n", method, path))
	for k, v := range headers {
		sb.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	sb.WriteString("\r\n")

	payload := []byte(sb.String())

	// Send DATA frame with the request
	err := c.Send(Frame{
		StreamID: streamID,
		Sequence: 0,
		Flags:    0,
		Length:   uint32(len(payload)),
		Payload:  payload,
	})
	if err != nil {
		return err
	}

	// Send FIN to indicate end of request
	return c.Send(Frame{
		StreamID: streamID,
		Sequence: 1,
		Flags:    FlagFIN,
		Length:   0,
	})
}

// Fork sends a FORK frame to open multiple child streams.
func (c *AeonConn) Fork(parentID uint16, count int) ([]uint16, error) {
	children := make([]uint16, count)
	payload := make([]byte, count*2)

	for i := 0; i < count; i++ {
		children[i] = c.AllocStream()
		binary.BigEndian.PutUint16(payload[i*2:i*2+2], children[i])
	}

	err := c.Send(Frame{
		StreamID: parentID,
		Sequence: 0,
		Flags:    FlagFork,
		Length:   uint32(len(payload)),
		Payload:  payload,
	})

	return children, err
}

// Poison sends a POISON frame on a stream.
func (c *AeonConn) Poison(streamID uint16, seq uint32) error {
	return c.Send(Frame{
		StreamID: streamID,
		Sequence: seq,
		Flags:    FlagPoison,
		Length:   0,
	})
}

// ═══════════════════════════════════════════════════════════════════════════════
// Request Modes
// ═══════════════════════════════════════════════════════════════════════════════

// doSingleRequest performs a single Aeon Flow request.
func doSingleRequest(addr, path string, headers map[string]string, verbose bool, udp ...bool) ([]byte, []FrameEvent, error) {
	var conn *AeonConn
	var err error
	if len(udp) > 0 && udp[0] {
		conn, err = DialUDP(addr)
	} else {
		conn, err = Dial(addr)
	}
	if err != nil {
		return nil, nil, err
	}
	defer conn.Close()
	conn.verbose = verbose

	streamID := conn.AllocStream()

	if err := conn.SendRequest(streamID, "GET", path, headers); err != nil {
		return nil, nil, fmt.Errorf("send request: %w", err)
	}

	// Read response frames until FIN or POISON
	var body []byte
	for {
		f, err := conn.Recv()
		if err != nil {
			if err == io.EOF {
				break
			}
			return nil, conn.events, fmt.Errorf("recv: %w", err)
		}

		if f.Flags&FlagPOISON != 0 {
			return nil, conn.events, fmt.Errorf("stream %d poisoned by server", f.StreamID)
		}

		if f.Flags&FlagFIN != 0 {
			break
		}

		if f.Length > 0 {
			body = append(body, f.Payload...)
		}
	}

	return body, conn.events, nil
}

// doForkRequest performs a FORK request with multiple child paths.
func doForkRequest(addr, rootPath string, childPaths []string, headers map[string]string, verbose bool) (map[string][]byte, []FrameEvent, error) {
	conn, err := Dial(addr)
	if err != nil {
		return nil, nil, err
	}
	defer conn.Close()
	conn.verbose = verbose

	rootStream := conn.AllocStream()

	// Fork child streams
	children, err := conn.Fork(rootStream, len(childPaths))
	if err != nil {
		return nil, conn.events, fmt.Errorf("fork: %w", err)
	}

	// Map stream IDs to paths for output
	streamPaths := make(map[uint16]string)
	for i, path := range childPaths {
		streamPaths[children[i]] = path
	}

	// Send request on each child stream
	for i, path := range childPaths {
		if err := conn.SendRequest(children[i], "GET", path, headers); err != nil {
			return nil, conn.events, fmt.Errorf("send child %d: %w", i, err)
		}
	}

	// Read responses until all children finish
	results := make(map[string][]byte)
	bodies := make(map[uint16][]byte)
	finished := 0

	for finished < len(children) {
		f, err := conn.Recv()
		if err != nil {
			if err == io.EOF {
				break
			}
			return results, conn.events, fmt.Errorf("recv: %w", err)
		}

		if f.Flags&FlagPOISON != 0 {
			path := streamPaths[f.StreamID]
			if verbose {
				fmt.Fprintf(os.Stderr, "! stream %d (%s) poisoned\n", f.StreamID, path)
			}
			finished++
			continue
		}

		if f.Flags&FlagFIN != 0 {
			path := streamPaths[f.StreamID]
			results[path] = bodies[f.StreamID]
			finished++
			continue
		}

		if f.Length > 0 {
			bodies[f.StreamID] = append(bodies[f.StreamID], f.Payload...)
		}
	}

	return results, conn.events, nil
}

// doHTTPRequest performs a standard HTTP request (for comparison).
func doHTTPRequest(rawURL string, verbose bool) ([]byte, time.Duration, error) {
	start := time.Now()

	resp, err := http.Get(rawURL)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	elapsed := time.Since(start)

	if verbose {
		fmt.Fprintf(os.Stderr, "HTTP %d %s (%d bytes, %s)\n",
			resp.StatusCode, resp.Status, len(body), elapsed)
	}

	return body, elapsed, err
}

// ═══════════════════════════════════════════════════════════════════════════════
// Output Formatting
// ═══════════════════════════════════════════════════════════════════════════════

func flagNames(flags uint8) string {
	var parts []string
	if flags&FlagFork != 0 {
		parts = append(parts, "FORK")
	}
	if flags&FlagRace != 0 {
		parts = append(parts, "RACE")
	}
	if flags&FlagCollapse != 0 {
		parts = append(parts, "COLLAPSE")
	}
	if flags&FlagPoison != 0 {
		parts = append(parts, "POISON")
	}
	if flags&FlagFIN != 0 {
		parts = append(parts, "FIN")
	}
	if flags == 0 {
		parts = append(parts, "DATA")
	}
	return strings.Join(parts, "|")
}

const FlagPOISON = FlagPoison // alias for readability

func printWaterfall(events []FrameEvent) {
	if len(events) == 0 {
		return
	}

	start := events[0].Time

	fmt.Fprintf(os.Stderr, "\n─── Waterfall ───────────────────────────────────────────\n")
	fmt.Fprintf(os.Stderr, "%-6s %-4s %-8s %-3s %-8s %-6s %s\n",
		"Time", "Dir", "Stream", "Seq", "Flags", "Bytes", "")

	for _, e := range events {
		elapsed := e.Time.Sub(start)
		dir := ">>>"
		if e.Direction == "recv" {
			dir = "<<<"
		}

		fmt.Fprintf(os.Stderr, "%5.1fms %-4s %-8d %-3d %-8s %-6d",
			float64(elapsed.Microseconds())/1000.0,
			dir,
			e.Frame.StreamID,
			e.Frame.Sequence,
			flagNames(e.Frame.Flags),
			e.Frame.Length)

		// Visual bar
		barLen := int(float64(elapsed.Microseconds()) / 1000.0)
		if barLen > 60 {
			barLen = 60
		}
		fmt.Fprintf(os.Stderr, " %s█\n", strings.Repeat("░", barLen))
	}

	fmt.Fprintf(os.Stderr, "─────────────────────────────────────────────────────────\n")

	totalBytes := 0
	totalFrames := 0
	for _, e := range events {
		if e.Direction == "recv" && e.Frame.Length > 0 {
			totalBytes += int(e.Frame.Length)
		}
		totalFrames++
	}

	totalElapsed := events[len(events)-1].Time.Sub(start)
	fmt.Fprintf(os.Stderr, "%d frames, %d bytes received, %s total\n\n",
		totalFrames, totalBytes, totalElapsed)
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP-Flow Mode (Aeon Web Gateway)
// ═══════════════════════════════════════════════════════════════════════════════

// doHTTPFlowRequest fetches Aeon Flow frames from an HTTP endpoint.
// Used with the Aeon Web Gateway: the response body contains raw
// Flow frames that wall decodes and renders just like native TCP/UDP.
//
// Usage:
//
//	wall --http-flow --auth ew_xxx https://gateway.edgework.ai/?origin=https://example.com
//	wall --http-flow -v --waterfall --auth ew_xxx https://gateway.edgework.ai/?origin=https://google.com
func doHTTPFlowRequest(rawURL string, extraHeaders map[string]string, verbose bool) ([]byte, []FrameEvent, error) {
	start := time.Now()

	req, err := http.NewRequest("GET", rawURL, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("create request: %w", err)
	}

	// Request native Aeon Flow frames
	req.Header.Set("Accept", "application/x-aeon-flow")
	req.Header.Set("X-Aeon-Mode", "fork")

	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if verbose {
		fmt.Fprintf(os.Stderr, "HTTP %d %s\n", resp.StatusCode, resp.Status)
		fmt.Fprintf(os.Stderr, "Content-Type: %s\n", resp.Header.Get("Content-Type"))
		for _, h := range []string{
			"x-aeon-gateway", "x-aeon-mode", "x-aeon-origin",
			"x-aeon-streams", "x-aeon-frames", "x-aeon-wire-bytes",
			"x-aeon-resources-fetched", "x-aeon-cache",
			"x-aeon-cache-freshness", "x-aeon-transport",
			"x-aeon-udp-datagrams",
		} {
			if v := resp.Header.Get(h); v != "" {
				fmt.Fprintf(os.Stderr, "%s: %s\n", h, v)
			}
		}
		fmt.Fprintf(os.Stderr, "\n")
	}

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("read body: %w", err)
	}
	httpElapsed := time.Since(start)

	if resp.StatusCode != 200 {
		return rawBody, nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(rawBody))
	}

	// Check if response is UDP datagrams
	ct := resp.Header.Get("Content-Type")
	isUDP := ct == "application/x-aeon-udp"

	var events []FrameEvent
	var assembledBody []byte
	streamBodies := make(map[uint16][]byte)

	if isUDP {
		// Decode UDP datagrams → extract flow frames
		offset := 0
		for offset+4+HeaderSize <= len(rawBody) {
			magic := rawBody[offset]
			if magic != 0xAE {
				break
			}
			// Skip 4-byte UDP header
			frameStart := offset + 4
			f, n, err := DecodeFrame(rawBody[frameStart:])
			if err != nil {
				break
			}

			events = append(events, FrameEvent{
				Frame:     f,
				Time:      start.Add(httpElapsed), // approximate
				Elapsed:   httpElapsed,
				Direction: "recv",
			})

			if f.Flags&FlagFIN == 0 && f.Flags&FlagFork == 0 && f.Length > 0 {
				streamBodies[f.StreamID] = append(streamBodies[f.StreamID], f.Payload...)
			}

			if verbose {
				fmt.Fprintf(os.Stderr, "< [udp] stream=%d seq=%d flags=0x%02x len=%d (%s)\n",
					f.StreamID, f.Sequence, f.Flags, f.Length, flagNames(f.Flags))
			}

			offset = frameStart + n
		}
	} else {
		// Decode raw flow frames from HTTP body
		offset := 0
		for offset+HeaderSize <= len(rawBody) {
			f, n, err := DecodeFrame(rawBody[offset:])
			if err != nil {
				break
			}

			events = append(events, FrameEvent{
				Frame:     f,
				Time:      start.Add(httpElapsed),
				Elapsed:   httpElapsed,
				Direction: "recv",
			})

			if f.Flags&FlagFIN == 0 && f.Flags&FlagFork == 0 && f.Length > 0 {
				streamBodies[f.StreamID] = append(streamBodies[f.StreamID], f.Payload...)
			}

			if verbose {
				fmt.Fprintf(os.Stderr, "< stream=%d seq=%d flags=0x%02x len=%d (%s)\n",
					f.StreamID, f.Sequence, f.Flags, f.Length, flagNames(f.Flags))
			}

			offset += n
		}
	}

	// Assemble response: prefer stream 2 (FORK HTML), fallback to stream 0
	if body, ok := streamBodies[2]; ok {
		assembledBody = body
	} else if body, ok := streamBodies[0]; ok {
		assembledBody = body
	}

	if verbose {
		fmt.Fprintf(os.Stderr, "\n%d frames, %d bytes payload, %d bytes wire, %s\n",
			len(events), len(assembledBody), len(rawBody), httpElapsed)
		fmt.Fprintf(os.Stderr, "streams: ")
		seen := make(map[uint16]bool)
		for _, e := range events {
			if !seen[e.Frame.StreamID] {
				fmt.Fprintf(os.Stderr, "%d ", e.Frame.StreamID)
				seen[e.Frame.StreamID] = true
			}
		}
		fmt.Fprintf(os.Stderr, "\n")
	}

	return assembledBody, events, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

func main() {
	verbose := flag.Bool("v", false, "verbose output with frame-by-frame details")
	waterfall := flag.Bool("waterfall", false, "show visual waterfall diagram")
	forkMode := flag.Bool("fork", false, "fork mode: first URL is root, remaining are child paths")
	raceMode := flag.Bool("race", false, "race mode: send to multiple servers, first response wins")
	httpMode := flag.Bool("http", false, "use HTTP instead of Aeon Flow")
	httpFlowMode := flag.Bool("http-flow", false, "fetch Flow frames over HTTP (for Aeon Web Gateway)")
	compareMode := flag.Bool("compare", false, "compare Aeon Flow vs HTTP side by side")
	udpMode := flag.Bool("udp", false, "use UDP datagrams instead of TCP (each frame = one datagram)")
	header := flag.String("H", "", "add header (format: 'Key: Value')")
	authToken := flag.String("auth", "", "Bearer token for Authorization header (ew_ API key or UCAN)")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "wall — curl for Aeon Flow Protocol\n\n")
		fmt.Fprintf(os.Stderr, "Usage:\n")
		fmt.Fprintf(os.Stderr, "  wall [flags] <url> [additional paths...]\n\n")
		fmt.Fprintf(os.Stderr, "Examples:\n")
		fmt.Fprintf(os.Stderr, "  wall aeon://localhost:4001/api/users\n")
		fmt.Fprintf(os.Stderr, "  wall --fork aeon://localhost:4001/ /css/app.css /js/app.js\n")
		fmt.Fprintf(os.Stderr, "  wall --compare aeon://localhost:4001/data http://localhost:8080/data\n")
		fmt.Fprintf(os.Stderr, "  wall -v --waterfall aeon://localhost:4001/api/users\n")
		fmt.Fprintf(os.Stderr, "  wall --http-flow --auth ew_xxx https://gateway.edgework.ai/?origin=https://example.com\n\n")
		fmt.Fprintf(os.Stderr, "Flags:\n")
		flag.PrintDefaults()
	}

	flag.Parse()
	args := flag.Args()

	if len(args) < 1 {
		flag.Usage()
		os.Exit(1)
	}

	// Parse headers
	headers := make(map[string]string)
	if *header != "" {
		parts := strings.SplitN(*header, ":", 2)
		if len(parts) == 2 {
			headers[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}
	if *authToken != "" {
		headers["Authorization"] = "Bearer " + *authToken
	}

	// ─── HTTP-Flow mode (Aeon Web Gateway) ──────────────────────────────
	if *httpFlowMode {
		body, events, err := doHTTPFlowRequest(args[0], headers, *verbose)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		os.Stdout.Write(body)
		if *waterfall {
			printWaterfall(events)
		}
		return
	}

	// ─── HTTP mode ──────────────────────────────────────────────────────
	if *httpMode {
		body, elapsed, err := doHTTPRequest(args[0], *verbose)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}
		os.Stdout.Write(body)
		if *verbose {
			fmt.Fprintf(os.Stderr, "\n%d bytes in %s\n", len(body), elapsed)
		}
		return
	}

	// ─── Compare mode ───────────────────────────────────────────────────
	if *compareMode {
		if len(args) < 2 {
			fmt.Fprintf(os.Stderr, "compare mode requires two URLs: aeon://... http://...\n")
			os.Exit(1)
		}

		u, err := url.Parse(args[0])
		if err != nil {
			fmt.Fprintf(os.Stderr, "invalid aeon URL: %v\n", err)
			os.Exit(1)
		}

		fmt.Fprintf(os.Stderr, "─── Aeon Flow ──────────────────────────────────────\n")
		aeonStart := time.Now()
		aeonBody, aeonEvents, err := doSingleRequest(u.Host, u.Path, headers, *verbose)
		aeonElapsed := time.Since(aeonStart)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Aeon Flow error: %v\n", err)
		}

		fmt.Fprintf(os.Stderr, "─── HTTP ───────────────────────────────────────────\n")
		httpBody, httpElapsed, err := doHTTPRequest(args[1], *verbose)
		if err != nil {
			fmt.Fprintf(os.Stderr, "HTTP error: %v\n", err)
		}

		fmt.Fprintf(os.Stderr, "\n─── Comparison ─────────────────────────────────────\n")
		fmt.Fprintf(os.Stderr, "%-15s %12s %12s\n", "", "Aeon Flow", "HTTP")
		fmt.Fprintf(os.Stderr, "%-15s %12d %12d\n", "Body bytes", len(aeonBody), len(httpBody))
		fmt.Fprintf(os.Stderr, "%-15s %12s %12s\n", "Total time", aeonElapsed.Round(time.Microsecond), httpElapsed.Round(time.Microsecond))

		aeonFrames := 0
		aeonOverhead := 0
		for range aeonEvents {
			aeonFrames++
			aeonOverhead += HeaderSize
		}
		fmt.Fprintf(os.Stderr, "%-15s %12d %12s\n", "Frames", aeonFrames, "N/A")
		fmt.Fprintf(os.Stderr, "%-15s %12d %12s\n", "Framing bytes", aeonOverhead, "~300-600")

		if aeonElapsed < httpElapsed {
			speedup := float64(httpElapsed) / float64(aeonElapsed)
			fmt.Fprintf(os.Stderr, "\nAeon Flow: %.1fx faster\n", speedup)
		} else {
			speedup := float64(aeonElapsed) / float64(httpElapsed)
			fmt.Fprintf(os.Stderr, "\nHTTP: %.1fx faster\n", speedup)
		}

		if *waterfall {
			printWaterfall(aeonEvents)
		}
		return
	}

	// ─── Parse Aeon Flow URL ────────────────────────────────────────────
	u, err := url.Parse(args[0])
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid URL: %v\n", err)
		os.Exit(1)
	}

	if u.Scheme != "aeon" {
		fmt.Fprintf(os.Stderr, "expected aeon:// URL scheme, got %s://\n", u.Scheme)
		os.Exit(1)
	}

	addr := u.Host
	if !strings.Contains(addr, ":") {
		addr += ":4001" // default Aeon Flow port
	}

	// ─── Fork mode ──────────────────────────────────────────────────────
	if *forkMode {
		childPaths := args[1:]
		if len(childPaths) == 0 {
			fmt.Fprintf(os.Stderr, "fork mode requires additional paths after the root URL\n")
			os.Exit(1)
		}

		results, events, err := doForkRequest(addr, u.Path, childPaths, headers, *verbose)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
			os.Exit(1)
		}

		for path, body := range results {
			if *verbose {
				fmt.Fprintf(os.Stderr, "─── %s (%d bytes) ───\n", path, len(body))
			}
			os.Stdout.Write(body)
		}

		if *waterfall {
			printWaterfall(events)
		}
		return
	}

	// ─── Race mode ──────────────────────────────────────────────────────
	if *raceMode {
		if len(args) < 2 {
			fmt.Fprintf(os.Stderr, "race mode requires at least two URLs\n")
			os.Exit(1)
		}

		type raceResult struct {
			body    []byte
			events  []FrameEvent
			err     error
			idx     int
		}

		results := make(chan raceResult, len(args))

		for i, rawURL := range args {
			go func(idx int, rawURL string) {
				ru, err := url.Parse(rawURL)
				if err != nil {
					results <- raceResult{err: err, idx: idx}
					return
				}

				rAddr := ru.Host
				if !strings.Contains(rAddr, ":") {
					rAddr += ":4001"
				}

				body, events, err := doSingleRequest(rAddr, ru.Path, headers, *verbose)
				results <- raceResult{body: body, events: events, err: err, idx: idx}
			}(i, rawURL)
		}

		// First result wins
		winner := <-results
		if winner.err != nil {
			fmt.Fprintf(os.Stderr, "winner error: %v\n", winner.err)
			os.Exit(1)
		}

		os.Stdout.Write(winner.body)
		if *verbose {
			fmt.Fprintf(os.Stderr, "\nRace winner: %s (%d bytes)\n", args[winner.idx], len(winner.body))
		}
		if *waterfall {
			printWaterfall(winner.events)
		}
		return
	}

	// ─── Single request mode ────────────────────────────────────────────
	body, events, err := doSingleRequest(addr, u.Path, headers, *verbose, *udpMode)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	os.Stdout.Write(body)

	if *waterfall {
		printWaterfall(events)
	}
}
