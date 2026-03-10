/**
 * Frame Reassembler — Out-of-Order Frame Reconstruction
 *
 * Over TCP/WebSocket, frames arrive in order. Over UDP, they don't.
 * The flow header's stream_id (u16) + sequence (u32) already carry
 * the information needed to reassemble — this module uses it.
 *
 * Per-stream reorder buffer with configurable window. Frames arriving
 * out of order are buffered until the gap fills. Frames arriving
 * beyond the window are dropped (assumed lost, will be retransmitted).
 *
 * This is the same insight as QUIC: per-stream ordering eliminates
 * head-of-line blocking across streams. Stream A's lost packet doesn't
 * block Stream B. Only Stream A waits for its own retransmission.
 */

import type { FlowFrame } from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReassemblerConfig {
  /**
   * Maximum number of frames to buffer per stream while waiting
   * for gaps to fill. Frames beyond this are dropped.
   * @default 256
   */
  maxBufferPerStream: number;

  /**
   * Maximum number of tracked streams. Oldest streams are evicted
   * when this limit is reached.
   * @default 1024
   */
  maxStreams: number;

  /**
   * Maximum gap in sequence numbers before declaring frames lost.
   * If we receive seq 10 but are expecting seq 3, and gap > maxGap,
   * we skip ahead and emit what we have.
   * @default 64
   */
  maxGap: number;
}

const DEFAULT_REASSEMBLER_CONFIG: ReassemblerConfig = {
  maxBufferPerStream: 256,
  maxStreams: 1024,
  maxGap: 64,
};

/** Per-stream reassembly state */
interface StreamReassemblyState {
  /** Next expected sequence number */
  nextExpected: number;
  /** Buffered out-of-order frames, keyed by sequence number */
  buffer: Map<number, FlowFrame>;
  /** Last time a frame was received on this stream */
  lastActivity: number;
  /** Sequence numbers we've already emitted (dedup window) */
  emittedSequences: Set<number>;
}

export interface ReassemblerStats {
  /** Total frames received */
  framesReceived: number;
  /** Frames delivered in order */
  framesDelivered: number;
  /** Frames currently buffered (waiting for gaps) */
  framesBuffered: number;
  /** Frames dropped (duplicates or beyond window) */
  framesDropped: number;
  /** Frames reordered (delivered from buffer after gap fill) */
  framesReordered: number;
  /** Active streams being tracked */
  activeStreams: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Reassembler
// ═══════════════════════════════════════════════════════════════════════════════

export class FrameReassembler {
  private config: ReassemblerConfig;
  private streams = new Map<number, StreamReassemblyState>();
  private stats: ReassemblerStats = {
    framesReceived: 0,
    framesDelivered: 0,
    framesBuffered: 0,
    framesDropped: 0,
    framesReordered: 0,
    activeStreams: 0,
  };

  constructor(config?: Partial<ReassemblerConfig>) {
    this.config = { ...DEFAULT_REASSEMBLER_CONFIG, ...config };
  }

  /**
   * Process an incoming frame. Returns an array of frames that are
   * now deliverable in order. May return 0 frames (buffered), 1 frame
   * (in order), or multiple frames (gap was filled, releasing buffered).
   *
   * This is the core reassembly operation:
   *   - In-order frame → deliver immediately + flush any buffered followers
   *   - Out-of-order frame → buffer until gap fills
   *   - Duplicate → drop
   *   - Beyond window → drop
   */
  push(frame: FlowFrame): FlowFrame[] {
    this.stats.framesReceived++;

    const streamId = frame.streamId;
    let state = this.streams.get(streamId);

    if (!state) {
      // New stream — enforce stream limit
      if (this.streams.size >= this.config.maxStreams) {
        this.evictOldestStream();
      }

      state = {
        nextExpected: 0,
        buffer: new Map(),
        lastActivity: Date.now(),
        emittedSequences: new Set(),
      };
      this.streams.set(streamId, state);
      this.stats.activeStreams = this.streams.size;
    }

    state.lastActivity = Date.now();

    // Dedup: already emitted this sequence?
    if (state.emittedSequences.has(frame.sequence)) {
      this.stats.framesDropped++;
      return [];
    }

    // Already buffered?
    if (state.buffer.has(frame.sequence)) {
      this.stats.framesDropped++;
      return [];
    }

    const seq = frame.sequence;

    // Case 1: Frame is exactly what we expected → deliver + flush
    if (seq === state.nextExpected) {
      return this.deliverAndFlush(state, frame);
    }

    // Case 2: Frame is behind what we expected → duplicate, drop
    if (seq < state.nextExpected) {
      this.stats.framesDropped++;
      return [];
    }

    // Case 3: Frame is ahead of expected → buffer (gap exists)
    const gap = seq - state.nextExpected;

    // If gap is too large, skip ahead
    if (gap > this.config.maxGap) {
      // Declare everything in the gap as lost, skip ahead
      state.nextExpected = seq;
      return this.deliverAndFlush(state, frame);
    }

    // Buffer the frame if we have space
    if (state.buffer.size >= this.config.maxBufferPerStream) {
      this.stats.framesDropped++;
      return [];
    }

    state.buffer.set(seq, frame);
    this.stats.framesBuffered++;

    return [];
  }

  /**
   * Get the sequence numbers that are missing (gaps) for a stream.
   * Used by the reliability layer to request retransmission.
   */
  getMissingSequences(streamId: number): number[] {
    const state = this.streams.get(streamId);
    if (!state) return [];

    const missing: number[] = [];
    const maxBuffered = state.buffer.size > 0
      ? Math.max(...state.buffer.keys())
      : state.nextExpected;

    for (let seq = state.nextExpected; seq < maxBuffered; seq++) {
      if (!state.buffer.has(seq)) {
        missing.push(seq);
      }
    }

    return missing;
  }

  /**
   * Clean up a stream's reassembly state.
   * Call when a stream is closed or poisoned.
   */
  closeStream(streamId: number): void {
    const state = this.streams.get(streamId);
    if (state) {
      this.stats.framesBuffered -= state.buffer.size;
      this.streams.delete(streamId);
      this.stats.activeStreams = this.streams.size;
    }
  }

  /**
   * Get current reassembly statistics.
   */
  getStats(): Readonly<ReassemblerStats> {
    return { ...this.stats };
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.streams.clear();
    this.stats = {
      framesReceived: 0,
      framesDelivered: 0,
      framesBuffered: 0,
      framesDropped: 0,
      framesReordered: 0,
      activeStreams: 0,
    };
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  /**
   * Deliver a frame and flush any consecutively-buffered followers.
   */
  private deliverAndFlush(
    state: StreamReassemblyState,
    frame: FlowFrame
  ): FlowFrame[] {
    const deliverable: FlowFrame[] = [frame];
    state.emittedSequences.add(frame.sequence);
    state.nextExpected = frame.sequence + 1;
    this.stats.framesDelivered++;

    // Flush consecutive frames from buffer
    while (state.buffer.has(state.nextExpected)) {
      const buffered = state.buffer.get(state.nextExpected)!;
      state.buffer.delete(state.nextExpected);
      state.emittedSequences.add(state.nextExpected);
      state.nextExpected++;
      deliverable.push(buffered);
      this.stats.framesBuffered--;
      this.stats.framesDelivered++;
      this.stats.framesReordered++;
    }

    // Trim dedup set to avoid unbounded growth
    if (state.emittedSequences.size > 1024) {
      const cutoff = state.nextExpected - 512;
      for (const seq of state.emittedSequences) {
        if (seq < cutoff) state.emittedSequences.delete(seq);
      }
    }

    return deliverable;
  }

  /**
   * Evict the least-recently-active stream to make room.
   */
  private evictOldestStream(): void {
    let oldestKey = -1;
    let oldestTime = Infinity;

    for (const [key, state] of this.streams) {
      if (state.lastActivity < oldestTime) {
        oldestTime = state.lastActivity;
        oldestKey = key;
      }
    }

    if (oldestKey >= 0) {
      this.closeStream(oldestKey);
    }
  }
}
