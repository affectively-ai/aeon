/**
 * USB Flow Transport
 *
 * FlowTransport adapter for WebUSB API.
 * Enables flow protocol between browser and USB devices —
 * the communication channel for Rabbit R1 and other
 * hardware endpoints.
 *
 * Uses bulk transfer endpoints for binary flow frame exchange.
 * Length-prefixed framing (u32) for message boundary detection
 * over the bulk pipe.
 *
 * The device must expose a vendor-specific interface with
 * IN and OUT bulk endpoints that speak Aeon flow frames.
 */
// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════
/** Aeon vendor-specific interface class */
export const AEON_USB_INTERFACE_CLASS = 0xFF; // Vendor-specific
/** Aeon vendor-specific subclass */
export const AEON_USB_SUBCLASS = 0xAE;
/** Aeon protocol ID within the interface */
export const AEON_USB_PROTOCOL = 0x01;
/** Length prefix size for framing */
const LENGTH_PREFIX_SIZE = 4;
/** Default USB transfer size (64KB) */
const DEFAULT_TRANSFER_SIZE = 64 * 1024;
// ═══════════════════════════════════════════════════════════════════════════════
// USB FlowTransport
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * FlowTransport over WebUSB bulk endpoints.
 *
 * Uses length-prefixed framing over bulk transfers to delineate
 * flow frame boundaries. Continuously polls the IN endpoint
 * for incoming data.
 */
export class USBFlowTransport {
    device;
    receiveHandler = null;
    closed = false;
    interfaceNum;
    outEndpoint;
    inEndpoint;
    transferSize;
    readLoopRunning = false;
    /** Reassembly buffer for length-prefixed framing */
    rxBuffer = new Uint8Array(0);
    constructor(device, interfaceNum, outEndpoint, inEndpoint, transferSize) {
        this.device = device;
        this.interfaceNum = interfaceNum;
        this.outEndpoint = outEndpoint;
        this.inEndpoint = inEndpoint;
        this.transferSize = transferSize;
    }
    /**
     * Connect to a USB device and create a FlowTransport.
     *
     * Requests device access, opens it, claims the Aeon interface,
     * and auto-detects bulk endpoints if not specified.
     */
    static async connect(config) {
        const filters = [];
        if (config?.vendorId !== undefined) {
            const filter = { vendorId: config.vendorId };
            if (config.productId !== undefined) {
                filter.productId = config.productId;
            }
            filters.push(filter);
        }
        // Request device — triggers browser permission prompt
        const device = await navigator.usb.requestDevice({
            filters: filters.length > 0 ? filters : [{ classCode: AEON_USB_INTERFACE_CLASS }],
        });
        await device.open();
        // Find the Aeon interface
        let interfaceNum = config?.interfaceNumber;
        let outEp = config?.outEndpoint;
        let inEp = config?.inEndpoint;
        if (interfaceNum === undefined || outEp === undefined || inEp === undefined) {
            // Auto-detect from device configuration
            const iface = device.configuration?.interfaces.find((i) => i.alternates.some((alt) => alt.interfaceClass === AEON_USB_INTERFACE_CLASS &&
                alt.interfaceSubclass === AEON_USB_SUBCLASS));
            if (!iface) {
                throw new Error('No Aeon USB interface found on device');
            }
            interfaceNum = iface.interfaceNumber;
            const alternate = iface.alternates.find((alt) => alt.interfaceClass === AEON_USB_INTERFACE_CLASS &&
                alt.interfaceSubclass === AEON_USB_SUBCLASS);
            for (const ep of alternate.endpoints) {
                if (ep.type === 'bulk') {
                    if (ep.direction === 'out' && outEp === undefined) {
                        outEp = ep.endpointNumber;
                    }
                    else if (ep.direction === 'in' && inEp === undefined) {
                        inEp = ep.endpointNumber;
                    }
                }
            }
        }
        if (interfaceNum === undefined || outEp === undefined || inEp === undefined) {
            throw new Error('Could not find bulk endpoints on Aeon USB interface');
        }
        await device.claimInterface(interfaceNum);
        const transport = new USBFlowTransport(device, interfaceNum, outEp, inEp, config?.transferSize ?? DEFAULT_TRANSFER_SIZE);
        // Start the read loop
        transport.startReadLoop();
        return transport;
    }
    /**
     * Create from an already-opened USB device (for testing or manual setup).
     */
    static fromDevice(device, interfaceNum, outEndpoint, inEndpoint, config) {
        const transport = new USBFlowTransport(device, interfaceNum, outEndpoint, inEndpoint, config?.transferSize ?? DEFAULT_TRANSFER_SIZE);
        transport.startReadLoop();
        return transport;
    }
    // ─── FlowTransport interface ───────────────────────────────────────
    send(data) {
        if (this.closed)
            return;
        // Length-prefixed framing
        const frame = new Uint8Array(LENGTH_PREFIX_SIZE + data.byteLength);
        const view = new DataView(frame.buffer);
        view.setUint32(0, data.byteLength, false);
        frame.set(data, LENGTH_PREFIX_SIZE);
        // Fire-and-forget bulk write
        this.device.transferOut(this.outEndpoint, frame).catch(() => {
            // Write failed — device disconnected
        });
    }
    onReceive(handler) {
        this.receiveHandler = handler;
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        this.readLoopRunning = false;
        this.receiveHandler = null;
        // Release interface and close device
        this.device.releaseInterface(this.interfaceNum).then(() => {
            this.device.close().catch(() => { });
        }).catch(() => { });
    }
    /** Whether the transport is still open */
    get isOpen() {
        return !this.closed;
    }
    /** Get the USB device info */
    get deviceInfo() {
        return {
            vendorId: this.device.vendorId,
            productId: this.device.productId,
            name: this.device.productName ?? this.device.serialNumber ?? 'Unknown',
        };
    }
    // ─── Internal: Continuous Read Loop ───────────────────────────────
    startReadLoop() {
        if (this.readLoopRunning)
            return;
        this.readLoopRunning = true;
        const loop = async () => {
            while (this.readLoopRunning && !this.closed) {
                try {
                    const result = await this.device.transferIn(this.inEndpoint, this.transferSize);
                    if (result.status === 'ok' && result.data && result.data.byteLength > 0) {
                        const chunk = new Uint8Array(result.data.buffer);
                        this.processChunk(chunk);
                    }
                }
                catch {
                    // Transfer failed — device may have disconnected
                    if (!this.closed) {
                        this.closed = true;
                        this.readLoopRunning = false;
                        this.receiveHandler = null;
                    }
                    return;
                }
            }
        };
        void loop();
    }
    processChunk(chunk) {
        // Append to reassembly buffer
        const combined = new Uint8Array(this.rxBuffer.byteLength + chunk.byteLength);
        combined.set(this.rxBuffer);
        combined.set(chunk, this.rxBuffer.byteLength);
        this.rxBuffer = combined;
        // Extract complete messages
        while (this.rxBuffer.byteLength >= LENGTH_PREFIX_SIZE) {
            const view = new DataView(this.rxBuffer.buffer, this.rxBuffer.byteOffset, this.rxBuffer.byteLength);
            const msgLen = view.getUint32(0, false);
            if (this.rxBuffer.byteLength < LENGTH_PREFIX_SIZE + msgLen) {
                break;
            }
            const message = this.rxBuffer.slice(LENGTH_PREFIX_SIZE, LENGTH_PREFIX_SIZE + msgLen);
            this.rxBuffer = this.rxBuffer.slice(LENGTH_PREFIX_SIZE + msgLen);
            this.receiveHandler?.(message);
        }
    }
}
