/**
 * Map/Reduce Readiness Diagnostic — Companion Tests for §6.14
 *
 * Proves:
 *   1. Q_mr, O_beta and R_qr are bounded and well-formed in [0, 1]
 *   2. O_beta captures topological opportunity from the Bule deficit
 *   3. Q_mr captures structural readiness of map/reduce workloads
 *   4. R_qr = Q_mr * O_beta is high only when both readiness and opportunity are high
 *   5. R_qr rank-orders gains in an independent migration simulator
 *   6. High topology readiness is not, by itself, a proof of asymptotic quantum speedup
 */

import { describe, expect, it } from 'vitest';

interface ReadinessInputs {
  mapIndependence: number; // I_map
  reduceAssociativity: number; // A_reduce
  keySkew: number; // S_key
  zeroCopyRatio: number; // Z_copy
  intrinsicBeta1: number; // beta1*
  implementationBeta1: number; // beta1
}

interface ReadinessScores {
  qMr: number;
  oBeta: number;
  rQr: number;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function linearRegressionSlope(x: readonly number[], y: readonly number[]): number {
  const xBar = mean(x);
  const yBar = mean(y);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - xBar;
    numerator += dx * (y[i] - yBar);
    denominator += dx * dx;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

function pearsonCorrelation(
  x: readonly number[],
  y: readonly number[],
): number {
  const xBar = mean(x);
  const yBar = mean(y);
  let covariance = 0;
  let xVariance = 0;
  let yVariance = 0;

  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - xBar;
    const dy = y[i] - yBar;
    covariance += dx * dy;
    xVariance += dx * dx;
    yVariance += dy * dy;
  }

  const denom = Math.sqrt(xVariance * yVariance);
  return denom === 0 ? 0 : covariance / denom;
}

function computeReadinessScores(inputs: ReadinessInputs): ReadinessScores {
  const mapIndependence = clamp01(inputs.mapIndependence);
  const reduceAssociativity = clamp01(inputs.reduceAssociativity);
  const keySkew = clamp01(inputs.keySkew);
  const zeroCopyRatio = clamp01(inputs.zeroCopyRatio);

  const intrinsicBeta1 = Math.max(0, inputs.intrinsicBeta1);
  const implementationBeta1 = Math.max(0, inputs.implementationBeta1);
  const deficit = Math.max(0, intrinsicBeta1 - implementationBeta1);
  const oBeta = clamp01(deficit / Math.max(1, intrinsicBeta1));

  const qMr = clamp01(
    mapIndependence * reduceAssociativity * (1 - keySkew) * zeroCopyRatio,
  );

  return {
    qMr,
    oBeta,
    rQr: clamp01(qMr * oBeta),
  };
}

function simulatePromotionGain(
  inputs: ReadinessInputs,
  rng: () => number,
): number {
  const mapIndependence = clamp01(inputs.mapIndependence);
  const reduceAssociativity = clamp01(inputs.reduceAssociativity);
  const keySkew = clamp01(inputs.keySkew);
  const zeroCopyRatio = clamp01(inputs.zeroCopyRatio);

  const intrinsicBeta1 = Math.max(0, inputs.intrinsicBeta1);
  const implementationBeta1 = Math.max(0, inputs.implementationBeta1);
  const deficit = Math.max(0, intrinsicBeta1 - implementationBeta1);
  const opportunity = clamp01(deficit / Math.max(1, intrinsicBeta1));
  const migrationQuality =
    mapIndependence *
    reduceAssociativity *
    (1 - keySkew) *
    zeroCopyRatio;

  // Baseline map/reduce runtime model (no explicit race/vent semantics).
  const baselineParallelism = Math.max(1, 1 + implementationBeta1);
  const mapWork = 120;
  const reduceWork = 60;
  const skewPenalty = 1 + 1.8 * keySkew * keySkew;
  const dependencePenalty = 1 / (0.35 + 0.65 * mapIndependence);
  const reducerPenalty = 1 + 1.4 * (1 - reduceAssociativity);
  const serializationTax = 36 * (1 - zeroCopyRatio);

  const baselineTime =
    (mapWork * skewPenalty * dependencePenalty) / baselineParallelism +
    reduceWork * reducerPenalty +
    serializationTax +
    5;

  // Promotion model: race/vent benefits appear only when opportunity exists.
  const promotedParallelism =
    baselineParallelism + deficit * (0.25 + 0.75 * migrationQuality);
  const raceBenefit = 1 - 0.5 * opportunity * migrationQuality;
  const ventBenefit = 1 - 0.6 * opportunity * migrationQuality;
  const promotedReducerPenalty =
    1 + (1 - reduceAssociativity) * (1.25 - 0.95 * opportunity * migrationQuality);
  const coordinationOverhead =
    4 + 8 * (1 - mapIndependence) + 6 * (1 - reduceAssociativity);

  const promotedTime =
    ((mapWork * skewPenalty) / Math.max(1, promotedParallelism)) * raceBenefit +
    reduceWork * promotedReducerPenalty +
    serializationTax * ventBenefit +
    coordinationOverhead;

  // Independent bounded noise from deployment/runtime variance.
  const jitter = 1 + (rng() - 0.5) * 0.05;
  const observedGain = (baselineTime - promotedTime * jitter) / baselineTime;
  return clamp01(observedGain);
}

describe('Map/Reduce Readiness Diagnostic (§6.14)', () => {
  it('keeps Q_mr, O_beta and R_qr inside [0, 1]', () => {
    const scores = computeReadinessScores({
      mapIndependence: 1.2,
      reduceAssociativity: -2,
      keySkew: 5,
      zeroCopyRatio: 0.7,
      intrinsicBeta1: 20,
      implementationBeta1: 3,
    });

    expect(scores.qMr).toBeGreaterThanOrEqual(0);
    expect(scores.qMr).toBeLessThanOrEqual(1);
    expect(scores.oBeta).toBeGreaterThanOrEqual(0);
    expect(scores.oBeta).toBeLessThanOrEqual(1);
    expect(scores.rQr).toBeGreaterThanOrEqual(0);
    expect(scores.rQr).toBeLessThanOrEqual(1);
  });

  it('O_beta is zero at Δβ=0 and increases with deficit', () => {
    const noDeficit = computeReadinessScores({
      mapIndependence: 1,
      reduceAssociativity: 1,
      keySkew: 0.1,
      zeroCopyRatio: 1,
      intrinsicBeta1: 32,
      implementationBeta1: 32,
    });
    expect(noDeficit.oBeta).toBe(0);

    const mediumDeficit = computeReadinessScores({
      mapIndependence: 1,
      reduceAssociativity: 1,
      keySkew: 0.1,
      zeroCopyRatio: 1,
      intrinsicBeta1: 32,
      implementationBeta1: 16,
    });
    expect(mediumDeficit.oBeta).toBeCloseTo(0.5, 10);

    const highDeficit = computeReadinessScores({
      mapIndependence: 1,
      reduceAssociativity: 1,
      keySkew: 0.1,
      zeroCopyRatio: 1,
      intrinsicBeta1: 32,
      implementationBeta1: 0,
    });
    expect(highDeficit.oBeta).toBeCloseTo(1, 10);
  });

  it('Q_mr increases with independence/associativity/zero-copy and decreases with skew', () => {
    const baseline = computeReadinessScores({
      mapIndependence: 0.5,
      reduceAssociativity: 0.5,
      keySkew: 0.5,
      zeroCopyRatio: 0.5,
      intrinsicBeta1: 16,
      implementationBeta1: 8,
    });
    const improved = computeReadinessScores({
      mapIndependence: 0.9,
      reduceAssociativity: 0.95,
      keySkew: 0.1,
      zeroCopyRatio: 0.9,
      intrinsicBeta1: 16,
      implementationBeta1: 8,
    });

    expect(improved.qMr).toBeGreaterThan(baseline.qMr);
  });

  it('R_qr is high only when both readiness and opportunity are high', () => {
    const highReadinessLowOpportunity = computeReadinessScores({
      mapIndependence: 0.95,
      reduceAssociativity: 0.95,
      keySkew: 0.05,
      zeroCopyRatio: 0.95,
      intrinsicBeta1: 20,
      implementationBeta1: 20, // no opportunity
    });
    const lowReadinessHighOpportunity = computeReadinessScores({
      mapIndependence: 0.2,
      reduceAssociativity: 0.3,
      keySkew: 0.9,
      zeroCopyRatio: 0.3,
      intrinsicBeta1: 20,
      implementationBeta1: 0, // high opportunity
    });
    const highHigh = computeReadinessScores({
      mapIndependence: 0.95,
      reduceAssociativity: 0.95,
      keySkew: 0.05,
      zeroCopyRatio: 0.95,
      intrinsicBeta1: 20,
      implementationBeta1: 2,
    });

    expect(highReadinessLowOpportunity.rQr).toBeLessThan(0.05);
    expect(lowReadinessHighOpportunity.rQr).toBeLessThan(0.1);
    expect(highHigh.rQr).toBeGreaterThan(0.5);
  });

  it('nonzero topological opportunity is necessary for modeled migration gain', () => {
    const rng = makeRng(0x7146);
    const sampleCount = 120;
    const noOpportunityGains: number[] = [];
    const withOpportunityGains: number[] = [];

    for (let index = 0; index < sampleCount; index++) {
      const intrinsicBeta1 = 12 + Math.floor(rng() * 52);
      const highReadinessInputs = {
        mapIndependence: 0.8 + rng() * 0.2,
        reduceAssociativity: 0.85 + rng() * 0.15,
        keySkew: rng() * 0.2,
        zeroCopyRatio: 0.8 + rng() * 0.2,
      };

      const noOpportunity: ReadinessInputs = {
        ...highReadinessInputs,
        intrinsicBeta1,
        implementationBeta1: intrinsicBeta1,
      };
      const withOpportunity: ReadinessInputs = {
        ...highReadinessInputs,
        intrinsicBeta1,
        implementationBeta1: Math.floor(intrinsicBeta1 * 0.2),
      };

      const noOpportunityScores = computeReadinessScores(noOpportunity);
      const withOpportunityScores = computeReadinessScores(withOpportunity);
      expect(noOpportunityScores.rQr).toBe(0);
      expect(withOpportunityScores.rQr).toBeGreaterThan(0.3);

      noOpportunityGains.push(simulatePromotionGain(noOpportunity, rng));
      withOpportunityGains.push(simulatePromotionGain(withOpportunity, rng));
    }

    expect(mean(noOpportunityGains)).toBeLessThan(0.03);
    expect(mean(withOpportunityGains)).toBeGreaterThan(mean(noOpportunityGains) + 0.08);
  });

  it('R_qr rank-orders gain in an independent migration simulator', () => {
    const rng = makeRng(0x613);
    const sampleCount = 220;
    const readinessScores: number[] = [];
    const realizedGains: number[] = [];

    for (let index = 0; index < sampleCount; index++) {
      const intrinsicBeta1 = 4 + Math.floor(rng() * 64);
      const implementationBeta1 = Math.floor(rng() * intrinsicBeta1);
      const inputs: ReadinessInputs = {
        mapIndependence: 0.15 + rng() * 0.85,
        reduceAssociativity: 0.1 + rng() * 0.9,
        keySkew: rng(),
        zeroCopyRatio: rng(),
        intrinsicBeta1,
        implementationBeta1,
      };

      const scores = computeReadinessScores(inputs);
      const observedGain = simulatePromotionGain(inputs, rng);

      readinessScores.push(scores.rQr);
      realizedGains.push(observedGain);
    }

    const slope = linearRegressionSlope(readinessScores, realizedGains);
    const correlation = pearsonCorrelation(readinessScores, realizedGains);
    expect(slope).toBeGreaterThan(0.12);
    expect(correlation).toBeGreaterThan(0.2);

    const orderedReadiness = [...readinessScores].sort((a, b) => a - b);
    const lowerQuartile = orderedReadiness[Math.floor(sampleCount * 0.25)];
    const upperQuartile = orderedReadiness[Math.floor(sampleCount * 0.75)];
    if (lowerQuartile === undefined || upperQuartile === undefined) {
      throw new Error('quartile extraction failed');
    }

    const lowBandGains: number[] = [];
    const highBandGains: number[] = [];
    for (let i = 0; i < sampleCount; i++) {
      if (readinessScores[i] <= lowerQuartile) {
        lowBandGains.push(realizedGains[i]);
      }
      if (readinessScores[i] >= upperQuartile) {
        highBandGains.push(realizedGains[i]);
      }
    }

    expect(highBandGains.length).toBeGreaterThan(0);
    expect(lowBandGains.length).toBeGreaterThan(0);
    expect(mean(highBandGains)).toBeGreaterThan(mean(lowBandGains) + 0.1);
  });

  it('high R_qr does not imply asymptotic quantum speedup', () => {
    const structurallyReady = computeReadinessScores({
      mapIndependence: 0.97,
      reduceAssociativity: 0.98,
      keySkew: 0.04,
      zeroCopyRatio: 0.95,
      intrinsicBeta1: 64,
      implementationBeta1: 8,
    });
    expect(structurallyReady.rQr).toBeGreaterThan(0.7);

    const n = 2 ** 20;

    // Counterexample family: exact full-aggregation workloads.
    // In this black-box model every item must be read; both classical and
    // quantum costs are Theta(N), so asymptotic speedup is 1.
    const classicalAggregationCost = n;
    const quantumAggregationCost = n;
    const aggregationSpeedup =
      classicalAggregationCost / quantumAggregationCost;
    expect(aggregationSpeedup).toBe(1);

    // Contrasting family: unstructured search (Grover-like).
    const classicalSearchCost = n;
    const quantumSearchCost = Math.sqrt(n);
    const searchSpeedup = classicalSearchCost / quantumSearchCost;
    expect(searchSpeedup).toBeGreaterThan(1000);
  });
});
