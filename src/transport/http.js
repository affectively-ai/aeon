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
// ═══════════════════════════════════════════════════════════════════════════════
// HTTP→Aeon Request Encoder
// ═══════════════════════════════════════════════════════════════════════════════
const encoder = new TextEncoder();
const decoder = new TextDecoder();
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
export function encodeHTTPRequest(req) {
    const methodBytes = encoder.encode(req.method);
    const fullPath = req.query ? `${req.path}?${req.query}` : req.path;
    const pathBytes = encoder.encode(fullPath);
    const headersBytes = encoder.encode(JSON.stringify(req.headers));
    const bodyBytes = req.body ?? new Uint8Array(0);
    const headerSize = 16;
    const totalSize = headerSize + methodBytes.byteLength + pathBytes.byteLength +
        headersBytes.byteLength + bodyBytes.byteLength;
    const encoded = new Uint8Array(totalSize);
    const view = new DataView(encoded.buffer);
    view.setUint32(0, methodBytes.byteLength, false);
    view.setUint32(4, pathBytes.byteLength, false);
    view.setUint32(8, headersBytes.byteLength, false);
    view.setUint32(12, bodyBytes.byteLength, false);
    let offset = headerSize;
    encoded.set(methodBytes, offset);
    offset += methodBytes.byteLength;
    encoded.set(pathBytes, offset);
    offset += pathBytes.byteLength;
    encoded.set(headersBytes, offset);
    offset += headersBytes.byteLength;
    encoded.set(bodyBytes, offset);
    return encoded;
}
/**
 * Decode a flow frame payload back into an HTTP request.
 */
export function decodeHTTPRequest(data) {
    if (data.byteLength < 16)
        throw new Error('Invalid HTTP request frame');
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const methodLen = view.getUint32(0, false);
    const pathLen = view.getUint32(4, false);
    const headersLen = view.getUint32(8, false);
    const bodyLen = view.getUint32(12, false);
    let offset = 16;
    const method = decoder.decode(data.subarray(offset, offset + methodLen));
    offset += methodLen;
    const fullPath = decoder.decode(data.subarray(offset, offset + pathLen));
    offset += pathLen;
    const headersJson = decoder.decode(data.subarray(offset, offset + headersLen));
    offset += headersLen;
    const body = bodyLen > 0 ? data.slice(offset, offset + bodyLen) : undefined;
    // Split path and query
    const qIdx = fullPath.indexOf('?');
    const path = qIdx >= 0 ? fullPath.substring(0, qIdx) : fullPath;
    const query = qIdx >= 0 ? fullPath.substring(qIdx + 1) : undefined;
    return {
        method,
        path,
        query,
        headers: JSON.parse(headersJson),
        body,
        requestId: '', // Assigned by caller
    };
}
// ═══════════════════════════════════════════════════════════════════════════════
// Aeon→HTTP Response Encoder
// ═══════════════════════════════════════════════════════════════════════════════
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
export function encodeHTTPResponse(res) {
    const headersBytes = encoder.encode(JSON.stringify(res.headers));
    const bodyBytes = res.body;
    const headerSize = 10;
    const totalSize = headerSize + headersBytes.byteLength + bodyBytes.byteLength;
    const encoded = new Uint8Array(totalSize);
    const view = new DataView(encoded.buffer);
    view.setUint16(0, res.status, false);
    view.setUint32(2, headersBytes.byteLength, false);
    view.setUint32(6, bodyBytes.byteLength, false);
    let offset = headerSize;
    encoded.set(headersBytes, offset);
    offset += headersBytes.byteLength;
    encoded.set(bodyBytes, offset);
    return encoded;
}
/**
 * Decode a flow frame payload back into an HTTP response.
 */
export function decodeHTTPResponse(data) {
    if (data.byteLength < 10)
        throw new Error('Invalid HTTP response frame');
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const status = view.getUint16(0, false);
    const headersLen = view.getUint32(2, false);
    const bodyLen = view.getUint32(6, false);
    let offset = 10;
    const headersJson = decoder.decode(data.subarray(offset, offset + headersLen));
    offset += headersLen;
    const body = data.slice(offset, offset + bodyLen);
    return {
        status,
        headers: JSON.parse(headersJson),
        body,
    };
}
// ═══════════════════════════════════════════════════════════════════════════════
// HTTP↔Aeon Bridge
// ═══════════════════════════════════════════════════════════════════════════════
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
export class HTTPAeonBridge {
    transport;
    config;
    /** Pending HTTP requests waiting for flow responses */
    pending = new Map();
    /** Handler for incoming HTTP requests (from nginx side) */
    requestHandler = null;
    constructor(transport, config) {
        this.transport = transport;
        this.config = config ?? {};
        // Wire up receive to handle response frames
        transport.onReceive((data) => {
            this.handleIncoming(data);
        });
    }
    /**
     * Register a handler for incoming HTTP requests.
     * This is used on the Aeon side — the bridge receives HTTP requests
     * from nginx, translates them to flow, and calls this handler.
     */
    onRequest(handler) {
        this.requestHandler = handler;
    }
    /**
     * Send an HTTP request through the bridge (used by nginx side).
     * Translates the HTTP request into flow frames, waits for the
     * flow response, and returns it as an HTTP response.
     */
    async sendRequest(req) {
        const timeout = this.config.responseTimeout ?? 30_000;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(req.requestId);
                reject(new Error(`Flow response timeout for ${req.method} ${req.path}`));
            }, timeout);
            this.pending.set(req.requestId, { resolve, reject, timer, chunks: [] });
            // Encode and send the request as a flow frame
            const payload = encodeHTTPRequest(req);
            // Prefix with request ID so the other side can correlate
            const reqIdBytes = encoder.encode(req.requestId);
            const frame = new Uint8Array(4 + reqIdBytes.byteLength + payload.byteLength);
            const view = new DataView(frame.buffer);
            view.setUint32(0, reqIdBytes.byteLength, false);
            frame.set(reqIdBytes, 4);
            frame.set(payload, 4 + reqIdBytes.byteLength);
            this.transport.send(frame);
        });
    }
    /**
     * Send an HTTP response back through the bridge (used by Aeon side).
     */
    sendResponse(res) {
        const payload = encodeHTTPResponse(res);
        const reqIdBytes = encoder.encode(res.requestId);
        // Prefix with request ID and a response marker byte
        const frame = new Uint8Array(5 + reqIdBytes.byteLength + payload.byteLength);
        const view = new DataView(frame.buffer);
        frame[0] = 0x02; // Response marker
        view.setUint32(1, reqIdBytes.byteLength, false);
        frame.set(reqIdBytes, 5);
        frame.set(payload, 5 + reqIdBytes.byteLength);
        this.transport.send(frame);
    }
    close() {
        for (const [, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.reject(new Error('Bridge closed'));
        }
        this.pending.clear();
        this.transport.close();
    }
    // ─── Internal ──────────────────────────────────────────────────────
    handleIncoming(data) {
        if (data.byteLength < 5)
            return;
        // Check if this is a response (marker byte 0x02) or a request (no marker)
        if (data[0] === 0x02) {
            this.handleResponseFrame(data);
        }
        else {
            this.handleRequestFrame(data);
        }
    }
    handleResponseFrame(data) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const reqIdLen = view.getUint32(1, false);
        const requestId = decoder.decode(data.subarray(5, 5 + reqIdLen));
        const payload = data.subarray(5 + reqIdLen);
        const pending = this.pending.get(requestId);
        if (!pending)
            return;
        clearTimeout(pending.timer);
        this.pending.delete(requestId);
        const response = decodeHTTPResponse(payload);
        pending.resolve({ ...response, requestId });
    }
    async handleRequestFrame(data) {
        if (!this.requestHandler)
            return;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        const reqIdLen = view.getUint32(0, false);
        const requestId = decoder.decode(data.subarray(4, 4 + reqIdLen));
        const payload = data.subarray(4 + reqIdLen);
        const request = decodeHTTPRequest(payload);
        request.requestId = requestId;
        try {
            const response = await this.requestHandler(request);
            this.sendResponse(response);
        }
        catch (err) {
            // Send error response
            this.sendResponse({
                requestId,
                status: 502,
                headers: { 'content-type': 'text/plain' },
                body: encoder.encode(err instanceof Error ? err.message : 'Internal flow error'),
            });
        }
    }
}
