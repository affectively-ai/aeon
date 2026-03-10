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
/**
 * FlowTransport over TCP with length-prefixed framing.
 *
 * Handles message boundary detection (TCP is a stream, not message-oriented).
 * Uses a u32 length prefix so the receiver knows exactly how many bytes
 * to read for each flow frame.
 */
export declare class TCPFlowTransport implements FlowTransport {
    private socket;
    private receiveHandler;
    private closed;
    /** Reassembly buffer for TCP stream → discrete messages */
    private rxBuffer;
    constructor(socket: TCPSocket, config?: Partial<TCPFlowConfig>);
    send(data: Uint8Array): void;
    onReceive(handler: (data: Uint8Array) => void): void;
    close(): void;
    /** Whether the transport is still open */
    get isOpen(): boolean;
    private onData;
}
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
export declare function connectTCPFlow(host: string, port: number, config?: Partial<TCPFlowConfig>): Promise<TCPFlowTransport>;
/**
 * Create a TCP flow server that accepts incoming connections.
 *
 * Each accepted connection becomes a FlowTransport.
 *
 * @param port - Port to listen on
 * @param host - Host to bind to (default: '0.0.0.0')
 * @param onConnection - Called for each new flow transport connection
 */
export declare function listenTCPFlow(port: number, host: string, onConnection: (transport: TCPFlowTransport) => void): Promise<{
    close: () => void;
}>;
export {};
