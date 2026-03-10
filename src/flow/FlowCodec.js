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
/** Header size in bytes */
export const HEADER_SIZE = 10;
/** Maximum payload length (2^24 - 1 = 16,777,215 bytes ≈ 16 MB) */
export const MAX_PAYLOAD_LENGTH = 0xFFFFFF;
/**
 * FlowCodec — binary encoder/decoder for FlowFrames.
 *
 * Create via `FlowCodec.create()` which attempts WASM acceleration,
 * falling back to the pure JS path (which is always available).
 */
export class FlowCodec {
    wasmInstance = null;
    constructor(wasmInstance) {
        this.wasmInstance = wasmInstance;
    }
    /**
     * Create a FlowCodec. Tries WASM acceleration, falls back to JS.
     * The JS path is always correct — WASM is a performance optimization only.
     */
    static async create() {
        // WASM acceleration is a future enhancement.
        // For now, always use the pure JS path which is correct and portable.
        return new FlowCodec(null);
    }
    /**
     * Create a FlowCodec synchronously (JS-only, no WASM attempt).
     */
    static createSync() {
        return new FlowCodec(null);
    }
    /**
     * Whether WASM acceleration is active.
     */
    get isWasmAccelerated() {
        return this.wasmInstance !== null;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Encode
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Encode a single FlowFrame into a binary buffer.
     *
     * Returns a new Uint8Array containing the 10-byte header followed by
     * the payload bytes.
     */
    encode(frame) {
        const payloadLen = frame.payload.length;
        if (payloadLen > MAX_PAYLOAD_LENGTH) {
            throw new RangeError(`Payload length ${payloadLen} exceeds maximum ${MAX_PAYLOAD_LENGTH}`);
        }
        const buf = new Uint8Array(HEADER_SIZE + payloadLen);
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        // stream_id: u16
        view.setUint16(0, frame.streamId);
        // sequence: u32
        view.setUint32(2, frame.sequence);
        // flags: u8
        buf[6] = frame.flags;
        // length: u24 big-endian
        buf[7] = (payloadLen >>> 16) & 0xFF;
        buf[8] = (payloadLen >>> 8) & 0xFF;
        buf[9] = payloadLen & 0xFF;
        // payload
        buf.set(frame.payload, HEADER_SIZE);
        return buf;
    }
    /**
     * Decode a single FlowFrame from a buffer at the given offset.
     *
     * The returned frame's `payload` is a zerocopy view into the original
     * buffer — no data is copied. Callers who need the payload to outlive
     * the original buffer should `.slice()` it.
     *
     * @returns The decoded frame and the number of bytes consumed.
     */
    decode(buffer, offset = 0) {
        if (buffer.length - offset < HEADER_SIZE) {
            throw new RangeError(`Buffer too small: need at least ${HEADER_SIZE} bytes, have ${buffer.length - offset}`);
        }
        const view = new DataView(buffer.buffer, buffer.byteOffset + offset, buffer.byteLength - offset);
        const streamId = view.getUint16(0);
        const sequence = view.getUint32(2);
        const flags = buffer[offset + 6];
        const length = (buffer[offset + 7] << 16) |
            (buffer[offset + 8] << 8) |
            buffer[offset + 9];
        if (buffer.length - offset - HEADER_SIZE < length) {
            throw new RangeError(`Buffer too small for payload: need ${length} bytes, have ${buffer.length - offset - HEADER_SIZE}`);
        }
        // Zerocopy: payload is a view into the original buffer
        const payload = buffer.subarray(offset + HEADER_SIZE, offset + HEADER_SIZE + length);
        return {
            frame: { streamId, sequence, flags, payload },
            bytesRead: HEADER_SIZE + length,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // Batch encode/decode
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Encode multiple frames into a single contiguous buffer.
     *
     * Frames are laid out sequentially: [header+payload][header+payload]...
     */
    encodeBatch(frames) {
        // Calculate total size
        let totalSize = 0;
        for (const frame of frames) {
            if (frame.payload.length > MAX_PAYLOAD_LENGTH) {
                throw new RangeError(`Payload length ${frame.payload.length} exceeds maximum ${MAX_PAYLOAD_LENGTH}`);
            }
            totalSize += HEADER_SIZE + frame.payload.length;
        }
        const buf = new Uint8Array(totalSize);
        let writeOffset = 0;
        for (const frame of frames) {
            const encoded = this.encode(frame);
            buf.set(encoded, writeOffset);
            writeOffset += encoded.length;
        }
        return buf;
    }
    /**
     * Decode all frames from a contiguous buffer.
     *
     * Payloads are zerocopy views into the original buffer.
     */
    decodeBatch(buffer) {
        const frames = [];
        let offset = 0;
        while (offset < buffer.length) {
            // Need at least a header to continue
            if (buffer.length - offset < HEADER_SIZE) {
                throw new RangeError(`Truncated frame at offset ${offset}: need ${HEADER_SIZE} bytes, have ${buffer.length - offset}`);
            }
            const { frame, bytesRead } = this.decode(buffer, offset);
            frames.push(frame);
            offset += bytesRead;
        }
        return frames;
    }
}
