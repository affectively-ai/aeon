/**
 * HTTP Flow Transport (nginx Bridge)
 *
 * FlowTransport adapter that translates between HTTP and Aeon flow protocol.
 * This is the normie projection layer — external clients speak HTTP,
 * the nginx module translates to Aeon flow, and everything internal
 * speaks Aeon natively.
 *
 * Two sides:
 *   1. **Server-side (Aeon→HTTP)**: Receives flow frames from internal Aeon
 *      services and translates them into HTTP responses for external clients.
 *   2. **Client-side (HTTP→Aeon)**: Receives HTTP requests from nginx and
 *      translates them into flow frames for internal processing.
 *
 * The nginx module handles the C-level WebSocket↔HTTP translation.
 * This TypeScript module handles the flow frame↔HTTP semantic mapping:
 *   - HTTP GET → flow stream open + await FIN
 *   - HTTP POST → flow stream open + data frames + FIN
 *   - HTTP response → flow frames + FIN
 *   - HTTP streaming response → flow frames (no FIN until complete)
 *   - HTTP error → POISON frame
 *
 * Wire format between nginx module and this bridge:
 *   Control messages are length-prefixed JSON.
 *   Data messages are raw flow frames.
 */
import type { FlowTransport } from '../flow/types';
/** HTTP request as received from nginx */
export interface AeonHTTPRequest {
    /** HTTP method */
    method: string;
    /** Request path */
    path: string;
    /** Query string (without leading ?) */
    query?: string;
    /** Request headers */
    headers: Record<string, string>;
    /** Request body (for POST/PUT/PATCH) */
    body?: Uint8Array;
    /** Unique request ID assigned by nginx */
    requestId: string;
}
/** HTTP response to send back through nginx */
export interface AeonHTTPResponse {
    /** HTTP status code */
    status: number;
    /** Response headers */
    headers: Record<string, string>;
    /** Response body */
    body: Uint8Array;
    /** Whether this is a streaming response (more chunks follow) */
    streaming?: boolean;
    /** Request ID this response belongs to */
    requestId: string;
}
/** Control message from nginx → bridge */
export interface NginxControlMessage {
    type: 'http-request';
    request: AeonHTTPRequest;
}
/** Control message from bridge → nginx */
export interface BridgeControlMessage {
    type: 'http-response' | 'http-response-chunk' | 'http-response-end';
    response: AeonHTTPResponse;
}
export interface HTTPBridgeConfig {
    /** Default content type for responses (default: 'application/octet-stream') */
    defaultContentType?: string;
    /** Maximum request body size in bytes (default: 16MB) */
    maxBodySize?: number;
    /** Timeout for flow response in ms (default: 30000) */
    responseTimeout?: number;
}
/**
 * Encode an HTTP request into flow frame payload.
 *
 * Format:
 *   [0-3]   u32  method length
 *   [4-7]   u32  path length
 *   [8-11]  u32  headers JSON length
 *   [12-15] u32  body length
 *   [...]   method bytes
 *   [...]   path bytes (includes query string)
 *   [...]   headers JSON bytes
 *   [...]   body bytes
 */
export declare function encodeHTTPRequest(req: AeonHTTPRequest): Uint8Array;
/**
 * Decode a flow frame payload back into an HTTP request.
 */
export declare function decodeHTTPRequest(data: Uint8Array): AeonHTTPRequest;
/**
 * Encode an HTTP response into flow frame payload.
 *
 * Format:
 *   [0-1]   u16  status code
 *   [2-5]   u32  headers JSON length
 *   [6-9]   u32  body length
 *   [...]   headers JSON bytes
 *   [...]   body bytes
 */
export declare function encodeHTTPResponse(res: Omit<AeonHTTPResponse, 'requestId'>): Uint8Array;
/**
 * Decode a flow frame payload back into an HTTP response.
 */
export declare function decodeHTTPResponse(data: Uint8Array): Omit<AeonHTTPResponse, 'requestId'>;
/**
 * Bidirectional HTTP↔Aeon flow protocol bridge.
 *
 * Sits between nginx (HTTP) and internal Aeon services (flow protocol).
 * Translates HTTP requests into flow streams and flow responses back
 * into HTTP responses.
 *
 * nginx module sends HTTP requests over a WebSocket to this bridge.
 * This bridge opens flow streams, forwards the request as flow frames,
 * collects the response frames, and sends the HTTP response back to nginx.
 */
export declare class HTTPAeonBridge {
    private transport;
    private config;
    /** Pending HTTP requests waiting for flow responses */
    private pending;
    /** Handler for incoming HTTP requests (from nginx side) */
    private requestHandler;
    constructor(transport: FlowTransport, config?: HTTPBridgeConfig);
    /**
     * Register a handler for incoming HTTP requests.
     * This is used on the Aeon side — the bridge receives HTTP requests
     * from nginx, translates them to flow, and calls this handler.
     */
    onRequest(handler: (req: AeonHTTPRequest) => Promise<AeonHTTPResponse>): void;
    /**
     * Send an HTTP request through the bridge (used by nginx side).
     * Translates the HTTP request into flow frames, waits for the
     * flow response, and returns it as an HTTP response.
     */
    sendRequest(req: AeonHTTPRequest): Promise<AeonHTTPResponse>;
    /**
     * Send an HTTP response back through the bridge (used by Aeon side).
     */
    sendResponse(res: AeonHTTPResponse): void;
    close(): void;
    private handleIncoming;
    private handleResponseFrame;
    private handleRequestFrame;
}
