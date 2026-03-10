/**
 * IPC Flow Transport
 *
 * FlowTransport adapter for inter-process communication:
 *   - MessagePort (Web Workers, SharedWorker, BroadcastChannel)
 *   - MessageChannel (Node/Bun worker_threads)
 *   - child_process IPC (Node fork)
 *
 * Enables flow protocol between:
 *   - Main thread ↔ inference Web Worker (browser)
 *   - Shell process ↔ forge daemon (local)
 *   - Any two processes on the same machine
 *
 * Zero-copy when possible — transfers ArrayBuffers via
 * structured clone's transfer list.
 */
// ═══════════════════════════════════════════════════════════════════════════════
// MessagePort FlowTransport
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * FlowTransport over MessagePort (Web Workers, worker_threads, BroadcastChannel).
 *
 * Uses structured clone for binary transfer. When `transferBuffers` is true,
 * the ArrayBuffer backing the Uint8Array is transferred (zero-copy) rather
 * than cloned. This is faster but invalidates the sender's reference.
 */
export class MessagePortFlowTransport {
    port;
    receiveHandler = null;
    closed = false;
    transferBuffers;
    messageHandler = null;
    constructor(port, config) {
        this.port = port;
        this.transferBuffers = config?.transferBuffers ?? false;
        // Start the port if needed (Web MessagePort requires start())
        port.start?.();
        // Wire up receive
        this.messageHandler = (event) => {
            if (!this.receiveHandler)
                return;
            const data = event.data;
            if (data instanceof ArrayBuffer) {
                this.receiveHandler(new Uint8Array(data));
            }
            else if (data instanceof Uint8Array) {
                this.receiveHandler(data);
            }
            else if (data?.type === 'aeon-flow' && data.buffer instanceof ArrayBuffer) {
                this.receiveHandler(new Uint8Array(data.buffer));
            }
        };
        if (port.addEventListener) {
            port.addEventListener('message', this.messageHandler);
        }
        else {
            port.onmessage = this.messageHandler;
        }
    }
    // ─── FlowTransport interface ───────────────────────────────────────
    send(data) {
        if (this.closed)
            return;
        if (this.transferBuffers) {
            // Zero-copy transfer — sender loses access to the buffer
            const copy = new Uint8Array(data); // copy first since we transfer
            this.port.postMessage(copy.buffer, [copy.buffer]);
        }
        else {
            // Structured clone — data is copied, sender retains access
            this.port.postMessage({ type: 'aeon-flow', buffer: data.buffer.slice(0) });
        }
    }
    onReceive(handler) {
        this.receiveHandler = handler;
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        if (this.messageHandler) {
            if (this.port.removeEventListener) {
                this.port.removeEventListener('message', this.messageHandler);
            }
            else {
                this.port.onmessage = null;
            }
        }
        this.receiveHandler = null;
        this.port.close?.();
    }
    /** Whether the transport is still open */
    get isOpen() {
        return !this.closed;
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// ChildProcess FlowTransport
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * FlowTransport over Node child_process IPC.
 *
 * Uses process.send()/process.on('message') for fork()-based IPC.
 * Messages are serialized via V8's structured clone, so Uint8Array
 * arrives as a Buffer on the other side.
 */
export class ChildProcessFlowTransport {
    process;
    receiveHandler = null;
    closed = false;
    ipcHandler = null;
    constructor(childProcess) {
        this.process = childProcess;
        this.ipcHandler = (data) => {
            if (!this.receiveHandler)
                return;
            if (data instanceof Uint8Array || Buffer.isBuffer(data)) {
                this.receiveHandler(new Uint8Array(data));
            }
            else if (typeof data === 'object' &&
                data !== null &&
                data.type === 'aeon-flow') {
                const buffer = data.buffer;
                if (buffer instanceof ArrayBuffer) {
                    this.receiveHandler(new Uint8Array(buffer));
                }
                else if (typeof buffer === 'object' &&
                    buffer !== null &&
                    'data' in buffer) {
                    // V8 serialization turns Uint8Array into { type: 'Buffer', data: [...] }
                    const arr = buffer.data;
                    this.receiveHandler(new Uint8Array(arr));
                }
            }
        };
        childProcess.on('message', this.ipcHandler);
        childProcess.on('exit', () => {
            this.closed = true;
            this.receiveHandler = null;
        });
    }
    // ─── FlowTransport interface ───────────────────────────────────────
    send(data) {
        if (this.closed)
            return;
        // Wrap in an envelope so receiver can identify aeon-flow messages
        // among other IPC traffic
        this.process.send({
            type: 'aeon-flow',
            buffer: Array.from(data), // Serialize as plain array for V8 IPC
        });
    }
    onReceive(handler) {
        this.receiveHandler = handler;
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        if (this.ipcHandler && this.process.removeListener) {
            this.process.removeListener('message', this.ipcHandler);
        }
        this.receiveHandler = null;
    }
    /** Whether the transport is still open */
    get isOpen() {
        return !this.closed;
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// Factory: Create IPC pair (for testing or in-process use)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Create a pair of linked MessagePort FlowTransports.
 *
 * Uses MessageChannel to create a bidirectional pair —
 * data sent on one arrives on the other.
 *
 * Works in browsers, Bun, and Node (with worker_threads).
 */
export function createIPCPair(config) {
    const channel = new MessageChannel();
    return [
        new MessagePortFlowTransport(channel.port1, config),
        new MessagePortFlowTransport(channel.port2, config),
    ];
}
