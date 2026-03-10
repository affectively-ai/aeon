/**
 * Frame Reassembler Tests
 *
 * Validates out-of-order frame reassembly — the core primitive that
 * makes Aeon Flow work over UDP without head-of-line blocking.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { FrameReassembler } from '../../flow/frame-reassembler';
import type { FlowFrame } from '../../flow/types';

function makeFrame(streamId: number, sequence: number, payload?: string): FlowFrame {
  return {
    streamId,
    sequence,
    flags: 0,
    payload: new TextEncoder().encode(payload ?? `frame-${streamId}-${sequence}`),
  };
}

describe('FrameReassembler', () => {
  let reassembler: FrameReassembler;

  beforeEach(() => {
    reassembler = new FrameReassembler();
  });

  // ─── In-order delivery ────────────────────────────────────────────────

  test('delivers in-order frames immediately', () => {
    const f0 = makeFrame(1, 0);
    const f1 = makeFrame(1, 1);
    const f2 = makeFrame(1, 2);

    expect(reassembler.push(f0)).toEqual([f0]);
    expect(reassembler.push(f1)).toEqual([f1]);
    expect(reassembler.push(f2)).toEqual([f2]);
  });

  test('handles multiple streams independently', () => {
    const a0 = makeFrame(1, 0);
    const b0 = makeFrame(2, 0);
    const a1 = makeFrame(1, 1);
    const b1 = makeFrame(2, 1);

    expect(reassembler.push(a0)).toEqual([a0]);
    expect(reassembler.push(b0)).toEqual([b0]);
    expect(reassembler.push(a1)).toEqual([a1]);
    expect(reassembler.push(b1)).toEqual([b1]);
  });

  // ─── Out-of-order reassembly ──────────────────────────────────────────

  test('buffers out-of-order frames and delivers when gap fills', () => {
    const f0 = makeFrame(1, 0);
    const f1 = makeFrame(1, 1);
    const f2 = makeFrame(1, 2);

    // Receive f2 first (out of order) — buffered
    expect(reassembler.push(f2)).toEqual([]);

    // Receive f0 — delivered, but f1 still missing
    expect(reassembler.push(f0)).toEqual([f0]);

    // Receive f1 — gap filled, delivers f1 then f2
    const result = reassembler.push(f1);
    expect(result).toHaveLength(2);
    expect(result[0].sequence).toBe(1);
    expect(result[1].sequence).toBe(2);
  });

  test('handles reverse order', () => {
    const f0 = makeFrame(1, 0);
    const f1 = makeFrame(1, 1);
    const f2 = makeFrame(1, 2);
    const f3 = makeFrame(1, 3);

    // Receive in reverse: 3, 2, 1, 0
    expect(reassembler.push(f3)).toEqual([]);
    expect(reassembler.push(f2)).toEqual([]);
    expect(reassembler.push(f1)).toEqual([]);

    // f0 fills the gap — all four delivered
    const result = reassembler.push(f0);
    expect(result).toHaveLength(4);
    expect(result[0].sequence).toBe(0);
    expect(result[1].sequence).toBe(1);
    expect(result[2].sequence).toBe(2);
    expect(result[3].sequence).toBe(3);
  });

  test('handles interleaved out-of-order across streams', () => {
    // Stream 1: 0, 2, 1  |  Stream 2: 1, 0

    expect(reassembler.push(makeFrame(1, 0))).toHaveLength(1); // deliver
    expect(reassembler.push(makeFrame(2, 1))).toHaveLength(0); // buffer
    expect(reassembler.push(makeFrame(1, 2))).toHaveLength(0); // buffer
    expect(reassembler.push(makeFrame(2, 0))).toHaveLength(2); // deliver 0+1

    const result = reassembler.push(makeFrame(1, 1));
    expect(result).toHaveLength(2); // deliver 1+2
    expect(result[0].sequence).toBe(1);
    expect(result[1].sequence).toBe(2);
  });

  // ─── Deduplication ────────────────────────────────────────────────────

  test('drops duplicate frames', () => {
    const f0 = makeFrame(1, 0);

    expect(reassembler.push(f0)).toHaveLength(1);
    expect(reassembler.push(f0)).toHaveLength(0); // duplicate

    const stats = reassembler.getStats();
    expect(stats.framesDropped).toBe(1);
  });

  test('drops duplicate buffered frames', () => {
    const f2 = makeFrame(1, 2);

    expect(reassembler.push(f2)).toHaveLength(0); // buffer
    expect(reassembler.push(f2)).toHaveLength(0); // duplicate

    const stats = reassembler.getStats();
    expect(stats.framesDropped).toBe(1);
  });

  // ─── Gap skipping ────────────────────────────────────────────────────

  test('skips ahead when gap exceeds maxGap', () => {
    const reassembler = new FrameReassembler({ maxGap: 4 });

    const f0 = makeFrame(1, 0);
    expect(reassembler.push(f0)).toHaveLength(1);

    // Receive seq 100 — gap of 99 > maxGap of 4 — skip ahead
    const f100 = makeFrame(1, 100);
    const result = reassembler.push(f100);
    expect(result).toHaveLength(1);
    expect(result[0].sequence).toBe(100);
  });

  // ─── Buffer limit ─────────────────────────────────────────────────────

  test('drops frames when buffer is full', () => {
    const reassembler = new FrameReassembler({ maxBufferPerStream: 3 });

    // Buffer frames 1, 2, 3 (f0 is missing)
    expect(reassembler.push(makeFrame(1, 1))).toHaveLength(0);
    expect(reassembler.push(makeFrame(1, 2))).toHaveLength(0);
    expect(reassembler.push(makeFrame(1, 3))).toHaveLength(0);

    // Frame 4 should be dropped — buffer full
    expect(reassembler.push(makeFrame(1, 4))).toHaveLength(0);

    const stats = reassembler.getStats();
    expect(stats.framesBuffered).toBe(3);
    expect(stats.framesDropped).toBe(1);
  });

  // ─── Stream eviction ──────────────────────────────────────────────────

  test('evicts oldest stream when maxStreams exceeded', () => {
    const reassembler = new FrameReassembler({ maxStreams: 2 });

    reassembler.push(makeFrame(1, 0));
    reassembler.push(makeFrame(2, 0));

    // Adding stream 3 should evict stream 1
    reassembler.push(makeFrame(3, 0));

    const stats = reassembler.getStats();
    expect(stats.activeStreams).toBe(2);
  });

  // ─── Missing sequences ───────────────────────────────────────────────

  test('reports missing sequences for ACK generation', () => {
    reassembler.push(makeFrame(1, 0));
    reassembler.push(makeFrame(1, 3)); // gap at 1, 2
    reassembler.push(makeFrame(1, 5)); // gap at 4

    const missing = reassembler.getMissingSequences(1);
    expect(missing).toContain(1);
    expect(missing).toContain(2);
    expect(missing).toContain(4);
  });

  test('returns empty for unknown stream', () => {
    expect(reassembler.getMissingSequences(999)).toEqual([]);
  });

  // ─── Stream cleanup ──────────────────────────────────────────────────

  test('closes stream and frees resources', () => {
    reassembler.push(makeFrame(1, 0));
    reassembler.push(makeFrame(1, 2)); // buffered

    reassembler.closeStream(1);

    const stats = reassembler.getStats();
    expect(stats.activeStreams).toBe(0);
    expect(stats.framesBuffered).toBe(0);
  });

  // ─── Stats ────────────────────────────────────────────────────────────

  test('tracks accurate statistics', () => {
    reassembler.push(makeFrame(1, 0)); // delivered
    reassembler.push(makeFrame(1, 2)); // buffered
    reassembler.push(makeFrame(1, 1)); // delivered + flushes 2
    reassembler.push(makeFrame(1, 0)); // duplicate, dropped

    const stats = reassembler.getStats();
    expect(stats.framesReceived).toBe(4);
    expect(stats.framesDelivered).toBe(3);
    expect(stats.framesDropped).toBe(1);
    expect(stats.framesReordered).toBe(1); // frame 2 was reordered
    expect(stats.framesBuffered).toBe(0); // all flushed
    expect(stats.activeStreams).toBe(1);
  });

  // ─── Reset ────────────────────────────────────────────────────────────

  test('reset clears all state', () => {
    reassembler.push(makeFrame(1, 0));
    reassembler.push(makeFrame(2, 0));

    reassembler.reset();

    const stats = reassembler.getStats();
    expect(stats.framesReceived).toBe(0);
    expect(stats.activeStreams).toBe(0);
  });

  // ─── No head-of-line blocking across streams ──────────────────────────

  test('stream A loss does not block stream B', () => {
    // Stream A: receive 0, then 2 (missing 1)
    // Stream B: receive 0, 1, 2 — all should deliver immediately
    expect(reassembler.push(makeFrame(10, 0))).toHaveLength(1); // A: ok
    expect(reassembler.push(makeFrame(10, 2))).toHaveLength(0); // A: buffered

    // Stream B is completely unaffected by A's gap
    expect(reassembler.push(makeFrame(20, 0))).toHaveLength(1); // B: ok
    expect(reassembler.push(makeFrame(20, 1))).toHaveLength(1); // B: ok
    expect(reassembler.push(makeFrame(20, 2))).toHaveLength(1); // B: ok

    // Now fill A's gap
    const result = reassembler.push(makeFrame(10, 1));
    expect(result).toHaveLength(2); // delivers 1 + buffered 2
  });

  // ─── Large-scale reorder ──────────────────────────────────────────────

  test('handles 100 frames arriving in random order', () => {
    // Use a large maxGap so no frames are skipped during random delivery
    const r = new FrameReassembler({ maxGap: 256 });

    const N = 100;
    const streamId = 42;
    const frames = Array.from({ length: N }, (_, i) => makeFrame(streamId, i));

    // Shuffle using Fisher-Yates with a fixed seed for reproducibility
    const shuffled = [...frames];
    let seed = 12345;
    const pseudoRandom = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(pseudoRandom() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Push all shuffled frames
    const allDelivered: FlowFrame[] = [];
    for (const frame of shuffled) {
      const result = r.push(frame);
      allDelivered.push(...result);
    }

    // All N frames should have been delivered
    expect(allDelivered).toHaveLength(N);

    // They should be in order
    for (let i = 0; i < N; i++) {
      expect(allDelivered[i].sequence).toBe(i);
    }
  });
});
