/**
 * Aeon Flow Module
 *
 * The unified fork/race/collapse protocol primitive with a binary wire format.
 *
 * Protocol layers:
 *   Application (inference | esi | sync | ghost | speculate)
 *   Flow Layer  (fork/race/collapse, stream mux, backpressure, poison)
 *   Frame Layer (binary codec, zerocopy buffers)
 *   Transport   (WebSocket | TCP | UDP | WebRTC DataChannel | WebTransport | IPC)
 *
 * UDP transport: the 10-byte header is self-describing — stream_id + sequence
 * in every frame means frames can arrive out of order and be reassembled.
 * No TCP head-of-line blocking. Same insight as QUIC (HTTP/3) but with
 * 10-byte frames instead of QUIC's more complex framing.
 */
export { AeonFlowProtocol } from './AeonFlowProtocol';
export { FlowCodec, HEADER_SIZE, MAX_PAYLOAD_LENGTH } from './FlowCodec';
export { FORK, RACE, COLLAPSE, POISON, FIN, DEFAULT_FLOW_CONFIG, } from './types';
export type { FlowFrame, FlowStream, FlowStreamState, FlowTransport, FlowProtocolConfig, FlowProtocolEvents, } from './types';
export { UDPFlowTransport, WebTransportFlowTransport, UDP_MTU, FRAGMENT_HEADER_SIZE, MAX_FRAGMENT_PAYLOAD, ACK_FLAG, } from './UDPFlowTransport';
export type { UDPFlowTransportConfig } from './UDPFlowTransport';
export { FrameReassembler } from './frame-reassembler';
export type { ReassemblerConfig, ReassemblerStats } from './frame-reassembler';
