/**
 * Aeon Flow Protocol — Stream Multiplexing with Fork/Race/Collapse
 *
 * The Flow Layer sits between the Frame Layer (FlowCodec) and the
 * Application Layer (inference, ESI, sync, shell, speculate). It manages
 * multiplexed streams with three protocol-level primitives:
 *
 * - **Fork**: Create N child streams from a parent stream. Each child
 *   runs independently. Used for parallel pipelines, fragment fetching,
 *   reality branching.
 *
 * - **Race**: Mark streams as racing. The first to send a FIN frame wins.
 *   Losers are automatically poisoned. Used for speculative decoding,
 *   cache races, A/B testing.
 *
 * - **Collapse**: Wait for all streams to complete (or poison), then
 *   merge their results via a caller-provided function. Used for shard
 *   assembly, fragment stitching, branch reconciliation.
 *
 * Stream IDs: even = client-initiated, odd = server-initiated (like HTTP/2).
 * Backpressure via per-stream high-water mark (configurable, default 64).
 * Poison propagates from parent to all descendants.
 *
 * @see docs/ebooks/145-log-rolling-pipelined-prefill/ch14-aeon-flow-protocol.md
 */
import type { FlowFrame, FlowStream, FlowTransport, FlowProtocolConfig } from './types';
type FrameHandler = (frame: FlowFrame) => void;
type VoidHandler = () => void;
/**
 * AeonFlowProtocol
 *
 * Manages multiplexed binary streams over a transport with
 * fork/race/collapse semantics.
 */
export declare class AeonFlowProtocol {
    private streams;
    private nextEvenId;
    private nextOddId;
    private codec;
    private transport;
    private config;
    private frameHandlers;
    private endHandlers;
    private poisonHandlers;
    private raceGroups;
    private collapseGroups;
    constructor(transport: FlowTransport, config?: Partial<FlowProtocolConfig>);
    /**
     * Open a new root stream (no parent).
     *
     * Client-initiated streams get even IDs; server-initiated get odd IDs.
     */
    openStream(): number;
    /**
     * Get the current state of a stream.
     */
    getStream(streamId: number): FlowStream | undefined;
    /**
     * Get all active streams.
     */
    getActiveStreams(): FlowStream[];
    /**
     * Fork a parent stream into N child streams.
     *
     * Each child stream is independent and can send/receive frames.
     * The parent tracks all children. Poisoning the parent poisons all children.
     *
     * @param parentStreamId The stream to fork from
     * @param count Number of child streams to create
     * @returns Array of child stream IDs
     */
    fork(parentStreamId: number, count: number): number[];
    /**
     * Race multiple streams. The first to send a FIN frame wins.
     * All other streams in the race are automatically poisoned.
     *
     * @param streamIds Streams to race (must all be open)
     * @returns Promise resolving with the winner's stream ID and final payload
     */
    race(streamIds: number[]): Promise<{
        winner: number;
        result: Uint8Array;
    }>;
    /**
     * Collapse multiple streams: wait for all to complete (or poison),
     * then merge their results.
     *
     * @param streamIds Streams to collapse
     * @param merger Function that merges results from all streams
     * @returns Promise resolving with the merged result
     */
    collapse(streamIds: number[], merger: (results: Map<number, Uint8Array>) => Uint8Array): Promise<Uint8Array>;
    /**
     * Send a payload on a stream.
     */
    send(streamId: number, payload: Uint8Array, flags?: number): void;
    /**
     * Finish a stream. Sends a FIN frame and transitions to 'closed'.
     *
     * @param streamId Stream to finish
     * @param finalPayload Optional final payload to include with the FIN
     */
    finish(streamId: number, finalPayload?: Uint8Array): void;
    /**
     * Poison a stream. Sends a POISON frame and propagates to all descendants.
     *
     * Poisoning is the protocol-level equivalent of NaN propagation,
     * AbortSignal cancellation, or error cascading.
     */
    poison(streamId: number): void;
    /**
     * Register a handler for frames arriving on a specific stream.
     */
    onFrame(streamId: number, handler: FrameHandler): () => void;
    /**
     * Register a handler for when a stream ends (FIN received).
     */
    onStreamEnd(streamId: number, handler: VoidHandler): () => void;
    /**
     * Register a handler for when a stream is poisoned.
     */
    onStreamPoisoned(streamId: number, handler: VoidHandler): () => void;
    /**
     * Close the protocol and underlying transport.
     * Poisons all open streams first.
     */
    destroy(): void;
    private handleIncoming;
    private handleFrame;
    private settleRace;
    private settleCollapse;
    private allocateStreamId;
    private createStream;
    private requireStream;
    private sendFrame;
    private concatenateResults;
}
export {};
