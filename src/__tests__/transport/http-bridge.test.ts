import { describe, it, expect } from 'vitest';
import {
  encodeHTTPRequest,
  decodeHTTPRequest,
  encodeHTTPResponse,
  decodeHTTPResponse,
  HTTPAeonBridge,
} from '../../transport/http';
import type { AeonHTTPRequest, AeonHTTPResponse } from '../../transport/http';
import type { FlowTransport } from '../../flow/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function createLinkedTransports(): [FlowTransport, FlowTransport] {
  let handlerA: ((data: Uint8Array) => void) | null = null;
  let handlerB: ((data: Uint8Array) => void) | null = null;

  const transportA: FlowTransport = {
    send: (data) => { if (handlerB) handlerB(new Uint8Array(data)); },
    onReceive: (handler) => { handlerA = handler; },
    close: () => { handlerA = null; },
  };

  const transportB: FlowTransport = {
    send: (data) => { if (handlerA) handlerA(new Uint8Array(data)); },
    onReceive: (handler) => { handlerB = handler; },
    close: () => { handlerB = null; },
  };

  return [transportA, transportB];
}

describe('HTTP↔Aeon Bridge', () => {
  describe('HTTP request encoding', () => {
    it('should roundtrip a GET request', () => {
      const req: AeonHTTPRequest = {
        method: 'GET',
        path: '/api/data',
        headers: { 'accept': 'application/json' },
        requestId: 'req-1',
      };

      const encoded = encodeHTTPRequest(req);
      const decoded = decodeHTTPRequest(encoded);

      expect(decoded.method).toBe('GET');
      expect(decoded.path).toBe('/api/data');
      expect(decoded.headers['accept']).toBe('application/json');
      expect(decoded.body).toBeUndefined();
    });

    it('should roundtrip a POST request with body', () => {
      const body = new TextEncoder().encode('{"key":"value"}');
      const req: AeonHTTPRequest = {
        method: 'POST',
        path: '/api/submit',
        headers: { 'content-type': 'application/json' },
        body,
        requestId: 'req-2',
      };

      const encoded = encodeHTTPRequest(req);
      const decoded = decodeHTTPRequest(encoded);

      expect(decoded.method).toBe('POST');
      expect(decoded.path).toBe('/api/submit');
      expect(decoded.body).toBeDefined();
      expect(new TextDecoder().decode(decoded.body!)).toBe('{"key":"value"}');
    });

    it('should preserve query string', () => {
      const req: AeonHTTPRequest = {
        method: 'GET',
        path: '/search',
        query: 'q=hello&page=2',
        headers: {},
        requestId: 'req-3',
      };

      const encoded = encodeHTTPRequest(req);
      const decoded = decodeHTTPRequest(encoded);

      expect(decoded.path).toBe('/search');
      expect(decoded.query).toBe('q=hello&page=2');
    });

    it('should handle empty headers', () => {
      const req: AeonHTTPRequest = {
        method: 'DELETE',
        path: '/api/item/42',
        headers: {},
        requestId: 'req-4',
      };

      const encoded = encodeHTTPRequest(req);
      const decoded = decodeHTTPRequest(encoded);

      expect(decoded.method).toBe('DELETE');
      expect(Object.keys(decoded.headers).length).toBe(0);
    });
  });

  describe('HTTP response encoding', () => {
    it('should roundtrip a 200 response', () => {
      const res = {
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: new TextEncoder().encode('<h1>Hello</h1>'),
      };

      const encoded = encodeHTTPResponse(res);
      const decoded = decodeHTTPResponse(encoded);

      expect(decoded.status).toBe(200);
      expect(decoded.headers['content-type']).toBe('text/html');
      expect(new TextDecoder().decode(decoded.body)).toBe('<h1>Hello</h1>');
    });

    it('should roundtrip a 404 response', () => {
      const res = {
        status: 404,
        headers: {},
        body: new TextEncoder().encode('Not Found'),
      };

      const encoded = encodeHTTPResponse(res);
      const decoded = decodeHTTPResponse(encoded);

      expect(decoded.status).toBe(404);
    });

    it('should handle binary response body', () => {
      const binary = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG header
      const res = {
        status: 200,
        headers: { 'content-type': 'image/png' },
        body: binary,
      };

      const encoded = encodeHTTPResponse(res);
      const decoded = decodeHTTPResponse(encoded);

      expect(Array.from(decoded.body)).toEqual(Array.from(binary));
    });
  });

  describe('HTTPAeonBridge end-to-end', () => {
    it('should proxy an HTTP request through the bridge', async () => {
      const [nginxSide, aeonSide] = createLinkedTransports();
      const nginxBridge = new HTTPAeonBridge(nginxSide);
      const aeonBridge = new HTTPAeonBridge(aeonSide);

      // Aeon side handles requests
      aeonBridge.onRequest(async (req) => {
        expect(req.method).toBe('GET');
        expect(req.path).toBe('/api/data');

        return {
          requestId: req.requestId,
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: new TextEncoder().encode('{"result":"ok"}'),
        };
      });

      // nginx side sends a request
      const response = await nginxBridge.sendRequest({
        method: 'GET',
        path: '/api/data',
        headers: { 'accept': 'application/json' },
        requestId: 'test-req-1',
      });

      expect(response.status).toBe(200);
      expect(new TextDecoder().decode(response.body)).toBe('{"result":"ok"}');

      nginxBridge.close();
      aeonBridge.close();
    });

    it('should handle errors gracefully', async () => {
      const [nginxSide, aeonSide] = createLinkedTransports();
      const nginxBridge = new HTTPAeonBridge(nginxSide);
      const aeonBridge = new HTTPAeonBridge(aeonSide);

      // Aeon side throws
      aeonBridge.onRequest(async () => {
        throw new Error('Backend exploded');
      });

      const response = await nginxBridge.sendRequest({
        method: 'GET',
        path: '/api/broken',
        headers: {},
        requestId: 'test-req-2',
      });

      expect(response.status).toBe(502);
      expect(new TextDecoder().decode(response.body)).toBe('Backend exploded');

      nginxBridge.close();
      aeonBridge.close();
    });

    it('should handle multiple concurrent requests', async () => {
      const [nginxSide, aeonSide] = createLinkedTransports();
      const nginxBridge = new HTTPAeonBridge(nginxSide);
      const aeonBridge = new HTTPAeonBridge(aeonSide);

      aeonBridge.onRequest(async (req) => {
        // Simulate varying response times
        const delay = req.path === '/slow' ? 50 : 10;
        await new Promise((r) => setTimeout(r, delay));

        return {
          requestId: req.requestId,
          status: 200,
          headers: {},
          body: new TextEncoder().encode(`response for ${req.path}`),
        };
      });

      // Send 3 requests concurrently
      const [r1, r2, r3] = await Promise.all([
        nginxBridge.sendRequest({ method: 'GET', path: '/fast', headers: {}, requestId: 'req-a' }),
        nginxBridge.sendRequest({ method: 'GET', path: '/slow', headers: {}, requestId: 'req-b' }),
        nginxBridge.sendRequest({ method: 'GET', path: '/medium', headers: {}, requestId: 'req-c' }),
      ]);

      expect(new TextDecoder().decode(r1.body)).toBe('response for /fast');
      expect(new TextDecoder().decode(r2.body)).toBe('response for /slow');
      expect(new TextDecoder().decode(r3.body)).toBe('response for /medium');

      nginxBridge.close();
      aeonBridge.close();
    });

    it('should timeout if no response', async () => {
      const [nginxSide, aeonSide] = createLinkedTransports();
      const nginxBridge = new HTTPAeonBridge(nginxSide, { responseTimeout: 100 });
      // Don't register any handler on aeon side — request will timeout

      await expect(
        nginxBridge.sendRequest({
          method: 'GET',
          path: '/timeout',
          headers: {},
          requestId: 'timeout-req',
        })
      ).rejects.toThrow('timeout');

      nginxBridge.close();
    });
  });
});
