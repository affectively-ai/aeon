# Chapter 15: The Shootoff  --  Aeon Flow vs HTTP/1.1 vs HTTP/2 vs HTTP/3

> *"The longer the lever, the less effort required."*  --  Wallington's First Law

## The Question

Chapter 14 introduced the Aeon Flow Protocol with a 10-byte fixed header and fork/race/collapse semantics. The theoretical advantage is clear: fewer bytes on the wire, fewer round trips, no per-request headers. But how much does it actually matter?

To find out, we built a shootoff  --  a head-to-head benchmark that serves the same sites through all four protocols with the same compression, measuring real numbers. HTTP/3 is the toughest competitor: it runs on QUIC (1 RTT handshake, no TCP head-of-line blocking), uses QPACK (larger static table than HPACK), and variable-length frame headers (2-3 bytes vs HTTP/2's fixed 9). If anything was going to close the gap, HTTP/3 was it.

## Two Sites, Two Extremes

We needed sites that stress different aspects of the protocol:

### Whip Worthington's Flaxseed Empire (Big Content)

A content-heavy blog from the heir to the Worthington Flaxseed dynasty. The kind of site where someone turned down Silicon Valley to run an omega-3 extraction lab. Some inherit oil, some inherit tech  --  Whip inherited flax.

- **12 resources, ~2.2 MB total**
- Big JS bundles (750 KB + 420 KB)
- Hero image (280 KB) + article images
- CSS (185 KB), web fonts, manifest
- Sequential dependency chain

This is the "big stone" test: few moves, each one heavy. Like moving a 20-ton slab across a field. The protocol overhead is tiny relative to the payloads.

### The Wally Wallington Wonder Archive (Microfrontend)

An interactive archive celebrating Wally Wallington's engineering  --  the Dynamic Offset Pivot, the Multi-Stage Cribbing Jack, the Sand-Box Descent. Built as a modern SPA with aggressive code-splitting.

- **95 resources, ~618 KB total**
- 45 JS modules (900 bytes to 45 KB each)
- 16 CSS modules (800 bytes to 8.5 KB)
- 20 SVG icons (180-520 bytes each)
- Entry, framework, vendor, route, component, utility chunks

This is the "cribbing jack" test: many tiny moves, one inch at a time. The protocol overhead dominates when payloads are small.

## The Protocol Models

### HTTP/1.1

Realistic request/response headers per resource:

- **Request:** ~280-350 bytes (method, path, host, accept, accept-encoding, user-agent, connection, sec-fetch-*, etc.)
- **Response:** ~250-320 bytes (status, content-type, content-length, content-encoding, cache-control, etag, HSTS, vary, date, server, connection)
- **Multiplexing:** 6 parallel connections (browser limit)
- **Round trips:** ceil(resources / 6) + 1 TLS handshake

### HTTP/2

HPACK-compressed headers with dynamic table:

- **First request:** ~80-100 bytes (method/scheme/authority indexed, path Huffman-encoded, accept/user-agent full)
- **Subsequent requests:** ~15-25 bytes (most headers indexed from dynamic table, only path varies)
- **Frame overhead:** 9-byte frame header per DATA frame, per HEADERS frame
- **Multiplexing:** 100 concurrent streams on 1 connection
- **Round trips:** 2 (TCP+TLS + one multiplexed flight)

### HTTP/3 (RFC 9114)

QUIC transport with QPACK header compression:

- **QPACK:** 99-entry static table (vs HPACK's 61), 2-byte prefix per header block, Huffman encoding
- **First request:** ~72-80 bytes (more static table hits than HPACK)
- **Subsequent requests:** ~13-20 bytes (aggressive dynamic table reuse)
- **Frame overhead:** Variable-length frame headers  --  typically 2-3 bytes (type + varint length) vs HTTP/2's fixed 9 bytes
- **Transport:** QUIC combines crypto + transport handshake in 1 RTT (vs TCP+TLS = 2). 0-RTT with session resumption.
- **Multiplexing:** 100 concurrent streams, per-stream independence (no TCP head-of-line blocking)
- **Round trips:** 1 (QUIC 1-RTT handshake + multiplexed streams)

HTTP/3 is the state of the art. QUIC eliminates TCP's head-of-line blocking, variable-length integers shrink frame headers from 9 bytes to 2-3, and the bigger static table compresses common headers more aggressively. It's the best HTTP has ever been.

### Aeon Flow

The real FlowCodec, encoding actual frames:

- **DATA frame:** 10-byte header + payload
- **FIN frame:** 10 bytes (0 payload)
- **FORK frame:** 10 bytes + 2 bytes per child stream ID (amortized across all children)
- **No per-request headers.** The stream ID *is* the request context.
- **Multiplexing:** 256 concurrent streams, all opened with one FORK frame
- **Round trips:** 1 (connect, then server pushes everything)

## Results

### Big Content Site  --  Whip Worthington (12 resources)

```
Protocol      Compress  Wire        Overhead    Ovhd %    RTTs  Savings
─────────────────────────────────────────────────────────────────────────
HTTP/1.1      none      2.23 MB     7.9 KB      0.35%     3     0.0%
HTTP/1.1      gzip      920 KB      8.2 KB      0.89%     3     59.7%
HTTP/1.1      brotli    913 KB      8.2 KB      0.89%     3     60.0%
HTTP/2        none      2.22 MB     2.3 KB      0.10%     2     0.2%
HTTP/2        gzip      914 KB      1.6 KB      0.18%     2     60.0%
HTTP/2        brotli    907 KB      1.6 KB      0.18%     2     60.2%
HTTP/3        none      2.22 MB     889 B       0.04%     1     0.3%
HTTP/3        gzip      913 KB      906 B       0.10%     1     60.0%
HTTP/3        brotli    906 KB      906 B       0.10%     1     60.3%
Aeon Flow     none      2.22 MB     276 B       0.01%     1     0.3%
Aeon Flow     gzip      912 KB      276 B       0.03%     1     60.0%
Aeon Flow     brotli    905 KB      276 B       0.03%     1     60.3%
```

**Analysis:** For big resources, compression dominates. All four protocols get ~60% savings with brotli. The framing overhead difference is real but small in absolute terms:

| Protocol | Framing Overhead | RTTs |
|----------|-----------------|------|
| HTTP/1.1 | 8.2 KB | 3 |
| HTTP/2 | 1.6 KB | 2 |
| HTTP/3 | 906 B | 1 |
| Aeon Flow | 276 B | 1 |

HTTP/3 closes the gap significantly  --  variable-length frame headers (2-3 bytes vs HTTP/2's fixed 9) and QPACK's larger static table cut framing nearly in half vs HTTP/2. And QUIC's 1-RTT handshake matches Aeon Flow's round trip count.

But Aeon Flow still uses **3.3x less framing** than HTTP/3. No per-request headers, no QPACK encoding/decoding, no HEADERS frames at all. The stream ID *is* the request. At 276 bytes vs 906 bytes on a 905 KB total, it's 0.03 percent vs 0.10 percent  --  both negligible for big content.

The real story for big content: HTTP/3 and Aeon Flow both win on round trips (1 RTT). HTTP/1.1 needs 3 RTTs, HTTP/2 needs 2. On a 100ms RTT, that's 300ms vs 200ms vs 100ms vs 100ms.

### Microfrontend  --  Wally Wallington (95 resources)

```
Protocol      Compress  Wire        Overhead    Ovhd %    RTTs  Savings
─────────────────────────────────────────────────────────────────────────
HTTP/1.1      none      674 KB      56.3 KB     8.36 percent     16    0.0 percent
HTTP/1.1      gzip      194 KB      58.3 KB     30.00 percent    16    71.2 percent
HTTP/1.1      brotli    187 KB      58.1 KB     31.00 percent    16    72.2 percent
HTTP/2        none      625 KB      7.9 KB      1.26 percent     2     7.2 percent
HTTP/2        gzip      144 KB      8.0 KB      5.53 percent     2     78.6 percent
HTTP/2        brotli    137 KB      8.0 KB      5.80 percent     2     79.6 percent
HTTP/3        none      623 KB      5.7 KB      0.92 percent     1     7.5 percent
HTTP/3        gzip      142 KB      5.9 KB      4.15 percent     1     78.9 percent
HTTP/3        brotli    135 KB      5.9 KB      4.36 percent     1     79.9 percent
Aeon Flow     none      619 KB      1.9 KB      0.31 percent     1     8.1 percent
Aeon Flow     gzip      138 KB      1.9 KB      1.40 percent     1     79.5 percent
Aeon Flow     brotli    131 KB      1.9 KB      1.47 percent     1     80.5 percent
```

**This is the Wallington Rotation in protocol form.**

HTTP/1.1 with brotli spends **31 percent of its total wire bytes on headers.** Nearly a third of the bandwidth goes to `Accept-Language: en-US,en;q=0.9` and `User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X...` repeated 95 times. The headers are larger than many of the actual payloads.

HTTP/2's HPACK brings that down to 5.8 percent, but it's still 8 KB of framing for payloads that total 129 KB.

HTTP/3's QPACK + variable-length frames bring it to 4.36 percent  --  a 25 percent improvement over HTTP/2. The bigger static table (99 entries vs 61) compresses common headers more aggressively, and the variable-length frame headers (2-3 bytes) are 3-4x smaller than HTTP/2's fixed 9-byte headers. QUIC also matches Aeon Flow on round trips: 1 RTT.

But HTTP/3 still carries per-request semantics. Every one of those 95 resources needs a HEADERS frame with QPACK-encoded method, path, scheme, authority. Even compressed, that's 5.9 KB of framing.

Aeon Flow: **1.47 percent.** 1.9 KB of framing. One FORK frame opens all 95 streams. Each resource is a single DATA frame (10 bytes) + FIN (10 bytes). That's 20 bytes per resource + a shared 200-byte FORK frame. **3x less framing than HTTP/3.**

And the round trips: HTTP/1.1 with 95 resources across 6 connections needs **16 round trips.** On a 100ms RTT, that's 1.6 seconds of pure latency before the first byte of the last resource. HTTP/3 and Aeon Flow: 1 RTT. 100ms. Done.

## The Wallington Mapping

| Wallington Principle | HTTP/1.1 | HTTP/2 | HTTP/3 | Aeon Flow |
|---------------------|----------|--------|--------|-----------|
| **Force Multiplication** (lever length) | 6 connections  --  short lever | 100 streams  --  longer lever | 100 streams, no HOL blocking  --  even longer | 256 streams + server push  --  longest lever |
| **Friction Reduction** (contact point) | ~600 bytes per request/response cycle | ~40 bytes HPACK-compressed | ~25 bytes QPACK + 2-3 byte frame headers | 20 bytes (DATA+FIN)  --  smallest pivot |
| **Gravity Harvest** (use weight as battery) | None  --  client must discover and request each resource | Server Push (deprecated) | None  --  same client-driven model as H2 | FORK  --  server pushes all children from one parent stream |

HTTP/3 is the best HTTP has ever been. QUIC eliminates TCP head-of-line blocking, variable-length integers shrink frame headers, QPACK compresses more aggressively. It matches Aeon Flow on round trips. But it still speaks HTTP semantics: every resource is a request/response pair with encoded method, path, scheme, authority. That per-request tax is the fundamental architectural constraint.

The microfrontend result is the Dynamic Offset Pivot applied to protocols: by placing the pivot point (the frame header) slightly off-center  --  10 bytes fixed instead of variable-length HTTP headers  --  each resource "steps" through the wire with minimal resistance. The FORK frame is the master pivot: one small stone that sets 95 streams in motion.

## Running the Shootoff

```bash
cd open-source/aeon/packages/shootoff
bun install
bunx vitest run --reporter=verbose
```

The benchmark uses:
- Real gzip (level 6, nginx default) and brotli (quality 4, nginx on-the-fly default)
- Synthetic payloads matching real-world compressibility (text patterns for JS/CSS/HTML, pseudo-random for images/fonts)
- Accurate HTTP/1.1 header modeling (method, path, host, accept, accept-encoding, user-agent, cache-control, etc.)
- Accurate HPACK modeling (static table indexing, dynamic table reuse, Huffman encoding)
- Accurate QPACK modeling (99-entry static table, varint prefix, dynamic table reuse)
- HTTP/3 variable-length frame headers (1-byte type + 1-4 byte varint length)
- Real FlowCodec frame encoding/decoding with actual timing

## What the Numbers Mean

For **big content sites**: pick any protocol with brotli. The compression does 99 percent of the work. HTTP/3 and Aeon Flow both win on round trips (1 RTT). The framing overhead difference between HTTP/3 (906 B) and Aeon Flow (276 B) is 630 bytes on a 905 KB payload  --  irrelevant.

For **microfrontend architecture**: the protocol matters enormously.

| Protocol | Overhead | Overhead % | RTTs |
|----------|----------|-----------|------|
| HTTP/1.1 + brotli | 58.1 KB | 31.00 percent | 16 |
| HTTP/2 + brotli | 8.0 KB | 5.80 percent | 2 |
| HTTP/3 + brotli | 5.9 KB | 4.36 percent | 1 |
| Aeon Flow + brotli | 1.9 KB | 1.47 percent | 1 |

HTTP/3 is 25 percent better than HTTP/2 on framing and matches Aeon Flow on round trips. It's a genuine improvement. But Aeon Flow still carries **3x less framing** than HTTP/3  --  because it doesn't carry per-request headers at all. The stream ID *is* the request.

The modern web is moving toward more, smaller resources (code splitting, tree shaking, component-level CSS, icon sprites → individual SVGs). Every step toward granularity penalizes HTTP more and rewards Aeon Flow more. HTTP/3 narrows the gap but can't close it  --  the per-request header tax is architectural, not implementational.

The next chapter shows how to put Aeon Flow behind nginx, so browsers speak HTTP while backends enjoy the 10-byte pivot.

## The UDP Advantage: Beyond Framing

The shootoff above measures framing overhead  --  bytes on the wire. But framing is only half the story. The other half is **transport behavior under loss**.

TCP's head-of-line blocking means a single lost packet stalls ALL streams on the connection. HTTP/3 fixes this at the QUIC layer (per-stream independence), but at the cost of significant protocol complexity  --  QUIC frames are variable-length with type-dependent semantics, connection IDs, packet number spaces, and a crypto handshake integrated into the transport.

Aeon Flow over UDP achieves the same per-stream independence with a 10-byte fixed header. The `FrameReassembler` tracks per-stream sequence numbers and delivers frames in order per stream, out of order across streams. Stream A's lost packet is invisible to stream B.

### The Real-World Impact

On a clean network (0 percent loss), all protocols perform similarly  --  the framing overhead difference is the full story.

On a lossy network (1-5 percent packet loss, common on mobile/WiFi):

| Scenario | HTTP/2 (TCP) | HTTP/3 (QUIC) | Aeon Flow (UDP) |
|----------|-------------|---------------|-----------------|
| 95 resources, 1 percent loss | All streams stall on each loss event | Per-stream recovery, complex state machine | Per-stream recovery, 10-byte frames |
| Retransmit overhead | TCP retransmits at connection level | QUIC retransmits per-stream + ACK frames | ACK bitmap: 14 bytes covers 64 sequences |
| Recovery latency | 1 RTT per loss event (affects all streams) | 1 RTT per loss event (affects one stream) | 1 RTT per loss event (affects one stream) |
| Protocol complexity | Mature, well-understood | ~30,000 lines of spec (RFC 9000-9002) | ~800 lines of TypeScript |

TCP had its 40-year run. HTTP/3 was the right answer for general-purpose web traffic. But for multiplexed binary streams where every frame is self-describing? 10 bytes is enough.
