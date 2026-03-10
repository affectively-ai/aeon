import { describe, it, expect } from 'vitest';
import { TCPFlowTransport } from '../../transport/tcp';

/**
 * TCP FlowTransport tests.
 *
 * These tests use mock sockets to avoid actual network I/O.
 * The TCP transport's core logic is length-prefixed framing
 * and stream reassembly — those are what we test.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Mock TCP Socket
// ═══════════════════════════════════════════════════════════════════════════════

interface MockSocketHandler {
  data?: (data: Buffer | Uint8Array) => void;
  close?: () => void;
  error?: (err: Error) => void;
}

function createMockSocket(): {
  socket: {
    write: (data: Uint8Array) => boolean;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    end: () => void;
    destroy: () => void;
    setKeepAlive: (enable: boolean, delay?: number) => void;
    setNoDelay: (noDelay?: boolean) => void;
  };
  handlers: MockSocketHandler;
  written: Uint8Array[];
} {
  const handlers: MockSocketHandler = {};
  const written: Uint8Array[] = [];

  const socket = {
    write: (data: Uint8Array): boolean => {
      written.push(new Uint8Array(data));
      return true;
    },
    on: (event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'data') handlers.data = handler as (d: Buffer | Uint8Array) => void;
      if (event === 'close') handlers.close = handler as () => void;
      if (event === 'error') handlers.error = handler as (e: Error) => void;
    },
    end: () => {
      handlers.close?.();
    },
    destroy: () => {},
    setKeepAlive: () => {},
    setNoDelay: () => {},
  };

  return { socket, handlers, written };
}

/**
 * Create a length-prefixed frame (what the transport sends on the wire).
 */
function makeLengthPrefixed(data: Uint8Array): Uint8Array {
  const frame = new Uint8Array(4 + data.byteLength);
  const view = new DataView(frame.buffer);
  view.setUint32(0, data.byteLength, false);
  frame.set(data, 4);
  return frame;
}

describe('TCP FlowTransport', () => {
  describe('send', () => {
    it('should length-prefix outgoing data', () => {
      const { socket, written } = createMockSocket();
      const transport = new TCPFlowTransport(socket);

      const payload = new TextEncoder().encode('hello');
      transport.send(payload);

      expect(written.length).toBe(1);
      const view = new DataView(written[0].buffer);
      expect(view.getUint32(0, false)).toBe(payload.byteLength);
      expect(new TextDecoder().decode(written[0].subarray(4))).toBe('hello');

      transport.close();
    });

    it('should not send after close', () => {
      const { socket, written } = createMockSocket();
      const transport = new TCPFlowTransport(socket);

      transport.close();
      transport.send(new TextEncoder().encode('should not send'));

      expect(written.length).toBe(0);
    });
  });

  describe('receive (stream reassembly)', () => {
    it('should reassemble a complete message', () => {
      const { socket, handlers } = createMockSocket();
      const transport = new TCPFlowTransport(socket);
      const received: string[] = [];

      transport.onReceive((data) => {
        received.push(new TextDecoder().decode(data));
      });

      // Simulate receiving a complete length-prefixed message
      const payload = new TextEncoder().encode('hello TCP');
      const frame = makeLengthPrefixed(payload);
      handlers.data?.(frame);

      expect(received).toEqual(['hello TCP']);
      transport.close();
    });

    it('should handle fragmented delivery (split across TCP segments)', () => {
      const { socket, handlers } = createMockSocket();
      const transport = new TCPFlowTransport(socket);
      const received: string[] = [];

      transport.onReceive((data) => {
        received.push(new TextDecoder().decode(data));
      });

      const payload = new TextEncoder().encode('fragmented message');
      const frame = makeLengthPrefixed(payload);

      // Split into 3 chunks at arbitrary boundaries
      handlers.data?.(frame.subarray(0, 3));   // Partial length prefix
      handlers.data?.(frame.subarray(3, 10));  // Rest of prefix + some payload
      handlers.data?.(frame.subarray(10));     // Rest of payload

      expect(received).toEqual(['fragmented message']);
      transport.close();
    });

    it('should handle multiple messages in one TCP segment', () => {
      const { socket, handlers } = createMockSocket();
      const transport = new TCPFlowTransport(socket);
      const received: string[] = [];

      transport.onReceive((data) => {
        received.push(new TextDecoder().decode(data));
      });

      const msg1 = makeLengthPrefixed(new TextEncoder().encode('first'));
      const msg2 = makeLengthPrefixed(new TextEncoder().encode('second'));
      const msg3 = makeLengthPrefixed(new TextEncoder().encode('third'));

      // All three arrive in one chunk
      const combined = new Uint8Array(msg1.byteLength + msg2.byteLength + msg3.byteLength);
      combined.set(msg1, 0);
      combined.set(msg2, msg1.byteLength);
      combined.set(msg3, msg1.byteLength + msg2.byteLength);

      handlers.data?.(combined);

      expect(received).toEqual(['first', 'second', 'third']);
      transport.close();
    });

    it('should handle zero-length payload', () => {
      const { socket, handlers } = createMockSocket();
      const transport = new TCPFlowTransport(socket);
      const received: Uint8Array[] = [];

      transport.onReceive((data) => {
        received.push(data);
      });

      const frame = makeLengthPrefixed(new Uint8Array(0));
      handlers.data?.(frame);

      expect(received.length).toBe(1);
      expect(received[0].byteLength).toBe(0);
      transport.close();
    });

    it('should handle binary data with fidelity', () => {
      const { socket, handlers } = createMockSocket();
      const transport = new TCPFlowTransport(socket);
      const received: Uint8Array[] = [];

      transport.onReceive((data) => {
        received.push(data);
      });

      const binary = new Uint8Array([0x00, 0xFF, 0xAE, 0x0F, 0x10, 0x80, 0xDE, 0xAD]);
      handlers.data?.(makeLengthPrefixed(binary));

      expect(received.length).toBe(1);
      expect(Array.from(received[0])).toEqual(Array.from(binary));
      transport.close();
    });
  });

  describe('lifecycle', () => {
    it('should report isOpen correctly', () => {
      const { socket } = createMockSocket();
      const transport = new TCPFlowTransport(socket);

      expect(transport.isOpen).toBe(true);
      transport.close();
      expect(transport.isOpen).toBe(false);
    });

    it('should handle socket close event', () => {
      const { socket, handlers } = createMockSocket();
      const transport = new TCPFlowTransport(socket);

      expect(transport.isOpen).toBe(true);
      handlers.close?.();
      expect(transport.isOpen).toBe(false);
    });

    it('should not deliver after close', () => {
      const { socket, handlers } = createMockSocket();
      const transport = new TCPFlowTransport(socket);
      const received: string[] = [];

      transport.onReceive((data) => {
        received.push(new TextDecoder().decode(data));
      });

      transport.close();

      // Simulate data arriving after close
      const frame = makeLengthPrefixed(new TextEncoder().encode('late'));
      handlers.data?.(frame);

      expect(received.length).toBe(0);
    });
  });
});
