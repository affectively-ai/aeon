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
export const HEADER_SIZE = 10;

/** Maximum payload length (2^24 - 1 = 16,777,215 bytes ≈ 16 MB) */
export const MAX_PAYLOAD_LENGTH = 0xFFFFFF;

type WasmMode = 'auto' | 'off' | 'force';
type WasmModuleInput = WebAssembly.Module | BufferSource;

export interface FlowCodecCreateOptions {
  /**
   * WASM mode:
   * - auto: try WASM, fallback to JS on any failure (default)
   * - off: force JS path
   * - force: require WASM, throw if unavailable
   */
  wasmMode?: WasmMode;
  /**
   * Optional caller-supplied WASM module or bytes.
   * Useful in Node/Bun where the caller controls file loading.
   */
  wasmModule?: WasmModuleInput;
}

interface FlowCodecWasmExports {
  memory: WebAssembly.Memory;
  allocate: (size: number) => number;
  decodeFrame: (
    framePtr: number,
    streamIdPtr: number,
    sequencePtr: number,
    flagsPtr: number,
    lengthPtr: number
  ) => number;
}

interface FlowCodecWasmState {
  exports: FlowCodecWasmExports;
  framePtr: number;
  streamIdPtr: number;
  sequencePtr: number;
  flagsPtr: number;
  lengthPtr: number;
  memoryBytes: Uint8Array;
  memoryView: DataView;
}

interface DecodedHeader {
  streamId: number;
  sequence: number;
  flags: number;
  length: number;
}

/**
 * FlowCodec — binary encoder/decoder for FlowFrames.
 *
 * Create via `FlowCodec.create()` which attempts WASM acceleration,
 * falling back to the pure JS path (which is always available).
 */
export class FlowCodec {
  private wasmInstance: WebAssembly.Instance | null = null;
  private wasmState: FlowCodecWasmState | null = null;

  private constructor(wasmInstance: WebAssembly.Instance | null) {
    this.wasmInstance = wasmInstance;
    if (wasmInstance) {
      this.wasmState = FlowCodec.createWasmState(wasmInstance);
      if (!this.wasmState) {
        this.wasmInstance = null;
      }
    }
  }

  /**
   * Create a FlowCodec. Tries WASM acceleration, falls back to JS.
   * The JS path is always correct — WASM is a performance optimization only.
   */
  static async create(options: FlowCodecCreateOptions = {}): Promise<FlowCodec> {
    const wasmMode = options.wasmMode ?? 'auto';
    if (wasmMode === 'off') {
      return new FlowCodec(null);
    }
    if (typeof WebAssembly === 'undefined') {
      if (wasmMode === 'force') {
        throw new Error('FlowCodec WASM requested in force mode, but WebAssembly is unavailable');
      }
      return new FlowCodec(null);
    }

    let source: WasmModuleInput | null = options.wasmModule ?? null;
    if (!source) {
      source = await FlowCodec.loadDefaultWasmModule();
      if (!source) {
        if (wasmMode === 'force') {
          throw new Error(
            'FlowCodec WASM module not found (expected src/flow/wasm/aeon-flow-codec.wasm)',
          );
        }
        return new FlowCodec(null);
      }
    }

    try {
      const wasmInstance = await FlowCodec.instantiateWasm(source);
      const codec = new FlowCodec(wasmInstance);
      if (codec.isWasmAccelerated) return codec;
      if (wasmMode === 'force') {
        throw new Error('FlowCodec WASM exports are missing required symbols');
      }
      return new FlowCodec(null);
    } catch (error) {
      if (wasmMode === 'force') {
        throw error;
      }
      return new FlowCodec(null);
    }
  }

  /**
   * Create a FlowCodec synchronously (JS-only, no WASM attempt).
   */
  static createSync(): FlowCodec {
    return new FlowCodec(null);
  }

  /**
   * Whether WASM acceleration is active.
   */
  get isWasmAccelerated(): boolean {
    return this.wasmInstance !== null && this.wasmState !== null;
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
  encode(frame: FlowFrame): Uint8Array {
    const payloadLen = frame.payload.length;
    if (payloadLen > MAX_PAYLOAD_LENGTH) {
      throw new RangeError(
        `Payload length ${payloadLen} exceeds maximum ${MAX_PAYLOAD_LENGTH}`
      );
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
  decode(
    buffer: Uint8Array,
    offset = 0
  ): { frame: FlowFrame; bytesRead: number } {
    if (buffer.length - offset < HEADER_SIZE) {
      throw new RangeError(
        `Buffer too small: need at least ${HEADER_SIZE} bytes, have ${buffer.length - offset}`
      );
    }

    const header = this.decodeHeader(buffer, offset);
    const { streamId, sequence, flags, length } = header;

    if (buffer.length - offset - HEADER_SIZE < length) {
      throw new RangeError(
        `Buffer too small for payload: need ${length} bytes, have ${buffer.length - offset - HEADER_SIZE}`
      );
    }

    // Zerocopy: payload is a view into the original buffer
    const payload = buffer.subarray(
      offset + HEADER_SIZE,
      offset + HEADER_SIZE + length
    );

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
  encodeBatch(frames: FlowFrame[]): Uint8Array {
    // Calculate total size
    let totalSize = 0;
    for (const frame of frames) {
      if (frame.payload.length > MAX_PAYLOAD_LENGTH) {
        throw new RangeError(
          `Payload length ${frame.payload.length} exceeds maximum ${MAX_PAYLOAD_LENGTH}`
        );
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
  decodeBatch(buffer: Uint8Array): FlowFrame[] {
    const frames: FlowFrame[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      // Need at least a header to continue
      if (buffer.length - offset < HEADER_SIZE) {
        throw new RangeError(
          `Truncated frame at offset ${offset}: need ${HEADER_SIZE} bytes, have ${buffer.length - offset}`
        );
      }

      const { frame, bytesRead } = this.decode(buffer, offset);
      frames.push(frame);
      offset += bytesRead;
    }

    return frames;
  }

  private decodeHeader(buffer: Uint8Array, offset: number): DecodedHeader {
    if (!this.wasmState) {
      return this.decodeHeaderInJavaScript(buffer, offset);
    }
    return this.decodeHeaderWithWasm(buffer, offset);
  }

  private decodeHeaderInJavaScript(
    buffer: Uint8Array,
    offset: number,
  ): DecodedHeader {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset + offset,
      buffer.byteLength - offset
    );

    return {
      streamId: view.getUint16(0),
      sequence: view.getUint32(2),
      flags: buffer[offset + 6],
      length:
        (buffer[offset + 7] << 16) |
        (buffer[offset + 8] << 8) |
        buffer[offset + 9],
    };
  }

  private decodeHeaderWithWasm(
    buffer: Uint8Array,
    offset: number,
  ): DecodedHeader {
    const wasmState = this.wasmState;
    if (!wasmState) {
      return this.decodeHeaderInJavaScript(buffer, offset);
    }

    this.refreshWasmViews(wasmState);
    wasmState.memoryBytes.set(
      buffer.subarray(offset, offset + HEADER_SIZE),
      wasmState.framePtr,
    );

    const bytesRead = wasmState.exports.decodeFrame(
      wasmState.framePtr,
      wasmState.streamIdPtr,
      wasmState.sequencePtr,
      wasmState.flagsPtr,
      wasmState.lengthPtr,
    );

    if (bytesRead !== HEADER_SIZE) {
      throw new RangeError(
        `WASM decoder returned invalid header size ${bytesRead} (expected ${HEADER_SIZE})`,
      );
    }

    return {
      streamId: wasmState.memoryView.getUint16(wasmState.streamIdPtr, true),
      sequence: wasmState.memoryView.getUint32(wasmState.sequencePtr, true),
      flags: wasmState.memoryBytes[wasmState.flagsPtr],
      length: wasmState.memoryView.getUint32(wasmState.lengthPtr, true),
    };
  }

  private refreshWasmViews(state: FlowCodecWasmState): void {
    if (state.memoryBytes.buffer === state.exports.memory.buffer) {
      return;
    }

    state.memoryBytes = new Uint8Array(state.exports.memory.buffer);
    state.memoryView = new DataView(state.exports.memory.buffer);
  }

  private static createWasmState(
    wasmInstance: WebAssembly.Instance,
  ): FlowCodecWasmState | null {
    const exports = wasmInstance.exports as Record<string, unknown>;
    const memory = exports.memory;
    const allocate = exports.allocate;
    const decodeFrame = exports.decode_frame;

    if (!(memory instanceof WebAssembly.Memory)) return null;
    if (typeof allocate !== 'function') return null;
    if (typeof decodeFrame !== 'function') return null;

    const wasmExports: FlowCodecWasmExports = {
      memory,
      allocate: allocate as FlowCodecWasmExports['allocate'],
      decodeFrame: decodeFrame as FlowCodecWasmExports['decodeFrame'],
    };

    const framePtr = wasmExports.allocate(HEADER_SIZE);
    const streamIdPtr = wasmExports.allocate(2);
    const sequencePtr = wasmExports.allocate(4);
    const flagsPtr = wasmExports.allocate(1);
    const lengthPtr = wasmExports.allocate(4);

    return {
      exports: wasmExports,
      framePtr,
      streamIdPtr,
      sequencePtr,
      flagsPtr,
      lengthPtr,
      memoryBytes: new Uint8Array(memory.buffer),
      memoryView: new DataView(memory.buffer),
    };
  }

  private static async instantiateWasm(
    source: WasmModuleInput,
  ): Promise<WebAssembly.Instance> {
    if (source instanceof WebAssembly.Module) {
      return new WebAssembly.Instance(source, {});
    }

    const bytes = FlowCodec.toUint8Array(source);
    const result: unknown = await WebAssembly.instantiate(bytes, {});
    if (result instanceof WebAssembly.Instance) {
      return result;
    }

    if (
      typeof result === 'object' &&
      result !== null &&
      'instance' in result
    ) {
      const maybeInstance = (result as { instance: unknown }).instance;
      if (maybeInstance instanceof WebAssembly.Instance) {
        return maybeInstance;
      }
    }

    throw new Error('Unexpected WebAssembly.instantiate result');
  }

  private static toUint8Array(source: BufferSource): Uint8Array {
    if (source instanceof ArrayBuffer) {
      return new Uint8Array(source);
    }

    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }

  private static async loadDefaultWasmModule(): Promise<Uint8Array | null> {
    if (typeof fetch !== 'function') return null;

    // Construct dynamically to avoid hard build-time asset coupling.
    const wasmPath = './wasm/' + 'aeon-flow-codec.wasm';
    const wasmUrl = new URL(wasmPath, import.meta.url);

    try {
      const response = await fetch(wasmUrl);
      if (!response.ok) return null;
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      return null;
    }
  }
}
