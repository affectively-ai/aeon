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
import type { FlowTransport } from '../flow/types';
/** Aeon vendor-specific interface class */
export declare const AEON_USB_INTERFACE_CLASS = 255;
/** Aeon vendor-specific subclass */
export declare const AEON_USB_SUBCLASS = 174;
/** Aeon protocol ID within the interface */
export declare const AEON_USB_PROTOCOL = 1;
export interface USBFlowConfig {
    /** Interface number to claim (auto-detected if not specified) */
    interfaceNumber?: number;
    /** OUT endpoint number (auto-detected if not specified) */
    outEndpoint?: number;
    /** IN endpoint number (auto-detected if not specified) */
    inEndpoint?: number;
    /** Transfer size for bulk reads (default: 64KB) */
    transferSize?: number;
    /** USB vendor ID filter for device selection */
    vendorId?: number;
    /** USB product ID filter for device selection */
    productId?: number;
}
/**
 * FlowTransport over WebUSB bulk endpoints.
 *
 * Uses length-prefixed framing over bulk transfers to delineate
 * flow frame boundaries. Continuously polls the IN endpoint
 * for incoming data.
 */
export declare class USBFlowTransport implements FlowTransport {
    private device;
    private receiveHandler;
    private closed;
    private interfaceNum;
    private outEndpoint;
    private inEndpoint;
    private transferSize;
    private readLoopRunning;
    /** Reassembly buffer for length-prefixed framing */
    private rxBuffer;
    private constructor();
    /**
     * Connect to a USB device and create a FlowTransport.
     *
     * Requests device access, opens it, claims the Aeon interface,
     * and auto-detects bulk endpoints if not specified.
     */
    static connect(config?: USBFlowConfig): Promise<USBFlowTransport>;
    /**
     * Create from an already-opened USB device (for testing or manual setup).
     */
    static fromDevice(device: USBDevice, interfaceNum: number, outEndpoint: number, inEndpoint: number, config?: Partial<USBFlowConfig>): USBFlowTransport;
    send(data: Uint8Array): void;
    onReceive(handler: (data: Uint8Array) => void): void;
    close(): void;
    /** Whether the transport is still open */
    get isOpen(): boolean;
    /** Get the USB device info */
    get deviceInfo(): {
        vendorId: number;
        productId: number;
        name: string;
    };
    private startReadLoop;
    private processChunk;
}
