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
import type { FlowTransport } from '../flow/types';
declare global {
    interface BluetoothLEScanFilter {
        services?: BluetoothServiceUUID[];
        name?: string;
        namePrefix?: string;
    }
    type BluetoothServiceUUID = string | number;
    interface BluetoothDevice extends EventTarget {
        readonly id: string;
        readonly name?: string;
        readonly gatt?: BluetoothRemoteGATTServer;
    }
    interface BluetoothRemoteGATTServer {
        readonly connected: boolean;
        readonly device: BluetoothDevice;
        connect(): Promise<BluetoothRemoteGATTServer>;
        disconnect(): void;
        getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
    }
    interface BluetoothRemoteGATTService {
        readonly device: BluetoothDevice;
        readonly uuid: string;
        getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
    }
    interface BluetoothRemoteGATTCharacteristic extends EventTarget {
        readonly service: BluetoothRemoteGATTService;
        readonly uuid: string;
        readonly value: DataView | null;
        writeValueWithoutResponse(value: BufferSource): Promise<void>;
        startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
        stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    }
    interface RequestDeviceOptions {
        filters?: BluetoothLEScanFilter[];
        optionalServices?: BluetoothServiceUUID[];
        acceptAllDevices?: boolean;
    }
    interface Bluetooth {
        requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
    }
    interface Navigator {
        bluetooth: Bluetooth;
    }
}
/** Aeon Flow BLE Service UUID */
export declare const AEON_FLOW_SERVICE_UUID = "0000af10-0000-1000-8000-00805f9b34fb";
/** TX Characteristic — write flow frames */
export declare const AEON_FLOW_TX_UUID = "0000af11-0000-1000-8000-00805f9b34fb";
/** RX Characteristic — receive flow frames (notify) */
export declare const AEON_FLOW_RX_UUID = "0000af12-0000-1000-8000-00805f9b34fb";
export interface BluetoothFlowConfig {
    /** BLE MTU (default: 509, negotiated at connection time) */
    mtu?: number;
    /** Service UUID override */
    serviceUuid?: string;
    /** Optional name filter for device discovery */
    namePrefix?: string;
}
/**
 * FlowTransport over Web Bluetooth GATT.
 *
 * Fragments flow frames to fit within BLE MTU, reassembles on receive.
 * Uses notifications on RX characteristic for incoming frames.
 */
export declare class BluetoothFlowTransport implements FlowTransport {
    private config;
    private device;
    private txChar;
    private rxChar;
    private receiveHandler;
    private mtu;
    private closed;
    /** Reassembly buffer for fragmented incoming frames */
    private rxBuffer;
    constructor(config?: BluetoothFlowConfig);
    /**
     * Scan for and connect to a nearby Aeon device.
     * Returns the connected device name.
     */
    connect(): Promise<string>;
    /**
     * Create from an already-connected GATT server (for peripheral/server mode).
     */
    static fromCharacteristics(tx: BluetoothRemoteGATTCharacteristic, rx: BluetoothRemoteGATTCharacteristic, config?: BluetoothFlowConfig): BluetoothFlowTransport;
    send(data: Uint8Array): void;
    onReceive(handler: (data: Uint8Array) => void): void;
    close(): void;
    /** Whether Bluetooth is connected */
    get isConnected(): boolean;
    private writeCharacteristic;
    private handleRxNotification;
    private endsWithBoundary;
}
