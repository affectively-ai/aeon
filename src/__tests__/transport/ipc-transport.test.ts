import { describe, it, expect } from 'vitest';
import { createIPCPair, MessagePortFlowTransport } from '../../transport/ipc';

describe('IPC FlowTransport', () => {
  describe('createIPCPair', () => {
    it('should create two linked transports', () => {
      const [a, b] = createIPCPair();
      expect(a).toBeInstanceOf(MessagePortFlowTransport);
      expect(b).toBeInstanceOf(MessagePortFlowTransport);
      expect(a.isOpen).toBe(true);
      expect(b.isOpen).toBe(true);
      a.close();
      b.close();
    });

    it('should send data from A to B', async () => {
      const [a, b] = createIPCPair();
      const received: Uint8Array[] = [];

      b.onReceive((data) => {
        received.push(data);
      });

      const message = new TextEncoder().encode('hello from A');
      a.send(message);

      // MessageChannel is async — wait for delivery
      await new Promise((r) => setTimeout(r, 50));

      expect(received.length).toBe(1);
      expect(new TextDecoder().decode(received[0])).toBe('hello from A');

      a.close();
      b.close();
    });

    it('should send data from B to A', async () => {
      const [a, b] = createIPCPair();
      const received: Uint8Array[] = [];

      a.onReceive((data) => {
        received.push(data);
      });

      b.send(new TextEncoder().encode('hello from B'));
      await new Promise((r) => setTimeout(r, 50));

      expect(received.length).toBe(1);
      expect(new TextDecoder().decode(received[0])).toBe('hello from B');

      a.close();
      b.close();
    });

    it('should handle binary data with fidelity', async () => {
      const [a, b] = createIPCPair();
      const received: Uint8Array[] = [];

      b.onReceive((data) => {
        received.push(data);
      });

      // Send binary data including null bytes and high values
      const binary = new Uint8Array([0x00, 0xFF, 0xAE, 0x0F, 0x10, 0x80]);
      a.send(binary);
      await new Promise((r) => setTimeout(r, 50));

      expect(received.length).toBe(1);
      expect(Array.from(received[0])).toEqual(Array.from(binary));

      a.close();
      b.close();
    });

    it('should handle multiple messages in order', async () => {
      const [a, b] = createIPCPair();
      const received: string[] = [];

      b.onReceive((data) => {
        received.push(new TextDecoder().decode(data));
      });

      for (let i = 0; i < 10; i++) {
        a.send(new TextEncoder().encode(`msg-${i}`));
      }
      await new Promise((r) => setTimeout(r, 100));

      expect(received.length).toBe(10);
      for (let i = 0; i < 10; i++) {
        expect(received[i]).toBe(`msg-${i}`);
      }

      a.close();
      b.close();
    });

    it('should not receive after close', async () => {
      const [a, b] = createIPCPair();
      const received: Uint8Array[] = [];

      b.onReceive((data) => {
        received.push(data);
      });

      a.send(new TextEncoder().encode('before close'));
      await new Promise((r) => setTimeout(r, 50));
      expect(received.length).toBe(1);

      b.close();

      a.send(new TextEncoder().encode('after close'));
      await new Promise((r) => setTimeout(r, 50));

      // Should still be 1 — the close prevents receiving
      expect(received.length).toBe(1);

      a.close();
    });

    it('should report isOpen correctly', () => {
      const [a, b] = createIPCPair();
      expect(a.isOpen).toBe(true);
      expect(b.isOpen).toBe(true);

      a.close();
      expect(a.isOpen).toBe(false);
      expect(b.isOpen).toBe(true); // B is independent

      b.close();
      expect(b.isOpen).toBe(false);
    });
  });

  describe('bidirectional flow protocol integration', () => {
    it('should support full-duplex communication', async () => {
      const [a, b] = createIPCPair();
      const aReceived: string[] = [];
      const bReceived: string[] = [];

      a.onReceive((data) => aReceived.push(new TextDecoder().decode(data)));
      b.onReceive((data) => bReceived.push(new TextDecoder().decode(data)));

      // Both sides send simultaneously
      a.send(new TextEncoder().encode('A→B'));
      b.send(new TextEncoder().encode('B→A'));

      await new Promise((r) => setTimeout(r, 50));

      expect(aReceived).toEqual(['B→A']);
      expect(bReceived).toEqual(['A→B']);

      a.close();
      b.close();
    });

    it('should handle echo pattern (ping/pong)', async () => {
      const [a, b] = createIPCPair();
      let pongReceived = false;

      // B echoes anything it receives
      b.onReceive((data) => {
        b.send(data);
      });

      a.onReceive((data) => {
        if (new TextDecoder().decode(data) === 'ping') {
          pongReceived = true;
        }
      });

      a.send(new TextEncoder().encode('ping'));
      await new Promise((r) => setTimeout(r, 100));

      expect(pongReceived).toBe(true);

      a.close();
      b.close();
    });
  });
});
