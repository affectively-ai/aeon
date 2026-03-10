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
import { FlowCodec } from './FlowCodec';
import { FORK, RACE, COLLAPSE, POISON, FIN, DEFAULT_FLOW_CONFIG, } from './types';
/**
 * AeonFlowProtocol
 *
 * Manages multiplexed binary streams over a transport with
 * fork/race/collapse semantics.
 */
export class AeonFlowProtocol {
    streams = new Map();
    nextEvenId = 0;
    nextOddId = 1;
    codec;
    transport;
    config;
    // Event handlers
    frameHandlers = new Map();
    endHandlers = new Map();
    poisonHandlers = new Map();
    // Race tracking
    raceGroups = new Map();
    // Collapse tracking
    collapseGroups = new Map();
    constructor(transport, config) {
        this.transport = transport;
        this.config = { ...DEFAULT_FLOW_CONFIG, ...config };
        this.codec = FlowCodec.createSync();
        // Wire up incoming data
        this.transport.onReceive((data) => {
            this.handleIncoming(data);
        });
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Stream management
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Open a new root stream (no parent).
     *
     * Client-initiated streams get even IDs; server-initiated get odd IDs.
     */
    openStream() {
        const id = this.allocateStreamId();
        this.createStream(id);
        return id;
    }
    /**
     * Get the current state of a stream.
     */
    getStream(streamId) {
        return this.streams.get(streamId);
    }
    /**
     * Get all active streams.
     */
    getActiveStreams() {
        return Array.from(this.streams.values()).filter((s) => s.state !== 'closed' && s.state !== 'poisoned');
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Fork: create N child streams from a parent
    // ═══════════════════════════════════════════════════════════════════════
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
    fork(parentStreamId, count) {
        const parent = this.requireStream(parentStreamId, 'open');
        if (count < 1) {
            throw new RangeError('Fork count must be at least 1');
        }
        if (this.streams.size + count > this.config.maxConcurrentStreams) {
            throw new Error(`Cannot fork ${count} streams: would exceed maxConcurrentStreams (${this.config.maxConcurrentStreams})`);
        }
        const childIds = [];
        for (let i = 0; i < count; i++) {
            const childId = this.allocateStreamId();
            this.createStream(childId, parentStreamId);
            parent.children.push(childId);
            childIds.push(childId);
        }
        // Send FORK frame on parent to notify remote
        this.sendFrame(parentStreamId, FORK, new Uint8Array(childIds.flatMap((id) => [(id >>> 8) & 0xFF, id & 0xFF])));
        return childIds;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Race: first stream to FIN wins, losers are poisoned
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Race multiple streams. The first to send a FIN frame wins.
     * All other streams in the race are automatically poisoned.
     *
     * @param streamIds Streams to race (must all be open)
     * @returns Promise resolving with the winner's stream ID and final payload
     */
    race(streamIds) {
        if (streamIds.length < 2) {
            throw new RangeError('Race requires at least 2 streams');
        }
        // Mark all streams as racing
        for (const id of streamIds) {
            const stream = this.requireStream(id);
            stream.state = 'racing';
        }
        // Send RACE frame on each stream
        for (const id of streamIds) {
            const peerIds = streamIds.filter((sid) => sid !== id);
            this.sendFrame(id, RACE, new Uint8Array(peerIds.flatMap((pid) => [(pid >>> 8) & 0xFF, pid & 0xFF])));
        }
        const groupId = `race-${streamIds.join('-')}-${Date.now()}`;
        return new Promise((resolve) => {
            this.raceGroups.set(groupId, {
                streamIds,
                resolve,
                settled: false,
            });
            // Listen for FIN on each stream
            for (const id of streamIds) {
                this.onStreamEnd(id, () => {
                    this.settleRace(groupId, id);
                });
            }
        });
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Collapse: wait for all streams, merge results
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Collapse multiple streams: wait for all to complete (or poison),
     * then merge their results.
     *
     * @param streamIds Streams to collapse
     * @param merger Function that merges results from all streams
     * @returns Promise resolving with the merged result
     */
    collapse(streamIds, merger) {
        if (streamIds.length < 1) {
            throw new RangeError('Collapse requires at least 1 stream');
        }
        // Mark all streams as collapsing
        for (const id of streamIds) {
            const stream = this.requireStream(id);
            stream.state = 'collapsing';
        }
        // Send COLLAPSE frame on each stream
        for (const id of streamIds) {
            this.sendFrame(id, COLLAPSE, new Uint8Array(0));
        }
        const groupId = `collapse-${streamIds.join('-')}-${Date.now()}`;
        return new Promise((resolve) => {
            const group = {
                streamIds,
                merger,
                resolve,
                results: new Map(),
                completed: new Set(),
                settled: false,
            };
            this.collapseGroups.set(groupId, group);
            // Listen for FIN or POISON on each stream
            for (const id of streamIds) {
                this.onStreamEnd(id, () => {
                    this.settleCollapse(groupId, id, false);
                });
                this.onStreamPoisoned(id, () => {
                    this.settleCollapse(groupId, id, true);
                });
            }
        });
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Send / Poison / Close
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Send a payload on a stream.
     */
    send(streamId, payload, flags = 0) {
        const stream = this.requireStream(streamId);
        // Backpressure check
        if (stream.bufferedFrames >= this.config.highWaterMark) {
            throw new Error(`Stream ${streamId} backpressure: ${stream.bufferedFrames} frames buffered (high-water mark: ${this.config.highWaterMark})`);
        }
        // Accumulate locally so race/collapse can read results
        if (payload.length > 0) {
            stream.results.push(payload);
        }
        stream.bufferedFrames++;
        this.sendFrame(streamId, flags, payload);
    }
    /**
     * Finish a stream. Sends a FIN frame and transitions to 'closed'.
     *
     * @param streamId Stream to finish
     * @param finalPayload Optional final payload to include with the FIN
     */
    finish(streamId, finalPayload) {
        const stream = this.requireStream(streamId);
        // Accumulate final payload locally
        if (finalPayload && finalPayload.length > 0) {
            stream.results.push(finalPayload);
        }
        this.sendFrame(streamId, FIN, finalPayload ?? new Uint8Array(0));
        stream.state = 'closed';
        // Notify end handlers
        const handlers = this.endHandlers.get(streamId);
        if (handlers) {
            for (const handler of handlers) {
                handler();
            }
        }
    }
    /**
     * Poison a stream. Sends a POISON frame and propagates to all descendants.
     *
     * Poisoning is the protocol-level equivalent of NaN propagation,
     * AbortSignal cancellation, or error cascading.
     */
    poison(streamId) {
        const stream = this.streams.get(streamId);
        if (!stream || stream.state === 'poisoned' || stream.state === 'closed') {
            return; // Already dead
        }
        stream.state = 'poisoned';
        this.sendFrame(streamId, POISON, new Uint8Array(0));
        // Notify poison handlers
        const handlers = this.poisonHandlers.get(streamId);
        if (handlers) {
            for (const handler of handlers) {
                handler();
            }
        }
        // Propagate poison to all children (recursively)
        for (const childId of stream.children) {
            this.poison(childId);
        }
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Event handlers
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Register a handler for frames arriving on a specific stream.
     */
    onFrame(streamId, handler) {
        let handlers = this.frameHandlers.get(streamId);
        if (!handlers) {
            handlers = new Set();
            this.frameHandlers.set(streamId, handlers);
        }
        handlers.add(handler);
        return () => { handlers.delete(handler); };
    }
    /**
     * Register a handler for when a stream ends (FIN received).
     */
    onStreamEnd(streamId, handler) {
        let handlers = this.endHandlers.get(streamId);
        if (!handlers) {
            handlers = new Set();
            this.endHandlers.set(streamId, handlers);
        }
        handlers.add(handler);
        return () => { handlers.delete(handler); };
    }
    /**
     * Register a handler for when a stream is poisoned.
     */
    onStreamPoisoned(streamId, handler) {
        let handlers = this.poisonHandlers.get(streamId);
        if (!handlers) {
            handlers = new Set();
            this.poisonHandlers.set(streamId, handlers);
        }
        handlers.add(handler);
        return () => { handlers.delete(handler); };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Destroy
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Close the protocol and underlying transport.
     * Poisons all open streams first.
     */
    destroy() {
        for (const [id, stream] of this.streams) {
            if (stream.state !== 'closed' && stream.state !== 'poisoned') {
                stream.state = 'closed';
            }
        }
        this.streams.clear();
        this.frameHandlers.clear();
        this.endHandlers.clear();
        this.poisonHandlers.clear();
        this.raceGroups.clear();
        this.collapseGroups.clear();
        this.transport.close();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Private: incoming frame handling
    // ═══════════════════════════════════════════════════════════════════════
    handleIncoming(data) {
        // Decode all frames from the received buffer
        let frames;
        try {
            frames = this.codec.decodeBatch(data);
        }
        catch {
            // Malformed data — nothing to do
            return;
        }
        for (const frame of frames) {
            this.handleFrame(frame);
        }
    }
    handleFrame(frame) {
        const { streamId, flags } = frame;
        // Auto-create stream if we receive a frame on an unknown stream
        // (the remote opened it)
        if (!this.streams.has(streamId)) {
            this.createStream(streamId);
        }
        const stream = this.streams.get(streamId);
        // Handle control flags
        if (flags & POISON) {
            this.poison(streamId);
            return;
        }
        if (flags & FIN) {
            // Accumulate final payload if present
            if (frame.payload.length > 0) {
                stream.results.push(frame.payload);
            }
            stream.state = 'closed';
            // Notify end handlers
            const endHandlers = this.endHandlers.get(streamId);
            if (endHandlers) {
                for (const handler of endHandlers) {
                    handler();
                }
            }
            return;
        }
        if (flags & FORK) {
            // Remote is notifying us about forked child streams
            // Parse child IDs from payload (u16 pairs)
            for (let i = 0; i + 1 < frame.payload.length; i += 2) {
                const childId = (frame.payload[i] << 8) | frame.payload[i + 1];
                if (!this.streams.has(childId)) {
                    this.createStream(childId, streamId);
                }
                if (!stream.children.includes(childId)) {
                    stream.children.push(childId);
                }
            }
            return;
        }
        // Data frame — accumulate result and notify handlers
        if (frame.payload.length > 0) {
            stream.results.push(frame.payload);
        }
        stream.bufferedFrames++;
        const handlers = this.frameHandlers.get(streamId);
        if (handlers) {
            for (const handler of handlers) {
                handler(frame);
            }
        }
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Private: race/collapse settlement
    // ═══════════════════════════════════════════════════════════════════════
    settleRace(groupId, winnerId) {
        const group = this.raceGroups.get(groupId);
        if (!group || group.settled)
            return;
        group.settled = true;
        const winnerStream = this.streams.get(winnerId);
        const result = winnerStream
            ? this.concatenateResults(winnerStream.results)
            : new Uint8Array(0);
        // Poison all losers
        for (const id of group.streamIds) {
            if (id !== winnerId) {
                this.poison(id);
            }
        }
        group.resolve({ winner: winnerId, result });
        this.raceGroups.delete(groupId);
    }
    settleCollapse(groupId, streamId, wasPoisoned) {
        const group = this.collapseGroups.get(groupId);
        if (!group || group.settled)
            return;
        group.completed.add(streamId);
        if (!wasPoisoned) {
            const stream = this.streams.get(streamId);
            if (stream) {
                group.results.set(streamId, this.concatenateResults(stream.results));
            }
        }
        // Poisoned streams contribute nothing to the merge
        // Check if all streams have completed or been poisoned
        if (group.completed.size >= group.streamIds.length) {
            group.settled = true;
            const merged = group.merger(group.results);
            group.resolve(merged);
            this.collapseGroups.delete(groupId);
        }
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Private: stream helpers
    // ═══════════════════════════════════════════════════════════════════════
    allocateStreamId() {
        if (this.config.role === 'client') {
            const id = this.nextEvenId;
            this.nextEvenId += 2;
            return id;
        }
        else {
            const id = this.nextOddId;
            this.nextOddId += 2;
            return id;
        }
    }
    createStream(id, parent) {
        const stream = {
            id,
            state: 'open',
            parent,
            children: [],
            nextSequence: 0,
            bufferedFrames: 0,
            results: [],
        };
        this.streams.set(id, stream);
        return stream;
    }
    requireStream(streamId, ...allowedStates) {
        const stream = this.streams.get(streamId);
        if (!stream) {
            throw new Error(`Stream ${streamId} does not exist`);
        }
        if (allowedStates.length > 0 &&
            !allowedStates.includes(stream.state)) {
            throw new Error(`Stream ${streamId} is in state '${stream.state}', expected one of: ${allowedStates.join(', ')}`);
        }
        return stream;
    }
    sendFrame(streamId, flags, payload) {
        const stream = this.streams.get(streamId);
        if (!stream)
            return;
        const frame = {
            streamId,
            sequence: stream.nextSequence++,
            flags,
            payload,
        };
        const encoded = this.codec.encode(frame);
        this.transport.send(encoded);
    }
    concatenateResults(chunks) {
        if (chunks.length === 0)
            return new Uint8Array(0);
        if (chunks.length === 1)
            return chunks[0];
        let totalLen = 0;
        for (const chunk of chunks)
            totalLen += chunk.length;
        const result = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    }
}
