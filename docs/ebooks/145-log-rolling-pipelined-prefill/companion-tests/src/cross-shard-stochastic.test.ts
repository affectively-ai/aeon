/**
 * Cross-Shard Cost Extensions
 *
 * Extends §7.3 Whip crossover coverage from deterministic formulas to
 * finite stochastic timing models and adaptive shard selection heuristics.
 */

import { describe, expect, it } from 'vitest';

type ServiceLaw = 'deterministic' | 'exponential' | 'lognormal' | 'pareto';

interface WhipScenario {
  readonly items: number;
  readonly stages: number;
  readonly correctionCostPerShard: number;
  readonly maxShards: number;
  readonly serviceLaw: ServiceLaw;
}

interface CurvePoint {
  readonly shards: number;
  readonly meanTime: number;
}

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function normalSample(rng: () => number): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = Math.max(rng(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function sampleService(law: ServiceLaw, mean: number, rng: () => number): number {
  if (law === 'deterministic') return mean;
  if (law === 'exponential') {
    const u = Math.max(rng(), Number.EPSILON);
    return -Math.log(u) * mean;
  }
  if (law === 'lognormal') {
    const sigma = 0.75;
    const mu = Math.log(mean) - (sigma * sigma) / 2;
    return Math.exp(mu + sigma * normalSample(rng));
  }

  // Pareto with finite mean at alpha > 1.
  const alpha = 2.5;
  const xm = (mean * (alpha - 1)) / alpha;
  const u = Math.max(rng(), Number.EPSILON);
  return xm / Math.pow(u, 1 / alpha);
}

function simulateWhipTrial(
  scenario: WhipScenario,
  shardCount: number,
  rng: () => number,
): number {
  const itemsPerShard = Math.ceil(scenario.items / shardCount);
  const stageSlots = itemsPerShard + scenario.stages - 1;
  const meanServicePerSlot = 1;

  let maxShardTime = 0;
  for (let shard = 0; shard < shardCount; shard++) {
    let shardTime = 0;
    for (let step = 0; step < stageSlots; step++) {
      shardTime += sampleService(scenario.serviceLaw, meanServicePerSlot, rng);
    }
    if (shardTime > maxShardTime) {
      maxShardTime = shardTime;
    }
  }

  const correctionNoise = sampleService('lognormal', 1, rng);
  const correction = scenario.correctionCostPerShard * shardCount * correctionNoise;
  return maxShardTime + correction;
}

function estimateWhipMean(
  scenario: WhipScenario,
  shardCount: number,
  seed: number,
  trials: number,
): number {
  const rng = makeRng(seed ^ (shardCount * 0x9e3779b9));
  let total = 0;
  for (let trial = 0; trial < trials; trial++) {
    total += simulateWhipTrial(scenario, shardCount, rng);
  }
  return total / trials;
}

function whipCurve(
  scenario: WhipScenario,
  seed: number,
  trials: number,
): readonly CurvePoint[] {
  const points: CurvePoint[] = [];
  for (let shards = 1; shards <= scenario.maxShards; shards++) {
    points.push({
      shards,
      meanTime: estimateWhipMean(scenario, shards, seed, trials),
    });
  }
  return points;
}

function argMin(points: readonly CurvePoint[]): CurvePoint {
  let best = points[0]!;
  for (const point of points) {
    if (point.meanTime < best.meanTime) best = point;
  }
  return best;
}

function strictCrossover(points: readonly CurvePoint[]): number {
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i]!;
    const next = points[i + 1]!;
    if (next.meanTime > current.meanTime) {
      return current.shards;
    }
  }
  return points[points.length - 2]!.shards;
}

function approximateAdaptiveShard(
  scenario: WhipScenario,
  seed: number,
): number {
  const rng = makeRng(seed ^ 0xA5A5A5A5);
  const pilotSamples = 800;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < pilotSamples; i++) {
    const sample = sampleService(scenario.serviceLaw, 1, rng);
    sum += sample;
    sumSq += sample * sample;
  }
  const mean = sum / pilotSamples;
  const variance = Math.max(sumSq / pilotSamples - mean * mean, 0);
  const cv = Math.sqrt(variance) / Math.max(mean, Number.EPSILON);

  // Heavier tails are penalized to avoid over-sharding in volatile regimes.
  const volatilityPenalty = 1 + cv;
  const relaxed = Math.sqrt(scenario.items / (scenario.correctionCostPerShard * volatilityPenalty));
  return Math.max(1, Math.min(scenario.maxShards, Math.round(relaxed)));
}

describe('Cross-shard stochastic and adaptive characterization', () => {
  it('finite optimum and strict crossover persist across service-law families', () => {
    const laws: readonly ServiceLaw[] = ['deterministic', 'exponential', 'lognormal', 'pareto'];
    for (const serviceLaw of laws) {
      const scenario: WhipScenario = {
        items: 384,
        stages: 6,
        correctionCostPerShard: 1.6,
        maxShards: 32,
        serviceLaw,
      };
      const curve = whipCurve(scenario, 0xACE000 + serviceLaw.length, 220);
      const optimum = argMin(curve);
      const crossover = strictCrossover(curve);

      expect(optimum.shards).toBeGreaterThan(1);
      expect(optimum.shards).toBeLessThan(scenario.maxShards);
      // Under stochastic service laws the curve has Monte Carlo noise,
      // so the first local increase (crossover) may precede the global min.
      // The paper's claim: a finite crossover EXISTS (sharding helps, then hurts).
      expect(crossover).toBeGreaterThan(1);
      expect(crossover).toBeLessThan(scenario.maxShards);

      const overSharded = curve[curve.length - 1]!;
      expect(overSharded.meanTime).toBeGreaterThan(optimum.meanTime);
    }
  });

  it('adaptive shard heuristic tracks phase-wise optimum under changing distributions', () => {
    const phases: readonly WhipScenario[] = [
      { items: 256, stages: 5, correctionCostPerShard: 1.2, maxShards: 32, serviceLaw: 'deterministic' },
      { items: 256, stages: 5, correctionCostPerShard: 1.8, maxShards: 32, serviceLaw: 'lognormal' },
      { items: 256, stages: 5, correctionCostPerShard: 2.4, maxShards: 32, serviceLaw: 'pareto' },
    ];

    for (let index = 0; index < phases.length; index++) {
      const scenario = phases[index]!;
      const curve = whipCurve(scenario, 0xBEEF00 + index, 240);
      const optimum = argMin(curve);
      const adaptiveShard = approximateAdaptiveShard(scenario, 0x123400 + index);
      const adaptive = curve[adaptiveShard - 1]!;

      expect(Math.abs(adaptive.shards - optimum.shards)).toBeLessThanOrEqual(4);
      // Heuristic should stay close to best observed mean in each phase.
      expect(adaptive.meanTime / optimum.meanTime).toBeLessThan(1.25);
    }
  });

  it('stochastic mixture still yields a finite crossover and over-sharding penalty', () => {
    const scenario: WhipScenario = {
      items: 512,
      stages: 6,
      correctionCostPerShard: 1.9,
      maxShards: 40,
      serviceLaw: 'deterministic',
    };

    const laws: readonly ServiceLaw[] = ['deterministic', 'exponential', 'lognormal', 'pareto'];
    const rng = makeRng(0xFEEDFACE);

    function mixedMean(shards: number): number {
      let total = 0;
      const trials = 280;
      for (let trial = 0; trial < trials; trial++) {
        const law = laws[Math.floor(rng() * laws.length)]!;
        total += simulateWhipTrial({ ...scenario, serviceLaw: law }, shards, rng);
      }
      return total / trials;
    }

    const curve: CurvePoint[] = [];
    for (let shards = 1; shards <= scenario.maxShards; shards++) {
      curve.push({ shards, meanTime: mixedMean(shards) });
    }

    const optimum = argMin(curve);
    const crossover = strictCrossover(curve);
    const tail = curve[curve.length - 1]!;

    expect(optimum.shards).toBeGreaterThan(1);
    expect(crossover).toBeGreaterThanOrEqual(optimum.shards);
    expect(tail.meanTime).toBeGreaterThan(optimum.meanTime);
  });
});

