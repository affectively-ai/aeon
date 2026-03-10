# wall — curl for Aeon Flow Protocol

Named after Wally Wallington, whose rotational techniques inspired the Aeon Flow Protocol. Where curl *curls*, wall *rotates*.

## Install

```bash
go install github.com/affectively-ai/aeon/wall/cmd/wall@latest
```

Or build from source:

```bash
cd open-source/aeon/packages/wall
go build -o wall ./cmd/wall
```

## Usage

### Single Request

```bash
wall aeon://localhost:4001/api/users
```

### Fork (Parallel Resources)

One connection, one FORK frame, all resources in parallel:

```bash
wall --fork aeon://localhost:4001/index.html \
  /css/app.css /js/app.js /js/vendor.js /img/hero.png
```

### Race (First Response Wins)

```bash
wall --race aeon://cache:4001/data aeon://origin:4001/data
```

### Compare Aeon Flow vs HTTP

```bash
wall --compare aeon://localhost:4001/api/users http://localhost:8080/api/users
```

Output:
```
─── Comparison ─────────────────────────────────────────
                   Aeon Flow         HTTP
Body bytes              4096         4096
Total time           1.2ms          3.8ms
Frames                    4          N/A
Framing bytes            40       ~300-600

Aeon Flow: 3.2x faster
```

### UDP Transport

```bash
wall --udp aeon://localhost:4001/api/users
```

Each frame is sent as a single UDP datagram. The 10-byte header contains stream_id + sequence, enabling out-of-order reassembly without TCP's head-of-line blocking.

### Verbose & Waterfall

```bash
wall -v --waterfall aeon://localhost:4001/api/users
```

```
> stream=0 seq=0 flags=0x00 len=45 (DATA)
> stream=0 seq=1 flags=0x10 len=0 (FIN)
< stream=0 seq=0 flags=0x00 len=4096 (DATA)
< stream=0 seq=1 flags=0x10 len=0 (FIN)

─── Waterfall ───────────────────────────────────────────
Time   Dir  Stream   Seq Flags    Bytes
  0.0ms >>>  0        0   DATA     45    █
  0.1ms >>>  0        1   FIN      0     █
  1.2ms <<<  0        0   DATA     4096  ░░░░░░░░░░░░█
  1.3ms <<<  0        1   FIN      0     ░░░░░░░░░░░░░█
─────────────────────────────────────────────────────────
4 frames, 4096 bytes received, 1.3ms total
```

## Flags

| Flag | Description |
|------|------------|
| `-v` | Verbose: show frame-by-frame details |
| `--waterfall` | Visual waterfall timeline |
| `--fork` | Fork mode: first URL is root, remaining are child paths |
| `--race` | Race mode: parallel requests, first response wins |
| `--http` | Use standard HTTP instead of Aeon Flow |
| `--compare` | Compare Aeon Flow vs HTTP side by side |
| `--udp` | Use UDP datagrams instead of TCP |
| `-H "Key: Value"` | Add a header |

## See Also

- [`nginx-aeon-flow`](../nginx-aeon-flow/) — HTTP → Aeon Flow (browser to backend)
- [`nginx-flow-aeon`](../nginx-flow-aeon/) — Aeon Flow → HTTP (service to backend)
- [`aeon-devtools`](../aeon-devtools/) — Chrome DevTools panel for Aeon Flow inspection
