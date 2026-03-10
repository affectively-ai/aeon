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
import type { FlowTransport } from '../flow/types';
/**
 * Minimal MessagePort-like interface.
 * Covers Web Workers, worker_threads, BroadcastChannel.
 */
export interface MessagePortLike {
    postMessage(data: unknown, transfer?: Transferable[]): void;
    addEventListener?(type: 'message', handler: (event: MessageEvent) => void): void;
    removeEventListener?(type: 'message', handler: (event: MessageEvent) => void): void;
    onmessage?: ((event: MessageEvent) => void) | null;
    close?(): void;
    start?(): void;
}
/**
 * Minimal child_process-like interface for IPC.
 * Covers Node child_process.fork() results.
 */
export interface ChildProcessLike {
    send(data: unknown): boolean;
    on(event: 'message', handler: (data: unknown) => void): void;
    on(event: 'exit', handler: (code: number | null) => void): void;
    removeListener?(event: string, handler: (...args: unknown[]) => void): void;
    kill?(): void;
}
export interface IPCFlowConfig {
    /** Whether to transfer ArrayBuffers (zero-copy but invalidates sender's ref) */
    transferBuffers?: boolean;
}
/**
 * FlowTransport over MessagePort (Web Workers, worker_threads, BroadcastChannel).
 *
 * Uses structured clone for binary transfer. When `transferBuffers` is true,
 * the ArrayBuffer backing the Uint8Array is transferred (zero-copy) rather
 * than cloned. This is faster but invalidates the sender's reference.
 */
export declare class MessagePortFlowTransport implements FlowTransport {
    private port;
    private receiveHandler;
    private closed;
    private transferBuffers;
    private messageHandler;
    constructor(port: MessagePortLike, config?: IPCFlowConfig);
    send(data: Uint8Array): void;
    onReceive(handler: (data: Uint8Array) => void): void;
    close(): void;
    /** Whether the transport is still open */
    get isOpen(): boolean;
}
/**
 * FlowTransport over Node child_process IPC.
 *
 * Uses process.send()/process.on('message') for fork()-based IPC.
 * Messages are serialized via V8's structured clone, so Uint8Array
 * arrives as a Buffer on the other side.
 */
export declare class ChildProcessFlowTransport implements FlowTransport {
    private process;
    private receiveHandler;
    private closed;
    private ipcHandler;
    constructor(childProcess: ChildProcessLike);
    send(data: Uint8Array): void;
    onReceive(handler: (data: Uint8Array) => void): void;
    close(): void;
    /** Whether the transport is still open */
    get isOpen(): boolean;
}
/**
 * Create a pair of linked MessagePort FlowTransports.
 *
 * Uses MessageChannel to create a bidirectional pair —
 * data sent on one arrives on the other.
 *
 * Works in browsers, Bun, and Node (with worker_threads).
 */
export declare function createIPCPair(config?: IPCFlowConfig): [MessagePortFlowTransport, MessagePortFlowTransport];
