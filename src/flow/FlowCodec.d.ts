/**
 * Aeon Flow Codec — Binary Frame Layer
 *
 * Encodes and decodes FlowFrames into a compact 10-byte header + payload
 * binary wire format. Optionally accelerated by WASM; falls back to pure JS.
 *
 * Wire format (10 bytes header):
 *   [0..1]  stream_id  u16 big-endian
 *   [2..5]  sequence   u32 big-endian
 *   [6]     flags      u8
 *   [7..9]  length     u24 big-endian (payload bytes, max 16 MB)
 *
 * The codec is zerocopy where possible: decode returns a Uint8Array view
 * into the original buffer rather than copying payload bytes.
 *
 * @see docs/ebooks/145-log-rolling-pipelined-prefill/ch14-aeon-flow-protocol.md
 */
import type { FlowFrame } from './types';
/** Header size in bytes */
export declare const HEADER_SIZE = 10;
/** Maximum payload length (2^24 - 1 = 16,777,215 bytes ≈ 16 MB) */
export declare const MAX_PAYLOAD_LENGTH = 16777215;
/**
 * FlowCodec — binary encoder/decoder for FlowFrames.
 *
 * Create via `FlowCodec.create()` which attempts WASM acceleration,
 * falling back to the pure JS path (which is always available).
 */
export declare class FlowCodec {
    private wasmInstance;
    private constructor();
    /**
     * Create a FlowCodec. Tries WASM acceleration, falls back to JS.
     * The JS path is always correct — WASM is a performance optimization only.
     */
    static create(): Promise<FlowCodec>;
    /**
     * Create a FlowCodec synchronously (JS-only, no WASM attempt).
     */
    static createSync(): FlowCodec;
    /**
     * Whether WASM acceleration is active.
     */
    get isWasmAccelerated(): boolean;
    /**
     * Encode a single FlowFrame into a binary buffer.
     *
     * Returns a new Uint8Array containing the 10-byte header followed by
     * the payload bytes.
     */
    encode(frame: FlowFrame): Uint8Array;
    /**
     * Decode a single FlowFrame from a buffer at the given offset.
     *
     * The returned frame's `payload` is a zerocopy view into the original
     * buffer — no data is copied. Callers who need the payload to outlive
     * the original buffer should `.slice()` it.
     *
     * @returns The decoded frame and the number of bytes consumed.
     */
    decode(buffer: Uint8Array, offset?: number): {
        frame: FlowFrame;
        bytesRead: number;
    };
    /**
     * Encode multiple frames into a single contiguous buffer.
     *
     * Frames are laid out sequentially: [header+payload][header+payload]...
     */
    encodeBatch(frames: FlowFrame[]): Uint8Array;
    /**
     * Decode all frames from a contiguous buffer.
     *
     * Payloads are zerocopy views into the original buffer.
     */
    decodeBatch(buffer: Uint8Array): FlowFrame[];
}
