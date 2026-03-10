/**
 * TCP Flow Transport
 *
 * FlowTransport adapter for Node/Bun TCP sockets.
 * Enables flow protocol between server processes —
 * coordinator ↔ layer nodes, forge ↔ deploy targets.
 *
 * Uses length-prefixed framing over raw TCP to delineate
 * flow frame boundaries. Each message is:
 *   [u32 length][payload bytes]
 *
 * This is the backbone transport for server-to-server
 * Aeon protocol communication.
 */

import type { FlowTransport } from '../flow/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface TCPFlowConfig {
  /** Host to connect to (client) or bind to (server) */
  host?: string;
  /** Port number */
  port: number;
  /** Connection timeout in ms (default: 10000) */
  connectTimeout?: number;
  /** Keep-alive interval in ms (default: 30000) */
  keepAliveMs?: number;
}

/** Minimal TCP socket interface — works with Node net.Socket and Bun */
interface TCPSocket {
  write(data: Uint8Array): boolean;
  on(event: 'data', handler: (data: Buffer | Uint8Array) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
  end(): void;
  destroy(): void;
  setKeepAlive?(enable: boolean, initialDelay?: number): void;
  setNoDelay?(noDelay?: boolean): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Length-Prefixed Framing
// ═══════════════════════════════════════════════════════════════════════════════

/** 4 bytes for u32 length prefix */
const LENGTH_PREFIX_SIZE = 4;

/**
 * Encode a message with a u32 length prefix.
 */
function encodeFrame(data: Uint8Array): Uint8Array {
  const frame = new Uint8Array(LENGTH_PREFIX_SIZE + data.byteLength);
  const view = new DataView(frame.buffer);
  view.setUint32(0, data.byteLength, false); // big-endian
  frame.set(data, LENGTH_PREFIX_SIZE);
  return frame;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TCP FlowTransport
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FlowTransport over TCP with length-prefixed framing.
 *
 * Handles message boundary detection (TCP is a stream, not message-oriented).
 * Uses a u32 length prefix so the receiver knows exactly how many bytes
 * to read for each flow frame.
 */
export class TCPFlowTransport implements FlowTransport {
  private socket: TCPSocket;
  private receiveHandler: ((data: Uint8Array) => void) | null = null;
  private closed = false;

  /** Reassembly buffer for TCP stream → discrete messages */
  private rxBuffer: Uint8Array = new Uint8Array(0);

  constructor(socket: TCPSocket, config?: Partial<TCPFlowConfig>) {
    this.socket = socket;

    // TCP optimizations
    socket.setNoDelay?.(true); // Disable Nagle for low-latency
    socket.setKeepAlive?.(true, config?.keepAliveMs ?? 30_000);

    // Wire up receive
    socket.on('data', (chunk: Buffer | Uint8Array) => {
      this.onData(new Uint8Array(chunk));
    });

    socket.on('close', () => {
      this.closed = true;
      this.receiveHandler = null;
    });

    socket.on('error', () => {
      // Errors are followed by close
    });
  }

  // ─── FlowTransport interface ───────────────────────────────────────

  send(data: Uint8Array): void {
    if (this.closed) return;
    const frame = encodeFrame(data);
    this.socket.write(frame);
  }

  onReceive(handler: (data: Uint8Array) => void): void {
    this.receiveHandler = handler;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.receiveHandler = null;
    this.socket.end();
  }

  /** Whether the transport is still open */
  get isOpen(): boolean {
    return !this.closed;
  }

  // ─── Internal: Stream Reassembly ──────────────────────────────────

  private onData(chunk: Uint8Array): void {
    // Append to reassembly buffer
    const combined = new Uint8Array(this.rxBuffer.byteLength + chunk.byteLength);
    combined.set(this.rxBuffer);
    combined.set(chunk, this.rxBuffer.byteLength);
    this.rxBuffer = combined;

    // Extract complete messages
    while (this.rxBuffer.byteLength >= LENGTH_PREFIX_SIZE) {
      const view = new DataView(
        this.rxBuffer.buffer,
        this.rxBuffer.byteOffset,
        this.rxBuffer.byteLength
      );
      const msgLen = view.getUint32(0, false); // big-endian

      if (this.rxBuffer.byteLength < LENGTH_PREFIX_SIZE + msgLen) {
        break; // Incomplete message — wait for more data
      }

      // Extract the complete message
      const message = this.rxBuffer.slice(
        LENGTH_PREFIX_SIZE,
        LENGTH_PREFIX_SIZE + msgLen
      );

      // Advance the buffer
      this.rxBuffer = this.rxBuffer.slice(LENGTH_PREFIX_SIZE + msgLen);

      // Deliver
      this.receiveHandler?.(message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory: Create TCP FlowTransport from connection params
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a TCP FlowTransport by connecting to a remote host.
 *
 * Uses dynamic import of 'net' so this module is tree-shakeable
 * in browser builds.
 *
 * @param host - Remote host
 * @param port - Remote port
 * @param config - Optional TCP configuration
 */
export async function connectTCPFlow(
  host: string,
  port: number,
  config?: Partial<TCPFlowConfig>
): Promise<TCPFlowTransport> {
  const net = await import('net');
  const timeout = config?.connectTimeout ?? 10_000;

  return new Promise<TCPFlowTransport>((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      resolve(new TCPFlowTransport(socket, config));
    });

    socket.setTimeout(timeout);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`TCP connection timeout to ${host}:${port}`));
    });

    socket.on('error', (err) => {
      reject(new Error(`TCP connection failed to ${host}:${port}: ${err.message}`));
    });
  });
}

/**
 * Create a TCP flow server that accepts incoming connections.
 *
 * Each accepted connection becomes a FlowTransport.
 *
 * @param port - Port to listen on
 * @param host - Host to bind to (default: '0.0.0.0')
 * @param onConnection - Called for each new flow transport connection
 */
export async function listenTCPFlow(
  port: number,
  host: string,
  onConnection: (transport: TCPFlowTransport) => void
): Promise<{ close: () => void }> {
  const net = await import('net');

  const server = net.createServer((socket) => {
    const transport = new TCPFlowTransport(socket);
    onConnection(transport);
  });

  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      resolve({
        close: () => server.close(),
      });
    });

    server.on('error', (err) => {
      reject(new Error(`TCP flow server failed on ${host}:${port}: ${err.message}`));
    });
  });
}
