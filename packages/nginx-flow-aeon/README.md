# ngx_flow_aeon_module — Aeon Flow Native Listener for nginx

The reverse of `ngx_aeon_flow_module`. Accepts native Aeon Flow binary connections on a TCP port and translates them into HTTP requests to upstream backends.

## Architecture

```
Service ──Aeon Flow──▶ nginx ──HTTP──▶ Backend
                        │
                ngx_flow_aeon_module
                (stream module, L4)
```

Combined with `ngx_aeon_flow_module`, nginx becomes a polyglot proxy:

| Client Protocol | Backend Protocol | Module |
|----------------|-----------------|--------|
| HTTP | HTTP | standard nginx |
| HTTP | Aeon Flow | `ngx_aeon_flow_module` |
| Aeon Flow | HTTP | `ngx_flow_aeon_module` |
| Aeon Flow | Aeon Flow | both modules chained |

## Building

```bash
cd /path/to/nginx-source
./configure --add-dynamic-module=/path/to/open-source/aeon/packages/nginx-flow-aeon
make modules
cp objs/ngx_flow_aeon_module.so /etc/nginx/modules/
```

## Configuration

```nginx
load_module modules/ngx_flow_aeon_module.so;

stream {
    server {
        listen 4001;
        flow_aeon on;
        flow_aeon_http_upstream 127.0.0.1:8080;
        flow_aeon_max_streams 256;
        flow_aeon_connect_timeout 5s;
        flow_aeon_read_timeout 30s;
    }
}
```

## How It Works

### Connection Lifecycle

1. Aeon Flow client opens TCP connection to port 4001
2. Client sends DATA frames — each contains an HTTP request (method, URI, headers)
3. Module parses the payload and opens an HTTP/1.1 connection to the upstream
4. HTTP response is read, encoded as Aeon Flow DATA frames, and sent back
5. FIN frame closes the stream; connection stays open for reuse

### Stream Multiplexing

Multiple streams share one TCP connection. Each stream maps to one independent HTTP request/response cycle. Streams are identified by their u16 stream ID in the 10-byte frame header.

### FORK Support

Client sends a FORK frame to open multiple child streams from a parent:

```
Client → FORK(parent=0, children=[2,4,6,8])
Client → DATA(stream=2, payload="GET /api/users HTTP/1.1\r\n...")
Client → DATA(stream=4, payload="GET /api/posts HTTP/1.1\r\n...")
Client → DATA(stream=6, payload="GET /api/comments HTTP/1.1\r\n...")
Client → DATA(stream=8, payload="GET /api/likes HTTP/1.1\r\n...")
```

Each child stream becomes a parallel HTTP request. Responses arrive as they complete — no head-of-line blocking.

### Poison Propagation

When a client sends POISON on a stream:

1. The HTTP upstream connection for that stream is closed immediately
2. A POISON frame is echoed back to confirm
3. If the stream has children (from FORK), they are recursively poisoned
4. Backend work stops — no wasted compute

When a client disconnects:

1. All active streams are poisoned
2. All upstream HTTP connections are closed
3. Session resources are freed

## Structure

```
src/
├── ngx_flow_aeon.h              Types, constants, function declarations
├── ngx_flow_aeon_module.c       Stream module: accept connections, dispatch frames
└── ngx_flow_aeon_http_bridge.c  Aeon Flow ↔ HTTP translation (parse/build/encode)
```

Shares the binary codec from `../nginx-aeon-flow/src/ngx_aeon_flow_codec.c` via include path.

## See Also

- [`nginx-aeon-flow`](../nginx-aeon-flow/) — The reverse direction (HTTP → Aeon Flow)
- [Chapter 16: The nginx Module](../../../docs/ebooks/145-log-rolling-pipelined-prefill/ch16-nginx-aeon-flow-module.md)
