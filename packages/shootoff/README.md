# Aeon Flow Protocol Shootoff

Aeon Shootoff compares Aeon Flow against HTTP/1.1 and HTTP/2 while holding payloads and compression constant.

The fair brag is that it isolates the framing question cleanly. Same sites, same compression, different protocol behavior.

## Quick Start

```bash
bun install
bunx vitest run --reporter=verbose
```

## Demo Shapes

- **Big content**: fewer, heavier resources
- **Microfrontend**: many smaller resources

That split is one of the strongest parts of the package because it keeps the comparison from being a one-shape benchmark.

## What Is Measured

- real gzip and brotli compression
- detailed HTTP/1.1 and HTTP/2 header modeling
- real Aeon Flow framing via `FlowCodec`
- resource mixes that behave differently under each protocol

## Why This README Is Grounded

Shootoff does not need to claim more than a benchmark harness. The strongest fair brag is that it gives Aeon Flow a clear apples-to-apples comparison surface against standard web protocols.
