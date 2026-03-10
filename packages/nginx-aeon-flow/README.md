# ngx_aeon_flow_module

An nginx module that speaks the Aeon Flow Protocol on upstream connections,
translating between HTTP clients (browsers) and Aeon Flow backends.

## Why

Browsers speak HTTP. Backends want minimal framing overhead. This module
sits in the middle:

```
Browser ──HTTP/1.1 or HTTP/2──▶ nginx ──Aeon Flow──▶ Backend
                                  │
                          ngx_aeon_flow_module
                          translates between
                          HTTP and Aeon Flow
```

### The Numbers

From the shootoff benchmarks:

| Scenario | HTTP/1.1 overhead | HTTP/2 overhead | Aeon Flow overhead |
|----------|-------------------|-----------------|-------------------|
| 12 large resources | 8.2 KB (0.89%) | 1.6 KB (0.18%) | 276 B (0.03%) |
| 95 small modules | 58 KB (31%) | 8 KB (5.8%) | 1.9 KB (1.5%) |

For microservice architectures where nginx proxies hundreds of small
requests between internal services, Aeon Flow eliminates most of the
protocol tax.

## Architecture

```
┌─────────────────────────────────────────────┐
│                   nginx                      │
│                                              │
│  ┌──────────┐    ┌─────────────────────┐    │
│  │ HTTP     │    │ ngx_aeon_flow_module │    │
│  │ request  │───▶│                     │    │
│  │ handler  │    │  1. Open stream     │    │
│  └──────────┘    │  2. Fork children   │    │
│                  │  3. Send payloads   │    │
│  ┌──────────┐    │  4. Collapse results│    │
│  │ HTTP     │◀───│  5. Return to HTTP  │    │
│  │ response │    │                     │    │
│  │ writer   │    └──────────┬──────────┘    │
│  └──────────┘               │               │
│                             │ Aeon Flow      │
│                             │ (10-byte frames│
│                             │  over TCP)     │
└─────────────────────────────┼───────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Aeon Flow       │
                    │  Backend         │
                    │  (Node/Bun/Rust) │
                    └──────────────────┘
```

## Configuration

```nginx
upstream aeon_backend {
    server 127.0.0.1:4000;
    aeon_flow on;                    # Enable Aeon Flow protocol
    aeon_flow_keepalive 64;          # Persistent connections
    aeon_flow_max_streams 256;       # Per-connection stream limit
    aeon_flow_high_water_mark 64;    # Backpressure threshold
}

server {
    listen 443 ssl http2;
    server_name example.com;

    location / {
        # nginx speaks HTTP to the client, Aeon Flow to the backend
        aeon_flow_pass aeon_backend;

        # Fork mode: fetch all sub-resources in one flight
        aeon_flow_fork on;

        # Compression: apply before framing (like Content-Encoding)
        aeon_flow_compress brotli;

        # Race mode: try cache and origin simultaneously
        aeon_flow_race $aeon_cache $aeon_origin;

        # Collapse: reassemble forked responses
        aeon_flow_collapse on;
    }

    # ESI fragment assembly via Aeon Flow
    location /fragments/ {
        aeon_flow_pass aeon_backend;
        aeon_flow_esi on;            # Parse ESI includes, fork each
    }
}
```

## Building

```bash
# As a dynamic module
cd /path/to/nginx-source
./configure --add-dynamic-module=/path/to/ngx_aeon_flow_module
make modules

# Install
cp objs/ngx_aeon_flow_module.so /etc/nginx/modules/
```

Then in `nginx.conf`:
```nginx
load_module modules/ngx_aeon_flow_module.so;
```

## How It Works

### 1. Connection Pool

The module maintains a pool of persistent TCP connections to each
Aeon Flow backend, similar to `keepalive` for HTTP upstreams. Each
connection can multiplex up to `aeon_flow_max_streams` streams.

### 2. Request Translation

When an HTTP request arrives:

1. Pick a connection from the pool (or open a new one)
2. Open a root stream on that connection
3. Encode the HTTP request as a single DATA frame (method, path, headers as payload)
4. The backend processes and sends response frames
5. Translate response frames back to HTTP (status, headers, body)

### 3. Fork Mode

When `aeon_flow_fork` is enabled and the backend signals sub-resources
(via a manifest or ESI tags), the module:

1. Opens a root stream
2. Forks N child streams (one per sub-resource)
3. The backend pushes all sub-resources simultaneously
4. The module collapses them into the final HTTP response

This eliminates the browser's "discover → request → discover → request"
waterfall for dependent resources.

### 4. Race Mode

When `aeon_flow_race` is configured, the module opens two streams
(e.g., cache + origin) and races them:

1. Fork two child streams
2. Send the same request to both
3. First FIN wins; loser is auto-poisoned
4. Return the winner's response to the client

### 5. Poison Propagation

If the HTTP client disconnects (e.g., browser navigates away),
the module poisons the root stream. Poison propagates to all
children, cancelling in-flight backend work immediately.
No wasted compute.

## Wire Format

Same as the Aeon Flow Protocol spec (10-byte header):

```
[0..1]  stream_id  u16 big-endian
[2..5]  sequence   u32 big-endian
[6]     flags      u8  (FORK=0x01, RACE=0x02, COLLAPSE=0x04, POISON=0x08, FIN=0x10)
[7..9]  length     u24 big-endian (max 16MB)
[10..]  payload    raw bytes
```

## License

MIT
