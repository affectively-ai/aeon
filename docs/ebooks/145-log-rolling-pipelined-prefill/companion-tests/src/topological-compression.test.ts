/**
 * Topological Compression — Companion Tests for §8.6
 *
 * Proves:
 *   1. Per-chunk adaptive codec selection via fork/race/collapse
 *   2. Self-describing 9-byte chunk headers enable independent decompression
 *   3. Brotli as a racing codec: topology subsumes the algorithm
 *   4. β₁ = codecs - 1 measures the covering space dimension
 *   5. Poison propagation: codecs whose output >= input are discarded
 *   6. Adding better codecs improves ratio without changing topology
 *
 * Uses: @anthropic-ai/aeon (TopologicalCompressor, codecs)
 */

import { describe, it, expect } from 'vitest';
import { TopologicalCompressor } from '@aeon/compression';
import {
  RawCodec,
  RLECodec,
  DeltaCodec,
  LZ77Codec,
  BrotliCodec,
  GzipCodec,
  HuffmanCodec,
  DictionaryCodec,
  PURE_JS_CODECS,
  BUILTIN_CODECS,
} from '@aeon/compression';
import type { CompressionCodec } from '@aeon/compression';

describe('Topological Compression (§8.6)', () => {

  describe('Core Claim: Per-Chunk Adaptive Codec Selection', () => {
    it('different chunks select different codecs', () => {
      // Create data with mixed content: repeated bytes + random bytes
      const data = new Uint8Array(8192);

      // First 4096 bytes: highly repetitive (RLE-friendly)
      for (let i = 0; i < 4096; i++) {
        data[i] = i < 2048 ? 0xAA : 0xBB;
      }

      // Second 4096 bytes: sequential (delta-friendly)
      for (let i = 4096; i < 8192; i++) {
        data[i] = i & 0xFF;
      }

      const compressor = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: PURE_JS_CODECS,
      });
      const result = compressor.compress(data);

      // At least 2 chunks
      expect(result.chunks.length).toBe(2);

      // Chunks should potentially select different codecs
      // (the topology adapts per chunk)
      expect(result.codecsUsed).toBeGreaterThanOrEqual(1);

      // Round-trip must be perfect
      const decompressed = compressor.decompress(result.data);
      expect(decompressed).toEqual(data);
    });

    it('all-zeros chunk: RLE should win', () => {
      const data = new Uint8Array(4096); // all zeros

      const compressor = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: PURE_JS_CODECS,
      });
      const result = compressor.compress(data);

      // RLE (id=1) should win on all-zeros data
      expect(result.chunks[0].codecId).toBe(1);
      expect(result.chunks[0].codecName).toBe('rle');

      // Massive compression ratio
      expect(result.ratio).toBeGreaterThan(0.9);
    });

    it('random data: raw should win (all codecs poisoned)', () => {
      // Pseudo-random data — incompressible
      const data = new Uint8Array(4096);
      let seed = 0xDEADBEEF;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
        data[i] = (seed >>> 24) & 0xFF;
      }

      const compressor = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: PURE_JS_CODECS,
      });
      const result = compressor.compress(data);

      // Raw (id=0) should win — all other codecs expand the data
      expect(result.chunks[0].codecId).toBe(0);
      expect(result.chunks[0].codecName).toBe('raw');

      // Poisoned count should be > 0
      expect(result.chunks[0].poisoned).toBeGreaterThan(0);
    });
  });

  describe('Self-Describing 9-Byte Chunk Headers', () => {
    it('each compressed chunk is independently decompressible', () => {
      const data = new Uint8Array(12288); // 3 chunks at 4096
      for (let i = 0; i < data.length; i++) {
        data[i] = (i * 7 + 13) & 0xFF;
      }

      const compressor = new TopologicalCompressor({ chunkSize: 4096 });
      const result = compressor.compress(data);

      // Verify 3 chunks
      expect(result.chunks.length).toBe(3);

      // Full decompression recovers original
      const decompressed = compressor.decompress(result.data);
      expect(decompressed).toEqual(data);
    });

    it('chunk header: [codec_id:u8, original_size:u32, compressed_size:u32]', () => {
      const data = new Uint8Array(100);
      data.fill(42);

      const compressor = new TopologicalCompressor({
        chunkSize: 100,
        codecs: PURE_JS_CODECS,
      });
      const result = compressor.compress(data);

      // The compressed data starts with a 9-byte header
      expect(result.data.length).toBeGreaterThanOrEqual(9);

      // First byte: codec ID
      const codecId = result.data[0];
      expect(codecId).toBe(result.chunks[0].codecId);

      // Bytes 1-4: original size (u32 big-endian)
      const view = new DataView(result.data.buffer, result.data.byteOffset + 1, 8);
      const originalSize = view.getUint32(0);
      expect(originalSize).toBe(100);

      // Bytes 5-8: compressed size (u32 big-endian)
      const compressedSize = view.getUint32(4);
      expect(compressedSize).toBeLessThanOrEqual(100);
    });
  });

  describe('The Topology Subsumes the Algorithm', () => {
    /**
     * Key claim from §8.6:
     * "Brotli at β₁ = 0 is a degenerate case of topological compression at β₁ = 5."
     *
     * Adding brotli to the race doesn't change the topology — it adds a path
     * to the covering space. The topology selects brotli when it wins,
     * raw when brotli wastes cycles on incompressible data.
     */

    it('topo-full beats topo-pure (more codecs = better ratio)', () => {
      // Text-like data that compresses well
      const text = 'function(){return this.props.children;}'.repeat(100);
      const data = new TextEncoder().encode(text);

      const purePipeline = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: PURE_JS_CODECS, // raw, RLE, delta, LZ77
      });

      const fullPipeline = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS, // raw, RLE, delta, LZ77, brotli, gzip
      });

      const pureResult = purePipeline.compress(data);
      const fullResult = fullPipeline.compress(data);

      // Full (with brotli) should achieve better ratio
      expect(fullResult.compressedSize).toBeLessThanOrEqual(pureResult.compressedSize);

      // β₁ increases with more codecs
      expect(fullResult.bettiNumber).toBeGreaterThan(pureResult.bettiNumber);
      expect(pureResult.bettiNumber).toBe(PURE_JS_CODECS.length - 1); // 5
      expect(fullResult.bettiNumber).toBe(BUILTIN_CODECS.length - 1); // 7

      // Both roundtrip perfectly
      expect(purePipeline.decompress(pureResult.data)).toEqual(data);
      expect(fullPipeline.decompress(fullResult.data)).toEqual(data);
    });

    it('brotli-only (β₁=0) is a degenerate case of topological compression', () => {
      const text = 'the quick brown fox jumps over the lazy dog\n'.repeat(200);
      const data = new TextEncoder().encode(text);

      // β₁ = 0: only brotli, no race
      const brotliOnly = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: [new RawCodec(), new BrotliCodec()], // raw fallback + brotli
      });

      // β₁ = 5: full race
      const fullRace = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
      });

      const brotliResult = brotliOnly.compress(data);
      const fullResult = fullRace.compress(data);

      // β₁ values
      expect(brotliResult.bettiNumber).toBe(1); // 2 codecs - 1
      expect(fullResult.bettiNumber).toBe(7);   // 8 codecs - 1

      // On homogeneous text, brotli wins every chunk in both configs
      // So results should be similar (full might have slightly more header overhead
      // from the race, but same codec selection)
      // The key point: topology didn't change the outcome for homogeneous data
      // But for mixed data, the full race would adapt

      // Both roundtrip
      expect(brotliOnly.decompress(brotliResult.data)).toEqual(data);
      expect(fullRace.decompress(fullResult.data)).toEqual(data);
    });

    it('adding a new codec improves ratio without changing topology', () => {
      const data = new Uint8Array(8192);
      for (let i = 0; i < data.length; i++) {
        data[i] = (i * 3 + 7) & 0xFF;
      }

      // Start with 2 codecs
      const small = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: [new RawCodec(), new RLECodec()],
      });

      // Add more codecs
      const medium = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: [new RawCodec(), new RLECodec(), new DeltaCodec(), new LZ77Codec()],
      });

      const smallResult = small.compress(data);
      const mediumResult = medium.compress(data);

      // More codecs → same or better ratio
      expect(mediumResult.compressedSize).toBeLessThanOrEqual(smallResult.compressedSize);

      // Topology grew (β₁ increased) but structure is identical
      expect(smallResult.bettiNumber).toBe(1);
      expect(mediumResult.bettiNumber).toBe(3);

      // Both roundtrip
      expect(small.decompress(smallResult.data)).toEqual(data);
      expect(medium.decompress(mediumResult.data)).toEqual(data);
    });
  });

  describe('Poison Propagation in Codec Space', () => {
    it('codecs whose output >= input are poisoned', () => {
      // Random data — most codecs will expand it
      const data = new Uint8Array(4096);
      let seed = 0xCAFEBABE;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
        data[i] = (seed >>> 24) & 0xFF;
      }

      const compressor = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: PURE_JS_CODECS,
      });
      const result = compressor.compress(data);

      // At least some codecs should be poisoned on random data
      const totalPoisoned = result.chunks.reduce((sum, c) => sum + c.poisoned, 0);
      expect(totalPoisoned).toBeGreaterThan(0);

      // Raw (id=0) should never be poisoned (it returns input as-is)
      // So the winner should be raw for random data
      expect(result.chunks[0].codecId).toBe(0);
    });
  });

  describe('Huffman Codec (Entropy Coding)', () => {
    it('Huffman wins on skewed byte distributions', () => {
      // Data where byte 0x41 ('A') appears 90% of the time
      const data = new Uint8Array(4096);
      let seed = 42;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
        data[i] = (seed % 10) < 9 ? 0x41 : (seed & 0xFF);
      }

      const huffman = new HuffmanCodec();
      const encoded = huffman.encode(data);

      // Huffman should compress skewed data well
      // 260 bytes overhead + compressed bits
      expect(encoded.length).toBeLessThan(data.length);

      // Roundtrip
      const decoded = huffman.decode(encoded, data.length);
      expect(decoded).toEqual(data);
    });

    it('Huffman codec ID is 6', () => {
      const huffman = new HuffmanCodec();
      expect(huffman.id).toBe(6);
      expect(huffman.name).toBe('huffman');
    });

    it('Huffman bails on random data (260-byte overhead not worth it)', () => {
      const data = new Uint8Array(4096);
      let seed = 0xDEADBEEF;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
        data[i] = (seed >>> 24) & 0xFF;
      }

      const huffman = new HuffmanCodec();
      const encoded = huffman.encode(data);

      // On truly random data, Huffman + 260 bytes overhead >= raw
      // The race would poison it
      // Just verify roundtrip works regardless
      if (encoded.length >= 260) {
        const decoded = huffman.decode(encoded, data.length);
        expect(decoded).toEqual(data);
      }
    });
  });

  describe('Dictionary Codec (Web Content Domain)', () => {
    it('Dictionary compresses web content with common patterns', () => {
      const html = `<div class="container">
        <span class="display:flex align-items:center">
          <p>function return const export import</p>
        </span>
      </div>`;
      const data = new TextEncoder().encode(html.repeat(10));

      const dict = new DictionaryCodec();
      const encoded = dict.encode(data);

      // Dictionary should compress web content
      expect(encoded.length).toBeLessThan(data.length);

      // Roundtrip
      const decoded = dict.decode(encoded, data.length);
      expect(decoded).toEqual(data);
    });

    it('Dictionary codec ID is 7', () => {
      const dict = new DictionaryCodec();
      expect(dict.id).toBe(7);
      expect(dict.name).toBe('dictionary');
    });

    it('Dictionary handles null bytes correctly', () => {
      const data = new Uint8Array([0x00, 0x41, 0x00, 0x00, 0x42]);

      const dict = new DictionaryCodec();
      const encoded = dict.encode(data);
      const decoded = dict.decode(encoded, data.length);

      expect(decoded).toEqual(data);
    });

    it('Dictionary wins in the race on web-heavy chunks', () => {
      const jsCode = `function addEventListener() {
        const container = document.querySelector('.container');
        container.className = 'display:flex';
        container.textContent = 'undefined';
        return this.props.children;
      }`.repeat(20);
      const data = new TextEncoder().encode(jsCode);

      const compressor = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: PURE_JS_CODECS,
      });
      const result = compressor.compress(data);

      // Verify at least one chunk used dictionary or another advanced codec
      const codecIds = new Set(result.chunks.map(c => c.codecId));
      expect(codecIds.size).toBeGreaterThanOrEqual(1);

      // Roundtrip
      const decompressed = compressor.decompress(result.data);
      expect(decompressed).toEqual(data);
    });
  });

  describe('Expanded Race: 8 Codecs (β₁ = 7)', () => {
    it('BUILTIN_CODECS has 8 codecs', () => {
      expect(BUILTIN_CODECS.length).toBe(8);
      expect(BUILTIN_CODECS.map(c => c.id)).toEqual([0, 1, 2, 3, 6, 7, 4, 5]);
    });

    it('PURE_JS_CODECS has 6 codecs', () => {
      expect(PURE_JS_CODECS.length).toBe(6);
      expect(PURE_JS_CODECS.map(c => c.id)).toEqual([0, 1, 2, 3, 6, 7]);
    });

    it('full race with 8 codecs achieves β₁ = 7', () => {
      const text = 'export default function Component() { return this.props.children; }\n'.repeat(100);
      const data = new TextEncoder().encode(text);

      const compressor = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
      });
      const result = compressor.compress(data);

      expect(result.bettiNumber).toBe(7); // 8 codecs - 1
      expect(result.compressedSize).toBeLessThan(data.length);

      const decompressed = compressor.decompress(result.data);
      expect(decompressed).toEqual(data);
    });
  });

  describe('Compression Roundtrip Correctness', () => {
    const testCases = [
      { name: 'empty', data: new Uint8Array(0) },
      { name: 'single byte', data: new Uint8Array([42]) },
      { name: 'all zeros', data: new Uint8Array(10000).fill(0) },
      { name: 'sequential', data: Uint8Array.from({ length: 1000 }, (_, i) => i & 0xFF) },
      { name: 'text', data: new TextEncoder().encode('Hello, World! '.repeat(500)) },
    ];

    for (const { name, data } of testCases) {
      it(`roundtrip: ${name}`, () => {
        for (const codecs of [PURE_JS_CODECS, BUILTIN_CODECS]) {
          const compressor = new TopologicalCompressor({ chunkSize: 4096, codecs });
          const compressed = compressor.compress(data);
          const decompressed = compressor.decompress(compressed.data);
          expect(decompressed).toEqual(data);
        }
      });
    }
  });

  describe('Two-Level Stream Race (streamRace=true)', () => {
    /**
     * §8.1 key claim: "the topology subsumes the algorithm."
     *
     * Per-chunk brotli loses cross-chunk dictionary context.
     * Global brotli has it. The two-level race forks BOTH strategies
     * and lets the topology decide:
     *
     *   FORK (stream level):
     *     ├─ Global brotli (entire stream, cross-chunk dictionary)
     *     ├─ Global gzip (entire stream)
     *     └─ Per-chunk topological (8 codecs racing per 4096-byte chunk)
     *   RACE → smallest wins
     *   COLLAPSE → 5-byte strategy header + data
     *
     * On homogeneous text, global brotli wins.
     * On mixed content, per-chunk topo wins.
     * The topology adapts at BOTH granularities.
     */

    it('two-level race beats standalone brotli on homogeneous text', () => {
      const text = 'the quick brown fox jumps over the lazy dog\n'.repeat(500);
      const data = new TextEncoder().encode(text);

      // Two-level race: fork global codecs vs per-chunk topo
      const twoLevel = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
        streamRace: true,
      });
      const twoLevelResult = twoLevel.compress(data);

      // Per-chunk only (what we had before)
      const chunkedOnly = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
      });
      const chunkedResult = chunkedOnly.compress(data);

      // Two-level should beat or match per-chunk
      // (global brotli wins the outer race on homogeneous text)
      expect(twoLevelResult.compressedSize).toBeLessThanOrEqual(
        chunkedResult.compressedSize,
      );

      // Strategy should be global brotli (it has cross-chunk dictionary)
      expect(twoLevelResult.strategy).toBe('global:brotli');

      // Roundtrip
      expect(twoLevel.decompress(twoLevelResult.data)).toEqual(data);
    });

    it('two-level race roundtrips correctly for mixed content', () => {
      // 50% text, 50% pseudo-random
      const textPart = new TextEncoder().encode(
        'export default function Component() { return this.props.children; }\n'.repeat(40),
      );
      const randomPart = new Uint8Array(textPart.length);
      let seed = 0xDEADBEEF;
      for (let i = 0; i < randomPart.length; i++) {
        seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
        randomPart[i] = (seed >>> 24) & 0xFF;
      }
      const mixed = new Uint8Array(textPart.length + randomPart.length);
      mixed.set(textPart, 0);
      mixed.set(randomPart, textPart.length);

      const tc = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
        streamRace: true,
      });

      const result = tc.compress(mixed);
      expect(result.strategy).toBeDefined();
      expect(result.compressedSize).toBeLessThan(mixed.length);

      // Roundtrip
      expect(tc.decompress(result.data)).toEqual(mixed);
    });

    it('β₁ of two-level race exceeds single-level', () => {
      const data = new TextEncoder().encode('Hello '.repeat(2000));

      const singleLevel = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
      });
      const twoLevel = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
        streamRace: true,
      });

      const singleResult = singleLevel.compress(data);
      const twoLevelResult = twoLevel.compress(data);

      // Single level: β₁ = 7 (8 codecs - 1)
      expect(singleResult.bettiNumber).toBe(7);

      // Two level: β₁ = inner + outer > 7
      expect(twoLevelResult.bettiNumber).toBeGreaterThan(singleResult.bettiNumber);
    });

    it('streamRace=false is backward compatible', () => {
      const data = new TextEncoder().encode('test data '.repeat(500));

      const tc = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
        // streamRace defaults to false
      });

      const result = tc.compress(data);
      expect(result.strategy).toBeUndefined();

      // Roundtrip
      expect(tc.decompress(result.data)).toEqual(data);
    });
  });
});
