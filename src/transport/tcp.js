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
// ═══════════════════════════════════════════════════════════════════════════════
// Length-Prefixed Framing
// ═══════════════════════════════════════════════════════════════════════════════
/** 4 bytes for u32 length prefix */
const LENGTH_PREFIX_SIZE = 4;
/**
 * Encode a message with a u32 length prefix.
 */
function encodeFrame(data) {
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
export class TCPFlowTransport {
    socket;
    receiveHandler = null;
    closed = false;
    /** Reassembly buffer for TCP stream → discrete messages */
    rxBuffer = new Uint8Array(0);
    constructor(socket, config) {
        this.socket = socket;
        // TCP optimizations
        socket.setNoDelay?.(true); // Disable Nagle for low-latency
        socket.setKeepAlive?.(true, config?.keepAliveMs ?? 30_000);
        // Wire up receive
        socket.on('data', (chunk) => {
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
    send(data) {
        if (this.closed)
            return;
        const frame = encodeFrame(data);
        this.socket.write(frame);
    }
    onReceive(handler) {
        this.receiveHandler = handler;
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        this.receiveHandler = null;
        this.socket.end();
    }
    /** Whether the transport is still open */
    get isOpen() {
        return !this.closed;
    }
    // ─── Internal: Stream Reassembly ──────────────────────────────────
    onData(chunk) {
        // Append to reassembly buffer
        const combined = new Uint8Array(this.rxBuffer.byteLength + chunk.byteLength);
        combined.set(this.rxBuffer);
        combined.set(chunk, this.rxBuffer.byteLength);
        this.rxBuffer = combined;
        // Extract complete messages
        while (this.rxBuffer.byteLength >= LENGTH_PREFIX_SIZE) {
            const view = new DataView(this.rxBuffer.buffer, this.rxBuffer.byteOffset, this.rxBuffer.byteLength);
            const msgLen = view.getUint32(0, false); // big-endian
            if (this.rxBuffer.byteLength < LENGTH_PREFIX_SIZE + msgLen) {
                break; // Incomplete message — wait for more data
            }
            // Extract the complete message
            const message = this.rxBuffer.slice(LENGTH_PREFIX_SIZE, LENGTH_PREFIX_SIZE + msgLen);
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
export async function connectTCPFlow(host, port, config) {
    const net = await import('net');
    const timeout = config?.connectTimeout ?? 10_000;
    return new Promise((resolve, reject) => {
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
export async function listenTCPFlow(port, host, onConnection) {
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
