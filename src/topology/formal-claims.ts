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
