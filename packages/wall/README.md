# wall

`wall` is a command-line client for the Aeon Flow protocol.

The fair brag is that it feels like a practical protocol tool, not just a demo binary. It supports normal requests, `fork`, `race`, HTTP comparison, UDP transport, and verbose waterfall output.

## Install

```bash
go install github.com/affectively-ai/aeon/wall/cmd/wall@latest
```

Or build from source:

```bash
cd open-source/aeon/packages/wall
go build -o wall ./cmd/wall
```

## Examples

```bash
wall aeon://localhost:4001/api/users
wall --fork aeon://localhost:4001/index.html /css/app.css /js/app.js
wall --race aeon://cache:4001/data aeon://origin:4001/data
wall --compare aeon://localhost:4001/api/users http://localhost:8080/api/users
wall --udp aeon://localhost:4001/api/users
wall -v --waterfall aeon://localhost:4001/api/users
```

## Useful Flags

- `-v`: frame-by-frame details
- `--waterfall`: waterfall timeline
- `--fork`: request several child paths in one fork
- `--race`: first response wins
- `--compare`: compare Aeon Flow and HTTP
- `--udp`: use UDP datagrams
- `-H "Key: Value"`: send headers

## Why This README Is Grounded

Wall does not need a bigger pitch than that. The strongest fair brag is that it already gives the protocol a useful command-line tool for development and comparison work.
