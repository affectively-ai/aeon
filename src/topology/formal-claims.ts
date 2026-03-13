export interface WorthingtonWhipResult {
  readonly shards: number;
  readonly numerator: number;
  readonly denominator: number;
  readonly savingsFraction: number;
}

export interface SpeculativeTreeResult {
  readonly alpha: number;
  readonly depth: number;
  readonly expectedAccepted: number;
  readonly denominator: number;
}

export interface TurbulentIdleResult {
  readonly stageCount: number;
  readonly chunkCount: number;
  readonly numerator: number;
  readonly denominator: number;
  readonly idleFraction: number;
}

export interface FrontierFillResult {
  readonly frontierByLayer: readonly number[];
  readonly layerCount: number;
  readonly frontierArea: number;
  readonly peakFrontier: number;
  readonly envelopeArea: number;
  readonly frontierFill: number;
  readonly wallaceNumber: number;
  readonly wally: number;
  readonly frontierDeficit: number;
}

export interface PipelineOccupancyResult {
  readonly stageCount: number;
  readonly chunkCount: number;
  readonly frontierArea: number;
  readonly capacityArea: number;
  readonly frontierFill: number;
  readonly occupancyDeficit: number;
}

export type PipelineRegime = 'laminar' | 'transitional' | 'turbulent';

export type ParallelismAction =
  | 'expand'
  | 'staggered-expand'
  | 'hold'
  | 'multiplex'
  | 'constrain';

export interface AdaptiveParallelismPolicyResult {
  readonly intrinsicBeta1: number;
  readonly actualBeta1: number;
  readonly topologyDeficit: number;
  readonly stageCount: number;
  readonly chunkCount: number;
  readonly reynoldsEstimate: number;
  readonly regime: PipelineRegime;
  readonly frontierFill: number;
  readonly occupancyDeficit: number;
  readonly highOccupancyDeficit: boolean;
  readonly action: ParallelismAction;
  readonly rationale: string;
}

export interface QuantumDeficitResult {
  readonly sqrtN: number;
  readonly searchSize: number;
  readonly classicalDeficit: number;
  readonly quantumDeficit: number;
  readonly speedup: number;
}

export interface ProtocolDeficitResult {
  readonly streamCount: number;
  readonly intrinsicBeta1: number;
  readonly tcpDeficit: number;
  readonly quicDeficit: number;
  readonly flowDeficit: number;
}

export interface SettlementDeficitResult {
  readonly intrinsicBeta1: number;
  readonly sequentialDeficit: number;
  readonly parallelDeficit: number;
}

function assertPositiveInteger(name: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function assertUnitIntervalOpen(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`${name} must be in [0, 1)`);
  }
  return value;
}

function assertNonNegativeFinite(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
  return value;
}

function assertNonNegativeInteger(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function assertNonEmptyFrontier(frontierByLayer: readonly number[]): readonly number[] {
  if (frontierByLayer.length === 0) {
    throw new Error('frontierByLayer must contain at least one layer');
  }
  frontierByLayer.forEach((width, index) => {
    assertNonNegativeInteger(`frontierByLayer[${index}]`, width);
  });
  return frontierByLayer;
}

export function worthingtonWhipSavings(shards: number): WorthingtonWhipResult {
  const normalizedShards = assertPositiveInteger('shards', shards);
  const numerator = normalizedShards - 1;
  const denominator = 2 * normalizedShards;
  return {
    shards: normalizedShards,
    numerator,
    denominator,
    savingsFraction: numerator / denominator,
  };
}

export function speculativeTreeExpectedAccepted(
  alpha: number,
  depth: number,
): SpeculativeTreeResult {
  const normalizedAlpha = assertUnitIntervalOpen('alpha', alpha);
  const normalizedDepth = assertPositiveInteger('depth', depth);
  const denominator = 1 - normalizedAlpha;
  return {
    alpha: normalizedAlpha,
    depth: normalizedDepth,
    expectedAccepted:
      (1 - Math.pow(normalizedAlpha, normalizedDepth)) / denominator,
    denominator,
  };
}

export function turbulentIdleFraction(
  stageCount: number,
  chunkCount: number,
): TurbulentIdleResult {
  const normalizedStageCount = assertPositiveInteger('stageCount', stageCount);
  const normalizedChunkCount = assertPositiveInteger('chunkCount', chunkCount);
  const numerator = normalizedStageCount * (normalizedStageCount - 1);
  const denominator =
    normalizedStageCount * (normalizedChunkCount + normalizedStageCount - 1);
  return {
    stageCount: normalizedStageCount,
    chunkCount: normalizedChunkCount,
    numerator,
    denominator,
    idleFraction: numerator / denominator,
  };
}

export function frontierFill(
  frontierByLayer: readonly number[],
): FrontierFillResult {
  const normalizedFrontier = assertNonEmptyFrontier(frontierByLayer);
  const layerCount = normalizedFrontier.length;
  const frontierArea = normalizedFrontier.reduce((sum, width) => sum + width, 0);
  const peakFrontier = normalizedFrontier.reduce(
    (peak, width) => Math.max(peak, width),
    0,
  );
  const envelopeArea = layerCount * peakFrontier;
  const fill = envelopeArea === 0 ? 1 : frontierArea / envelopeArea;
  const wallaceNumber = 1 - fill;

  return {
    frontierByLayer: [...normalizedFrontier],
    layerCount,
    frontierArea,
    peakFrontier,
    envelopeArea,
    frontierFill: fill,
    wallaceNumber,
    wally: wallaceNumber,
    frontierDeficit: wallaceNumber,
  };
}

export function pipelineOccupancy(
  stageCount: number,
  chunkCount: number,
): PipelineOccupancyResult {
  const normalizedStageCount = assertPositiveInteger('stageCount', stageCount);
  const normalizedChunkCount = assertPositiveInteger('chunkCount', chunkCount);
  const frontierArea = normalizedStageCount * normalizedChunkCount;
  const capacityArea =
    normalizedStageCount *
    (normalizedChunkCount + normalizedStageCount - 1);
  const fill = frontierArea / capacityArea;

  return {
    stageCount: normalizedStageCount,
    chunkCount: normalizedChunkCount,
    frontierArea,
    capacityArea,
    frontierFill: fill,
    occupancyDeficit: 1 - fill,
  };
}

export function classifyPipelineRegime(
  stageCount: number,
  chunkCount: number,
): PipelineRegime {
  const normalizedStageCount = assertPositiveInteger('stageCount', stageCount);
  const normalizedChunkCount = assertPositiveInteger('chunkCount', chunkCount);
  const reynoldsEstimate = normalizedStageCount / normalizedChunkCount;

  if (reynoldsEstimate < 0.3) {
    return 'laminar';
  }
  if (reynoldsEstimate > 0.7) {
    return 'turbulent';
  }
  return 'transitional';
}

export function adaptiveParallelismPolicy(config: {
  intrinsicBeta1: number;
  actualBeta1: number;
  stageCount: number;
  chunkCount: number;
}): AdaptiveParallelismPolicyResult {
  const intrinsicBeta1 = assertNonNegativeFinite(
    'intrinsicBeta1',
    config.intrinsicBeta1,
  );
  const actualBeta1 = assertNonNegativeFinite('actualBeta1', config.actualBeta1);
  const occupancy = pipelineOccupancy(config.stageCount, config.chunkCount);
  const topologyDeficit = intrinsicBeta1 - actualBeta1;
  const regime = classifyPipelineRegime(config.stageCount, config.chunkCount);
  const highOccupancyDeficit = occupancy.occupancyDeficit >= 0.2;
  const reynoldsEstimate = config.stageCount / config.chunkCount;

  let action: ParallelismAction;
  let rationale: string;

  if (topologyDeficit > 0 && highOccupancyDeficit) {
    action = 'staggered-expand';
    rationale =
      'Natural parallelism exceeds the current topology, but warm-up overhead is still high; widen gradually rather than forking to the limit immediately.';
  } else if (topologyDeficit > 0) {
    action = 'expand';
    rationale =
      'The current implementation is too sequential for the problem and the wavefront is already filling efficiently enough to justify more parallelism.';
  } else if (topologyDeficit < 0 && highOccupancyDeficit) {
    action = 'constrain';
    rationale =
      'The system is already over-forked relative to the problem and early occupancy is poor; reduce single-request fan-out.';
  } else if (regime === 'turbulent') {
    action = 'multiplex';
    rationale =
      'The topology is not the bottleneck, but the pipeline is in a high-Reynolds turbulent regime; fill idle slots with cross-request work instead of widening one request.';
  } else {
    action = 'hold';
    rationale =
      'Topology and occupancy are aligned well enough that the current degree of parallelism should remain stable.';
  }

  return {
    intrinsicBeta1,
    actualBeta1,
    topologyDeficit,
    stageCount: config.stageCount,
    chunkCount: config.chunkCount,
    reynoldsEstimate,
    regime,
    frontierFill: occupancy.frontierFill,
    occupancyDeficit: occupancy.occupancyDeficit,
    highOccupancyDeficit,
    action,
    rationale,
  };
}

export function quantumDeficitIdentity(sqrtN: number): QuantumDeficitResult {
  const normalizedSqrtN = assertPositiveInteger('sqrtN', sqrtN);
  const searchSize = normalizedSqrtN * normalizedSqrtN;
  const classicalDeficit = normalizedSqrtN - 1;
  return {
    sqrtN: normalizedSqrtN,
    searchSize,
    classicalDeficit,
    quantumDeficit: 0,
    speedup: searchSize / normalizedSqrtN,
  };
}

export function protocolDeficits(streamCount: number): ProtocolDeficitResult {
  const normalizedStreamCount = assertPositiveInteger('streamCount', streamCount);
  if (normalizedStreamCount <= 1) {
    throw new Error('streamCount must be greater than 1');
  }
  const intrinsicBeta1 = normalizedStreamCount - 1;
  return {
    streamCount: normalizedStreamCount,
    intrinsicBeta1,
    tcpDeficit: intrinsicBeta1,
    quicDeficit: 0,
    flowDeficit: 0,
  };
}

export function settlementDeficits(): SettlementDeficitResult {
  return {
    intrinsicBeta1: 2,
    sequentialDeficit: 2,
    parallelDeficit: 0,
  };
}

export function beta2FromBandGap(forbiddenEnergyCount: number): number {
  const normalizedForbiddenCount = assertNonNegativeFinite(
    'forbiddenEnergyCount',
    forbiddenEnergyCount,
  );
  return normalizedForbiddenCount > 0 ? 1 : 0;
}

export function firstLawConserved(
  forkEnergy: number,
  foldWork: number,
  ventEnergy: number,
  tolerance = 1e-9,
): boolean {
  const normalizedForkEnergy = assertNonNegativeFinite('forkEnergy', forkEnergy);
  const normalizedFoldWork = assertNonNegativeFinite('foldWork', foldWork);
  const normalizedVentEnergy = assertNonNegativeFinite('ventEnergy', ventEnergy);
  if (normalizedFoldWork > normalizedForkEnergy) {
    return false;
  }
  const delta = Math.abs(
    normalizedForkEnergy - (normalizedFoldWork + normalizedVentEnergy),
  );
  return delta <= Math.max(tolerance, 0);
}
