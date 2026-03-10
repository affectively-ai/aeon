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
export declare class FrameReassembler {
    private config;
    private streams;
    private stats;
    constructor(config?: Partial<ReassemblerConfig>);
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
    push(frame: FlowFrame): FlowFrame[];
    /**
     * Get the sequence numbers that are missing (gaps) for a stream.
     * Used by the reliability layer to request retransmission.
     */
    getMissingSequences(streamId: number): number[];
    /**
     * Clean up a stream's reassembly state.
     * Call when a stream is closed or poisoned.
     */
    closeStream(streamId: number): void;
    /**
     * Get current reassembly statistics.
     */
    getStats(): Readonly<ReassemblerStats>;
    /**
     * Reset all state.
     */
    reset(): void;
    /**
     * Deliver a frame and flush any consecutively-buffered followers.
     */
    private deliverAndFlush;
    /**
     * Evict the least-recently-active stream to make room.
     */
    private evictOldestStream;
}
