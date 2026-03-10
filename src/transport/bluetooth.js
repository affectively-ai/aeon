/**
 * Bluetooth Flow Transport
 *
 * FlowTransport adapter for Web Bluetooth API.
 * Enables flow protocol over BLE between nearby devices —
 * the mesh networking primitive for federated inference.
 *
 * Two devices running aeon-flux can fork/race inference across
 * both browsers via Bluetooth, zero cloud cost.
 *
 * Uses GATT characteristics for binary frame exchange:
 *   - TX characteristic: this device writes flow frames
 *   - RX characteristic: this device reads flow frames
 *
 * MTU-aware: fragments large FlowFrames across multiple BLE writes.
 */
// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════
/** Aeon Flow BLE Service UUID */
export const AEON_FLOW_SERVICE_UUID = '0000af10-0000-1000-8000-00805f9b34fb';
/** TX Characteristic — write flow frames */
export const AEON_FLOW_TX_UUID = '0000af11-0000-1000-8000-00805f9b34fb';
/** RX Characteristic — receive flow frames (notify) */
export const AEON_FLOW_RX_UUID = '0000af12-0000-1000-8000-00805f9b34fb';
/** Default BLE MTU minus ATT overhead */
const DEFAULT_MTU = 512 - 3;
/** Frame boundary marker (4 bytes) to reassemble fragmented frames */
const FRAME_BOUNDARY = new Uint8Array([0xAE, 0x0F, 0x10, 0xFF]);
// ═══════════════════════════════════════════════════════════════════════════════
// Bluetooth FlowTransport
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * FlowTransport over Web Bluetooth GATT.
 *
 * Fragments flow frames to fit within BLE MTU, reassembles on receive.
 * Uses notifications on RX characteristic for incoming frames.
 */
export class BluetoothFlowTransport {
    config;
    device = null;
    txChar = null;
    rxChar = null;
    receiveHandler = null;
    mtu;
    closed = false;
    /** Reassembly buffer for fragmented incoming frames */
    rxBuffer = [];
    constructor(config = {}) {
        this.config = config;
        this.mtu = config.mtu ?? DEFAULT_MTU;
    }
    /**
     * Scan for and connect to a nearby Aeon device.
     * Returns the connected device name.
     */
    async connect() {
        const serviceUuid = this.config.serviceUuid ?? AEON_FLOW_SERVICE_UUID;
        const filters = [];
        if (this.config.namePrefix) {
            filters.push({ namePrefix: this.config.namePrefix });
        }
        filters.push({ services: [serviceUuid] });
        this.device = await navigator.bluetooth.requestDevice({
            filters,
            optionalServices: [serviceUuid],
        });
        if (!this.device.gatt) {
            throw new Error('GATT not available on device');
        }
        const server = await this.device.gatt.connect();
        const service = await server.getPrimaryService(serviceUuid);
        this.txChar = await service.getCharacteristic(this.config.serviceUuid ? AEON_FLOW_TX_UUID : AEON_FLOW_TX_UUID);
        this.rxChar = await service.getCharacteristic(AEON_FLOW_RX_UUID);
        // Start notifications on RX
        await this.rxChar.startNotifications();
        this.rxChar.addEventListener('characteristicvaluechanged', this.handleRxNotification);
        // Handle disconnection
        this.device.addEventListener('gattserverdisconnected', () => {
            this.closed = true;
            this.receiveHandler = null;
        });
        return this.device.name || this.device.id;
    }
    /**
     * Create from an already-connected GATT server (for peripheral/server mode).
     */
    static fromCharacteristics(tx, rx, config) {
        const transport = new BluetoothFlowTransport(config);
        transport.txChar = tx;
        transport.rxChar = rx;
        rx.addEventListener('characteristicvaluechanged', transport.handleRxNotification);
        return transport;
    }
    // ─── FlowTransport interface ───────────────────────────────────────
    send(data) {
        if (this.closed || !this.txChar)
            return;
        // Fragment if data exceeds MTU
        const fragmentSize = this.mtu - FRAME_BOUNDARY.length;
        if (data.byteLength <= fragmentSize) {
            // Fits in one write — send with boundary marker
            const packet = new Uint8Array(data.byteLength + FRAME_BOUNDARY.length);
            packet.set(data);
            packet.set(FRAME_BOUNDARY, data.byteLength);
            this.writeCharacteristic(packet);
        }
        else {
            // Fragment across multiple writes
            let offset = 0;
            while (offset < data.byteLength) {
                const chunkSize = Math.min(fragmentSize, data.byteLength - offset);
                const isLast = offset + chunkSize >= data.byteLength;
                const chunk = data.subarray(offset, offset + chunkSize);
                if (isLast) {
                    // Last fragment gets boundary marker
                    const packet = new Uint8Array(chunk.byteLength + FRAME_BOUNDARY.length);
                    packet.set(chunk);
                    packet.set(FRAME_BOUNDARY, chunk.byteLength);
                    this.writeCharacteristic(packet);
                }
                else {
                    // Intermediate fragment — no boundary
                    this.writeCharacteristic(chunk);
                }
                offset += chunkSize;
            }
        }
    }
    onReceive(handler) {
        this.receiveHandler = handler;
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        if (this.rxChar) {
            this.rxChar.removeEventListener('characteristicvaluechanged', this.handleRxNotification);
            this.rxChar.stopNotifications().catch(() => { });
        }
        if (this.device?.gatt?.connected) {
            this.device.gatt.disconnect();
        }
        this.receiveHandler = null;
        this.rxBuffer = [];
    }
    /** Whether Bluetooth is connected */
    get isConnected() {
        return !this.closed && !!this.device?.gatt?.connected;
    }
    // ─── Internal ──────────────────────────────────────────────────────
    async writeCharacteristic(data) {
        if (!this.txChar)
            return;
        try {
            await this.txChar.writeValueWithoutResponse(data);
        }
        catch {
            // Write failed — BLE disconnected or busy
        }
    }
    handleRxNotification = (event) => {
        const target = event.target;
        if (!target.value)
            return;
        const chunk = new Uint8Array(target.value.buffer);
        // Check if chunk ends with frame boundary
        if (this.endsWithBoundary(chunk)) {
            // Complete frame (or last fragment)
            const frameData = chunk.subarray(0, chunk.byteLength - FRAME_BOUNDARY.length);
            if (this.rxBuffer.length > 0) {
                // Reassemble fragments
                this.rxBuffer.push(frameData);
                const totalLen = this.rxBuffer.reduce((s, b) => s + b.byteLength, 0);
                const assembled = new Uint8Array(totalLen);
                let offset = 0;
                for (const buf of this.rxBuffer) {
                    assembled.set(buf, offset);
                    offset += buf.byteLength;
                }
                this.rxBuffer = [];
                this.receiveHandler?.(assembled);
            }
            else {
                // Single-packet frame
                this.receiveHandler?.(frameData);
            }
        }
        else {
            // Intermediate fragment — buffer it
            this.rxBuffer.push(chunk);
        }
    };
    endsWithBoundary(data) {
        if (data.byteLength < FRAME_BOUNDARY.length)
            return false;
        const tail = data.subarray(data.byteLength - FRAME_BOUNDARY.length);
        return (tail[0] === FRAME_BOUNDARY[0] &&
            tail[1] === FRAME_BOUNDARY[1] &&
            tail[2] === FRAME_BOUNDARY[2] &&
            tail[3] === FRAME_BOUNDARY[3]);
    }
}
