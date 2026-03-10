/**
 * Aeon Flow Protocol — Type Definitions
 *
 * The Aeon Flow Protocol extracts the fork/race/collapse primitive that
 * appears independently across the entire stack (inference, ESI, sync,
 * shell, frontend) into a unified, protocol-level abstraction with a
 * pure binary wire format.
 *
 * @see docs/ebooks/145-log-rolling-pipelined-prefill/ch14-aeon-flow-protocol.md
 */
// ═══════════════════════════════════════════════════════════════════════════════
// Frame Flags
// ═══════════════════════════════════════════════════════════════════════════════
/** Fork: opens child streams from a parent */
export const FORK = 0x01;
/** Race: marks streams as racing — first to complete wins */
export const RACE = 0x02;
/** Collapse: merge results from multiple streams into one */
export const COLLAPSE = 0x04;
/** Poison: NaN propagation, error, or cancellation */
export const POISON = 0x08;
/** Fin: stream is complete, no more frames will be sent */
export const FIN = 0x10;
/**
 * Default protocol configuration.
 */
export const DEFAULT_FLOW_CONFIG = {
    highWaterMark: 64,
    role: 'client',
    maxConcurrentStreams: 256,
};
