/**
 * Aeon Flow Transport Adapters
 *
 * Transport-agnostic implementations of FlowTransport for different media.
 * The flow protocol doesn't care about the wire — these adapters provide
 * the FlowTransport interface over every medium that matters.
 *
 *   - DashRelay:  Room-based relay (THE backbone — all data flows here)
 *   - Bluetooth:  BLE GATT for nearby device mesh
 *   - WebRTC:     DataChannel via DashRelay for browser-to-browser
 *   - TCP:        Server-to-server (coordinator ↔ nodes, forge ↔ targets)
 *   - IPC:        MessagePort/MessageChannel/child_process for local processes
 *   - USB:        WebUSB for hardware devices (Rabbit R1, embedded)
 *   - HTTP:       nginx bridge — HTTP is the normie projection of Aeon
 *
 * fork/race/collapse works identically regardless of transport.
 * Everything speaks Aeon internally. HTTP is just the projection.
 */
// ── DashRelay (backbone) ──────────────────────────────────────────
export { DashRelayFlowTransport, createDashRelayFlow, } from './dashrelay';
// ── Bluetooth (nearby mesh) ───────────────────────────────────────
export { BluetoothFlowTransport, AEON_FLOW_SERVICE_UUID, AEON_FLOW_TX_UUID, AEON_FLOW_RX_UUID, } from './bluetooth';
// ── WebRTC (browser-to-browser) ───────────────────────────────────
export { WebRTCFlowTransport, createP2PFlow, } from './webrtc';
// ── TCP (server-to-server) ────────────────────────────────────────
export { TCPFlowTransport, connectTCPFlow, listenTCPFlow, } from './tcp';
// ── IPC (local processes) ─────────────────────────────────────────
export { MessagePortFlowTransport, ChildProcessFlowTransport, createIPCPair, } from './ipc';
// ── USB (hardware devices) ────────────────────────────────────────
export { USBFlowTransport, AEON_USB_INTERFACE_CLASS, AEON_USB_SUBCLASS, AEON_USB_PROTOCOL, } from './usb';
// ── HTTP (nginx bridge / normie projection) ───────────────────────
export { HTTPAeonBridge, encodeHTTPRequest, decodeHTTPRequest, encodeHTTPResponse, decodeHTTPResponse, } from './http';
