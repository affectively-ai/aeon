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
const DEFAULT_REASSEMBLER_CONFIG = {
    maxBufferPerStream: 256,
    maxStreams: 1024,
    maxGap: 64,
};
// ═══════════════════════════════════════════════════════════════════════════════
// Reassembler
// ═══════════════════════════════════════════════════════════════════════════════
export class FrameReassembler {
    config;
    streams = new Map();
    stats = {
        framesReceived: 0,
        framesDelivered: 0,
        framesBuffered: 0,
        framesDropped: 0,
        framesReordered: 0,
        activeStreams: 0,
    };
    constructor(config) {
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
    push(frame) {
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
    getMissingSequences(streamId) {
        const state = this.streams.get(streamId);
        if (!state)
            return [];
        const missing = [];
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
    closeStream(streamId) {
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
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset all state.
     */
    reset() {
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
    deliverAndFlush(state, frame) {
        const deliverable = [frame];
        state.emittedSequences.add(frame.sequence);
        state.nextExpected = frame.sequence + 1;
        this.stats.framesDelivered++;
        // Flush consecutive frames from buffer
        while (state.buffer.has(state.nextExpected)) {
            const buffered = state.buffer.get(state.nextExpected);
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
                if (seq < cutoff)
                    state.emittedSequences.delete(seq);
            }
        }
        return deliverable;
    }
    /**
     * Evict the least-recently-active stream to make room.
     */
    evictOldestStream() {
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
