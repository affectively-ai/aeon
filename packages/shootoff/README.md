# Aeon Flow Protocol Shootoff

Head-to-head comparison: **Aeon Flow** vs **HTTP/1.1** vs **HTTP/2** — same compression, same payloads, only the protocol framing changes.

## Quick Start

```bash
bun install
bunx vitest run --reporter=verbose
```

## Two Demo Sites

### Whip Worthington's Flaxseed Empire (Big Content)

12 resources, ~2.2 MB. A content-heavy blog from the heir to the Worthington Flaxseed dynasty. Big JS bundles, hero images, web fonts. The "big stone" test — few moves, each one heavy.

### The Wally Wallington Wonder Archive (Microfrontend)

95 resources, ~618 KB. An interactive archive celebrating Wally Wallington's engineering marvels. Aggressive code-splitting: 45 JS modules, 16 CSS modules, 20 SVG icons. The "cribbing jack" test — many tiny moves.

## Results Summary

### Big Content (12 resources, brotli)

| Protocol | Wire Size | Overhead | RTTs |
|----------|-----------|----------|------|
| HTTP/1.1 | 913 KB | 8.2 KB (0.89%) | 3 |
| HTTP/2 | 907 KB | 1.6 KB (0.18%) | 2 |
| **Aeon Flow** | **905 KB** | **276 B (0.03%)** | **1** |

### Microfrontend (95 resources, brotli)

| Protocol | Wire Size | Overhead | RTTs |
|----------|-----------|----------|------|
| HTTP/1.1 | 187 KB | 58 KB (31%) | 16 |
| HTTP/2 | 137 KB | 8 KB (5.8%) | 2 |
| **Aeon Flow** | **131 KB** | **1.9 KB (1.5%)** | **1** |

HTTP/1.1 spends **31% of bandwidth on headers** for 95 small resources. Aeon Flow: **1.5%**.

## What's Measured

- **Real compression**: gzip (level 6) and brotli (quality 4) via Node zlib
- **Accurate HTTP headers**: Full request/response headers including User-Agent, Accept-Encoding, HSTS, etc.
- **HPACK modeling**: Static table indexing, dynamic table reuse, Huffman encoding for HTTP/2
- **Real FlowCodec**: Actual Aeon Flow frame encoding/decoding with timing
- **Payload realism**: Text-like patterns for JS/CSS/HTML (compressible), pseudo-random for images/fonts (incompressible)

## Structure

```
src/
├── fixtures/          Site manifests (resource lists with sizes and types)
│   ├── big-content.ts     Whip Worthington's blog
│   └── microfrontend.ts   Wally Wallington's archive
├── protocols/         Protocol simulations
│   ├── http1.ts           HTTP/1.1 with full headers
│   ├── http2.ts           HTTP/2 with HPACK
│   └── aeon-flow.ts       Aeon Flow with real FlowCodec
├── compression/       Real gzip/brotli via Node zlib
└── __tests__/
    └── shootoff.test.ts   The benchmark suite (21 tests)

sites/                 Demo site HTML
├── big-content/       Whip Worthington's Flaxseed Empire
└── microfrontend/     The Wally Wallington Wonder Archive
```

## See Also

- [Chapter 15: The Shootoff](../../../docs/ebooks/145-log-rolling-pipelined-prefill/ch15-the-shootoff.md) — Full analysis and Wallington mapping
- [Chapter 16: The nginx Module](../../../docs/ebooks/145-log-rolling-pipelined-prefill/ch16-nginx-aeon-flow-module.md) — Putting Aeon Flow behind nginx
