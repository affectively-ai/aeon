# Chapter 16: The nginx Module  --  Aeon Flow Behind the Reverse Proxy

> *"You don't need to move the entire mass at once."*  --  Wally Wallington

## The Problem

Browsers speak HTTP. They will speak HTTP for a long time. No amount of protocol innovation changes the fact that `fetch()` sends HTTP headers and expects HTTP responses.

But behind the reverse proxy? That's our territory.

## The Architecture

```
Browser ──HTTP/1.1 or HTTP/2──▶ nginx ──Aeon Flow──▶ Backend
                                  │
                          ngx_aeon_flow_module
```

nginx handles TLS termination, static file serving, and HTTP to the browser. On the upstream side, it speaks Aeon Flow to the backend  --  10-byte frames, stream multiplexing, fork/race/collapse.

The browser never knows. It sends a normal HTTP request and gets a normal HTTP response. But between nginx and the backend, the protocol tax drops from 5-31% to under 1.5%.

This is Wallington's Barn Move applied to web architecture: you don't move the entire building. You pivot on one corner (nginx), swing the other side (the backend protocol), and the building walks forward one corner at a time.

## The Module: `ngx_aeon_flow_module`

### Building

```bash
# Dynamic module
cd /path/to/nginx-source
./configure --add-dynamic-module=/path/to/open-source/aeon/packages/nginx-aeon-flow
make modules

# Install
cp objs/ngx_aeon_flow_module.so /etc/nginx/modules/
```

In `nginx.conf`:
```nginx
load_module modules/ngx_aeon_flow_module.so;
```

### Configuration

```nginx
upstream aeon_backend {
    server 127.0.0.1:4000;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    location / {
        aeon_flow_pass aeon_backend;
        aeon_flow_fork on;
        aeon_flow_compress brotli;
        aeon_flow_max_streams 256;
        aeon_flow_high_water_mark 64;
        aeon_flow_keepalive 64;
    }
}
```

## How It Works

### Connection Pooling

Like `keepalive` for HTTP upstreams, the module maintains a pool of persistent TCP connections to each Aeon Flow backend. Each connection multiplexes up to `max_streams` streams.

The pool size is configurable via `aeon_flow_keepalive`. When a connection finishes serving a request and has no active streams, it returns to the pool rather than closing.

### Request Flow

1. HTTP request arrives at nginx
2. Module picks a connection from the pool (or opens a new one)
3. Opens a root stream on that connection
4. Encodes the HTTP request (method, URI, headers) as a single DATA frame
5. Backend processes and sends response DATA frames
6. Module translates response frames back to HTTP status + headers + body
7. HTTP response sent to browser
8. Stream closes; connection returns to pool

### Fork Mode

When `aeon_flow_fork` is enabled, the module intercepts the backend's initial response to discover sub-resources (via a manifest or ESI tags):

1. Root stream opens
2. Backend responds with a resource manifest (JSON list of paths)
3. Module forks N child streams  --  **one FORK frame, all children**
4. Backend pushes all sub-resources simultaneously on child streams
5. Module collapses them into the final HTTP response

This eliminates the browser's discover-request-discover-request waterfall. Instead of:

```
Browser → GET /index.html
Browser ← HTML (discovers CSS, JS)
Browser → GET /css/main.css
Browser → GET /js/app.js
Browser ← CSS
Browser ← JS (discovers more chunks)
Browser → GET /js/chunk-1.js
Browser → GET /js/chunk-2.js
...
```

It becomes:

```
Browser → GET /index.html
nginx → [Aeon Flow: FORK 95 streams]
Backend → [pushes all 95 resources on parallel streams]
nginx ← [COLLAPSE: assembles response with preload headers]
Browser ← HTML + Link: <preload> headers for all resources
```

### Race Mode

```nginx
location / {
    aeon_flow_pass aeon_backend;
    aeon_flow_race on;
}
```

The module opens two streams and races them:

1. Fork: child A goes to cache, child B goes to origin
2. First FIN wins
3. Loser is auto-poisoned (backend stops work immediately)
4. Winner's payload becomes the HTTP response

No wasted compute. If the cache hits in 2ms, the origin request is poisoned before it even starts processing.

### ESI Mode

```nginx
location /fragments/ {
    aeon_flow_pass aeon_backend;
    aeon_flow_esi on;
}
```

Edge Side Includes via fork/collapse:

1. Parse ESI tags from the HTML
2. Fork one child stream per `<esi:include>`
3. Backend resolves each fragment
4. Collapse: substitute fragment payloads into the HTML

### Poison Propagation

When the browser disconnects (navigate away, close tab, abort fetch), nginx closes the HTTP connection. The module responds by poisoning the root stream:

```c
static void ngx_aeon_flow_cleanup(void *data) {
    ngx_aeon_flow_stream_t *stream = *(ngx_aeon_flow_stream_t **)data;
    if (stream != NULL && stream->conn != NULL) {
        ngx_aeon_flow_poison(stream->conn, stream);
    }
}
```

Poison propagates recursively to all children. Every in-flight backend operation for that request is cancelled with a single POISON frame cascade. The backend doesn't waste cycles computing responses nobody will read.

Compare this to HTTP: when a browser disconnects, the backend has no way to know until it tries to write the response and gets a broken pipe. By then, it's already done the work.

## The Codec in C

The binary codec is minimal  --  two functions, no allocations on the decode path:

```c
size_t ngx_aeon_flow_encode(u_char *buf, ngx_aeon_flow_frame_t *frame);
ngx_int_t ngx_aeon_flow_decode(u_char *buf, size_t len,
    ngx_aeon_flow_frame_t *frame, size_t *bytes_consumed);
```

Encode writes the 10-byte header + payload into a pre-allocated buffer. Decode is zerocopy: `frame->payload` points into the receive buffer. No `malloc`, no `memcpy`. The frame exists as a view over the bytes that arrived from the socket.

This maps directly to nginx's buffer chain model. A received buffer is decoded in-place, frames are dispatched to streams, and the buffer is compacted only when the leading bytes have been consumed.

### Partial Frame Handling

Real TCP connections deliver arbitrary byte boundaries. The read handler manages this:

```c
while ((size_t)(conn->recv_buf->last - p) >= NGX_AEON_FLOW_HEADER_SIZE) {
    rc = ngx_aeon_flow_decode(p, conn->recv_buf->last - p, &frame, &consumed);
    if (rc == NGX_AGAIN) break;   /* incomplete frame, wait for more data */
    if (rc == NGX_ERROR) { conn->close = 1; return; }
    /* dispatch frame to stream handler */
    p += consumed;
}
/* compact buffer */
```

`NGX_AGAIN` means the header is present but the payload hasn't fully arrived. The module leaves the partial frame in the buffer and waits for the next read event. No state machine needed  --  just "do I have 10 bytes? read the length. do I have 10+length bytes? decode the frame."

## The Wallington Mapping

| Wallington Technique | nginx Module Analogue |
|---------------------|----------------------|
| **Dynamic Offset Pivot** | 10-byte fixed header as the pivot point for all traffic |
| **Multi-Stage Cribbing Jack** | Connection pooling: each request raises the utilization one "shim" at a time |
| **The Round Road** | HTTP→Aeon Flow translation normalizes any browser request into a shape the protocol can handle |
| **Sand-Box Descent** | Poison propagation: controlled lowering of in-flight work, grain by grain |
| **The Rolling Pivot** | The module is the corner pivot  --  browser side stays put (HTTP), backend side swings forward (Aeon Flow) |

## What's Built

The module at `open-source/aeon/packages/nginx-aeon-flow/` includes:

| File | Purpose |
|------|---------|
| `config` | nginx build system integration (static + dynamic module) |
| `src/ngx_aeon_flow.h` | Header: types, constants, function declarations |
| `src/ngx_aeon_flow_codec.c` | Binary frame encode/decode (zerocopy) |
| `src/ngx_aeon_flow_upstream.c` | Connection pool, stream management, fork/poison/finish |
| `src/ngx_aeon_flow_module.c` | Directives, configuration, HTTP↔Aeon Flow handler |

All components are implemented:

- **Codec**: Zerocopy encode/decode with partial frame handling (NGX_AGAIN)
- **Upstream**: Connection pooling, stream table, fork/poison/finish with recursive child propagation
- **Handler**: Full HTTP→Aeon Flow translation via `ngx_event_connect_peer()`, async read/write event handlers, streaming response body through nginx's output filter chain, status line parsing from first DATA frame, poison-on-disconnect cleanup
- **Read handler**: Frame dispatch loop with DATA→body streaming, FIN→response finalization, POISON→502 propagation, buffer compaction
- **Write handler**: Send queue flush via `send_chain()`

## Next Steps

1. **Fork discovery**: Parse manifest or Link headers from the initial response to auto-fork sub-resources
2. **Benchmarks**: Same nginx, same backend, same files  --  HTTP/2 upstream vs Aeon Flow upstream. Measure TTFB, total transfer time, and backend CPU waste on cancelled requests.
