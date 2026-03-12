/**
 * Topology Module — Betti Number Analysis and Topological Deficit Diagnostic
 *
 * Measures the shape of computation graphs and quantifies how far an
 * implementation deviates from its problem's natural topology.
 *
 * The topological deficit Δβ = β₁* - β₁ predicts real-world waste:
 *   Δβ = 0  → system operates at theoretical efficiency
 *   Δβ > 0  → measurable waste proportional to the deficit
 *
 * @see docs/ebooks/145-log-rolling-pipelined-prefill/ch17-arxiv-manuscript.md §6.12
 * @packageDocumentation
 */

export {
  TopologyAnalyzer,
  type ComputationGraph,
  type ComputationNode,
  type ComputationEdge,
  type TopologyReport,
  type BettiNumbers,
  type DeficitReport,
  type ForkJoinPair,
} from './TopologyAnalyzer';

export {
  TopologySampler,
  type SamplerConfig,
  type Sample,
  type SamplerReport,
} from './TopologySampler';

export {
  beta2FromBandGap,
  firstLawConserved,
  protocolDeficits,
  quantumDeficitIdentity,
  settlementDeficits,
  speculativeTreeExpectedAccepted,
  turbulentIdleFraction,
  worthingtonWhipSavings,
  type ProtocolDeficitResult,
  type QuantumDeficitResult,
  type SettlementDeficitResult,
  type SpeculativeTreeResult,
  type TurbulentIdleResult,
  type WorthingtonWhipResult,
} from './formal-claims';
