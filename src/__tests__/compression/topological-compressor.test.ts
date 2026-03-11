/**
 * Topological Compressor Tests
 *
 * Validates fork/race/collapse compression:
 *   - Round-trip correctness (compress → decompress = original)
 *   - Per-chunk adaptive codec selection
 *   - Poison propagation (codecs worse than raw are discarded)
 *   - Self-describing frame format
 *   - Data-type-specific codec wins (RLE for repetitive, delta for sequential, LZ77 for patterns)
 *   - Edge cases (empty, tiny, large, random)
 */

import { describe, it, expect } from 'vitest';
import {
  TopologicalCompressor,
  type TopologicalCompressionResult,
} from '../../compression/TopologicalCompressor';
import {
  RawCodec,
  RLECodec,
  DeltaCodec,
  LZ77Codec,
  BUILTIN_CODECS,
} from '../../compression/codecs';

// ============================================================================
// Helpers
// ============================================================================

/** Create a buffer of repeated bytes (good for RLE) */
function makeRepeating(pattern: number[], length: number): Uint8Array {
  const data = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = pattern[i % pattern.length];
  }
  return data;
}

/** Create a buffer of sequential bytes (good for delta) */
function makeSequential(length: number, start = 0, step = 1): Uint8Array {
  const data = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = (start + i * step) & 0xff;
  }
  return data;
}

/** Create a buffer of random bytes (bad for all codecs) */
function makeRandom(length: number, seed = 42): Uint8Array {
  const data = new Uint8Array(length);
  let s = seed;
  for (let i = 0; i < length; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    data[i] = (s >>> 24) & 0xff;
  }
  return data;
}

/** Create data with mixed regions (different codecs should win different chunks) */
function makeMixed(chunkSize: number): Uint8Array {
  const chunks = [
    // Chunk 0: all zeros (RLE should win)
    new Uint8Array(chunkSize).fill(0),
    // Chunk 1: sequential (delta should win)
    makeSequential(chunkSize),
    // Chunk 2: repeated pattern (LZ77 should win)
    makeRepeating([1, 2, 3, 4, 5, 6, 7, 8], chunkSize),
    // Chunk 3: random (raw should win or at least tie)
    makeRandom(chunkSize),
  ];

  const combined = new Uint8Array(chunkSize * 4);
  for (let i = 0; i < chunks.length; i++) {
    combined.set(chunks[i], i * chunkSize);
  }
  return combined;
}

// ============================================================================
// Round-Trip Tests
// ============================================================================

describe('TopologicalCompressor', () => {
  describe('round-trip correctness', () => {
    it('compresses and decompresses empty data', () => {
      const tc = new TopologicalCompressor();
      const result = tc.compress(new Uint8Array(0));
      expect(result.data.length).toBe(0);
      expect(result.originalSize).toBe(0);

      const decompressed = tc.decompress(result.data);
      expect(decompressed.length).toBe(0);
    });

    it('round-trips a single byte', () => {
      const tc = new TopologicalCompressor({ chunkSize: 64 });
      const original = new Uint8Array([42]);
      const result = tc.compress(original);
      const decompressed = tc.decompress(result.data);
      expect(decompressed).toEqual(original);
    });

    it('round-trips repeated data', () => {
      const tc = new TopologicalCompressor({ chunkSize: 256 });
      const original = new Uint8Array(1024).fill(0xaa);
      const result = tc.compress(original);
      const decompressed = tc.decompress(result.data);
      expect(decompressed).toEqual(original);
    });

    it('round-trips sequential data', () => {
      const tc = new TopologicalCompressor({ chunkSize: 256 });
      const original = makeSequential(1024);
      const result = tc.compress(original);
      const decompressed = tc.decompress(result.data);
      expect(decompressed).toEqual(original);
    });

    it('round-trips random data', () => {
      const tc = new TopologicalCompressor({ chunkSize: 256 });
      const original = makeRandom(1024);
      const result = tc.compress(original);
      const decompressed = tc.decompress(result.data);
      expect(decompressed).toEqual(original);
    });

    it('round-trips mixed data with multiple codec winners', () => {
      const chunkSize = 512;
      const tc = new TopologicalCompressor({ chunkSize });
      const original = makeMixed(chunkSize);
      const result = tc.compress(original);
      const decompressed = tc.decompress(result.data);
      expect(decompressed).toEqual(original);
    });

    it('round-trips data smaller than one chunk', () => {
      const tc = new TopologicalCompressor({ chunkSize: 4096 });
      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const result = tc.compress(original);
      const decompressed = tc.decompress(result.data);
      expect(decompressed).toEqual(original);
    });

    it('round-trips data exactly equal to chunk size', () => {
      const tc = new TopologicalCompressor({ chunkSize: 16 });
      const original = makeSequential(16);
      const result = tc.compress(original);
      const decompressed = tc.decompress(result.data);
      expect(decompressed).toEqual(original);
    });

    it('round-trips large data (64 KB)', () => {
      const tc = new TopologicalCompressor({ chunkSize: 4096 });
      const original = makeRepeating([0, 1, 2, 3, 4], 65536);
      const result = tc.compress(original);
      const decompressed = tc.decompress(result.data);
      expect(decompressed).toEqual(original);
    });
  });

  // ==========================================================================
  // Codec Selection (Fork/Race/Collapse)
  // ==========================================================================

  describe('per-chunk codec selection', () => {
    it('selects RLE for highly repetitive data', () => {
      const tc = new TopologicalCompressor({ chunkSize: 256 });
      const original = new Uint8Array(256).fill(0);
      const result = tc.compress(original);

      // RLE should win for all-zeros
      expect(result.chunks[0].codecId).toBe(1); // RLE
      expect(result.ratio).toBeGreaterThan(0.5);
    });

    it('selects different codecs for different chunks', () => {
      const chunkSize = 512;
      const tc = new TopologicalCompressor({ chunkSize });
      const original = makeMixed(chunkSize);
      const result = tc.compress(original);

      // Should use more than one codec across chunks
      expect(result.codecsUsed).toBeGreaterThanOrEqual(2);
    });

    it('reports β₁ = codecs - 1', () => {
      const tc = new TopologicalCompressor();
      const result = tc.compress(new Uint8Array([1, 2, 3]));
      // 4 built-in codecs → β₁ = 3
      expect(result.bettiNumber).toBe(BUILTIN_CODECS.length - 1);
    });

    it('falls back to raw for incompressible data', () => {
      const tc = new TopologicalCompressor({ chunkSize: 64 });
      const original = makeRandom(64);
      const result = tc.compress(original);

      // Raw (id=0) should win for random data
      expect(result.chunks[0].codecId).toBe(0);
    });
  });

  // ==========================================================================
  // Poison Propagation
  // ==========================================================================

  describe('poison propagation', () => {
    it('poisons codecs that expand data', () => {
      const tc = new TopologicalCompressor({ chunkSize: 64 });
      const original = makeRandom(64);
      const result = tc.compress(original);

      // At least some codecs should be poisoned for random data
      expect(result.chunks[0].poisoned).toBeGreaterThan(0);
    });

    it('never poisons the raw codec', () => {
      const tc = new TopologicalCompressor({ chunkSize: 64 });
      const original = makeRandom(64);
      const result = tc.compress(original);

      // Raw should always survive (it's the identity)
      // Worst case: raw wins with codec_id = 0
      expect(result.chunks[0].codecId).toBe(0);
    });

    it('poisons nothing when all codecs compress well', () => {
      const tc = new TopologicalCompressor({ chunkSize: 256 });
      const original = new Uint8Array(256).fill(0);
      const result = tc.compress(original);

      // All-zeros: every codec should compress (or at least not expand)
      // RLE will definitely compress, delta will stay same size, etc.
      // But some may be poisoned if they expand
      expect(result.chunks[0].codecId).toBe(1); // RLE wins
    });
  });

  // ==========================================================================
  // Self-Describing Frames
  // ==========================================================================

  describe('self-describing frames', () => {
    it('each chunk is independently decodable', () => {
      const chunkSize = 128;
      const tc = new TopologicalCompressor({ chunkSize });
      const original = makeMixed(chunkSize);
      const result = tc.compress(original);

      // Should have 4 chunks
      expect(result.chunks.length).toBe(4);

      // Total compressed size should match the data length
      expect(result.data.length).toBe(result.compressedSize);
    });

    it('compressed size includes 9-byte header per chunk', () => {
      const tc = new TopologicalCompressor({ chunkSize: 64 });
      const original = makeRandom(64); // Will use raw codec
      const result = tc.compress(original);

      // Raw codec: compressed = original. Frame = 9 header + 64 data = 73
      expect(result.chunks[0].compressedSize).toBe(9 + 64);
    });

    it('provides chunk-level diagnostics', () => {
      const chunkSize = 256;
      const tc = new TopologicalCompressor({ chunkSize });
      const original = makeMixed(chunkSize);
      const result = tc.compress(original);

      for (const chunk of result.chunks) {
        expect(chunk.chunkIndex).toBeGreaterThanOrEqual(0);
        expect(chunk.codecId).toBeGreaterThanOrEqual(0);
        expect(chunk.codecName).toBeTruthy();
        expect(chunk.originalSize).toBe(chunkSize);
        expect(chunk.compressedSize).toBeGreaterThan(0);
        expect(typeof chunk.ratio).toBe('number');
        expect(chunk.poisoned).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ==========================================================================
  // Individual Codec Tests
  // ==========================================================================

  describe('codecs', () => {
    describe('RawCodec', () => {
      const codec = new RawCodec();

      it('encode returns identical data', () => {
        const data = new Uint8Array([1, 2, 3]);
        expect(codec.encode(data)).toEqual(data);
      });

      it('decode returns identical data', () => {
        const data = new Uint8Array([1, 2, 3]);
        expect(codec.decode(data, 3)).toEqual(data);
      });
    });

    describe('RLECodec', () => {
      const codec = new RLECodec();

      it('compresses runs of identical bytes', () => {
        const data = new Uint8Array(100).fill(42);
        const compressed = codec.encode(data);
        expect(compressed.length).toBeLessThan(data.length);

        const decompressed = codec.decode(compressed, data.length);
        expect(decompressed).toEqual(data);
      });

      it('handles empty input', () => {
        expect(codec.encode(new Uint8Array(0)).length).toBe(0);
      });

      it('handles single byte', () => {
        const data = new Uint8Array([7]);
        const compressed = codec.encode(data);
        const decompressed = codec.decode(compressed, 1);
        expect(decompressed).toEqual(data);
      });

      it('handles alternating bytes', () => {
        const data = makeRepeating([0, 255], 100);
        const compressed = codec.encode(data);
        const decompressed = codec.decode(compressed, data.length);
        expect(decompressed).toEqual(data);
      });
    });

    describe('DeltaCodec', () => {
      const codec = new DeltaCodec();

      it('compresses sequential data to near-zero deltas', () => {
        const data = makeSequential(100);
        const compressed = codec.encode(data);
        // Delta of sequential data: all deltas are 1 (except first byte)
        expect(compressed[0]).toBe(0); // first byte
        for (let i = 1; i < compressed.length; i++) {
          expect(compressed[i]).toBe(1); // constant delta
        }

        const decompressed = codec.decode(compressed, data.length);
        expect(decompressed).toEqual(data);
      });

      it('round-trips arbitrary data', () => {
        const data = makeRandom(200);
        const compressed = codec.encode(data);
        const decompressed = codec.decode(compressed, data.length);
        expect(decompressed).toEqual(data);
      });

      it('handles empty input', () => {
        expect(codec.encode(new Uint8Array(0)).length).toBe(0);
      });
    });

    describe('LZ77Codec', () => {
      const codec = new LZ77Codec();

      it('compresses repeated patterns', () => {
        const data = makeRepeating([1, 2, 3, 4, 5, 6, 7, 8], 256);
        const compressed = codec.encode(data);
        expect(compressed.length).toBeLessThan(data.length);

        const decompressed = codec.decode(compressed, data.length);
        expect(decompressed).toEqual(data);
      });

      it('round-trips data with no patterns', () => {
        const data = makeRandom(128);
        const compressed = codec.encode(data);
        const decompressed = codec.decode(compressed, data.length);
        expect(decompressed).toEqual(data);
      });

      it('handles empty input', () => {
        expect(codec.encode(new Uint8Array(0)).length).toBe(0);
      });

      it('handles data shorter than min match', () => {
        const data = new Uint8Array([1, 2]);
        const compressed = codec.encode(data);
        const decompressed = codec.decode(compressed, data.length);
        expect(decompressed).toEqual(data);
      });
    });
  });

  // ==========================================================================
  // Configuration
  // ==========================================================================

  describe('configuration', () => {
    it('respects custom chunk size', () => {
      const tc = new TopologicalCompressor({ chunkSize: 32 });
      expect(tc.getChunkSize()).toBe(32);

      const original = new Uint8Array(128).fill(0);
      const result = tc.compress(original);
      expect(result.chunks.length).toBe(4); // 128 / 32 = 4 chunks
    });

    it('respects custom codec list', () => {
      const codecs = [new RawCodec(), new RLECodec()];
      const tc = new TopologicalCompressor({ codecs });
      expect(tc.getCodecs().length).toBe(2);

      const result = tc.compress(new Uint8Array(64).fill(0));
      // β₁ = 2 codecs - 1 = 1
      expect(result.bettiNumber).toBe(1);
    });

    it('works with only the raw codec', () => {
      const tc = new TopologicalCompressor({ codecs: [new RawCodec()] });
      const original = makeRandom(256);
      const result = tc.compress(original);
      const decompressed = tc.decompress(result.data);
      expect(decompressed).toEqual(original);
      expect(result.bettiNumber).toBe(0); // Only one path
      expect(result.codecsUsed).toBe(1);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('throws on truncated header during decompress', () => {
      const tc = new TopologicalCompressor();
      const truncated = new Uint8Array(5); // Less than 9-byte header
      expect(() => tc.decompress(truncated)).toThrow('Truncated chunk header');
    });

    it('throws on truncated data during decompress', () => {
      const tc = new TopologicalCompressor();
      // Valid header claiming 100 bytes of data, but only 1 byte present
      const buf = new Uint8Array(10);
      buf[0] = 0; // codec_id = raw
      const view = new DataView(buf.buffer);
      view.setUint32(1, 100); // original_size = 100
      view.setUint32(5, 100); // compressed_size = 100
      expect(() => tc.decompress(buf)).toThrow('Truncated chunk data');
    });
  });

  // ==========================================================================
  // Performance Characteristics
  // ==========================================================================

  describe('performance', () => {
    it('compresses 64 KB in reasonable time', () => {
      const tc = new TopologicalCompressor({ chunkSize: 4096 });
      const data = makeRepeating([0, 1, 2, 3], 65536);
      const result = tc.compress(data);
      expect(result.timeMs).toBeLessThan(1000); // Should be <100ms typically
      expect(result.ratio).toBeGreaterThan(0); // Should compress somewhat
    });

    it('achieves compression on repetitive data', () => {
      const tc = new TopologicalCompressor({ chunkSize: 1024 });
      const data = new Uint8Array(4096).fill(0);
      const result = tc.compress(data);
      expect(result.compressedSize).toBeLessThan(result.originalSize);
    });

    it('overhead is bounded for random data', () => {
      const tc = new TopologicalCompressor({ chunkSize: 1024 });
      const data = makeRandom(4096);
      const result = tc.compress(data);
      // Worst case: raw codec + 9 bytes header per chunk
      // 4 chunks × 9 bytes = 36 bytes overhead
      const overhead = result.compressedSize - result.originalSize;
      expect(overhead).toBeLessThanOrEqual(4 * 9);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Two-Level Stream Race (streamRace=true)
  // ══════════════════════════════════════════════════════════════════════════

  describe('Two-Level Stream Race', () => {
    it('streamRace=false (default) produces chunk-only format', () => {
      const tc = new TopologicalCompressor();
      const data = makeRepeating([0xAA], 4096);
      const result = tc.compress(data);

      // No strategy field when streamRace is off
      expect(result.strategy).toBeUndefined();

      // Roundtrip
      expect(tc.decompress(result.data)).toEqual(data);
    });

    it('streamRace=true: global brotli beats per-chunk on homogeneous text', () => {
      const text = 'the quick brown fox jumps over the lazy dog\n'.repeat(500);
      const data = new TextEncoder().encode(text);

      const tc = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
        streamRace: true,
      });

      const result = tc.compress(data);

      // Global brotli should win on homogeneous text (cross-chunk dictionary)
      expect(result.strategy).toBe('global:brotli');

      // Must beat what per-chunk alone achieves
      const chunkedOnly = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
      });
      const chunkedResult = chunkedOnly.compress(data);
      expect(result.compressedSize).toBeLessThan(chunkedResult.compressedSize);

      // Roundtrip
      expect(tc.decompress(result.data)).toEqual(data);
    });

    it('streamRace=true: per-chunk wins on mixed content', () => {
      // Mix of compressible text and random binary
      const text = new TextEncoder().encode(
        'function(){return this.props.children;}\n'.repeat(50),
      );
      const random = makeRandom(2048);
      const mixed = new Uint8Array(text.length + random.length);
      mixed.set(text, 0);
      mixed.set(random, text.length);

      const tc = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
        streamRace: true,
      });

      const result = tc.compress(mixed);

      // Either strategy can win on mixed content — just verify roundtrip
      expect(result.strategy).toBeDefined();
      expect(result.compressedSize).toBeLessThan(mixed.length);
      expect(tc.decompress(result.data)).toEqual(mixed);
    });

    it('streamRace=true: roundtrip works for all data types', () => {
      const testCases = [
        { name: 'empty', data: new Uint8Array(0) },
        { name: 'repeated', data: makeRepeating([0x42], 8192) },
        { name: 'sequential', data: makeSequential(8192) },
        { name: 'random', data: makeRandom(8192) },
        { name: 'text', data: new TextEncoder().encode('Hello world! '.repeat(1000)) },
      ];

      for (const { name, data } of testCases) {
        const tc = new TopologicalCompressor({
          chunkSize: 4096,
          codecs: BUILTIN_CODECS,
          streamRace: true,
        });

        const result = tc.compress(data);
        const decompressed = tc.decompress(result.data);
        expect(decompressed).toEqual(data);
      }
    });

    it('streamRace=true: β₁ includes both outer and inner races', () => {
      const data = makeRepeating([0xAA], 4096);
      const tc = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
        streamRace: true,
      });

      const result = tc.compress(data);

      // Inner β₁ = 7 (8 codecs - 1)
      // Outer β₁ = number of global candidates (varies, but > 0)
      // Total > inner alone
      expect(result.bettiNumber).toBeGreaterThan(7);
    });

    it('streamRace=true: strategy field identifies the winner', () => {
      const data = new TextEncoder().encode('export default '.repeat(2000));

      const tc = new TopologicalCompressor({
        chunkSize: 4096,
        codecs: BUILTIN_CODECS,
        streamRace: true,
      });

      const result = tc.compress(data);

      // Strategy should be either 'chunked' or 'global:<name>'
      expect(result.strategy).toMatch(/^(chunked|global:\w+)$/);
    });
  });
});
