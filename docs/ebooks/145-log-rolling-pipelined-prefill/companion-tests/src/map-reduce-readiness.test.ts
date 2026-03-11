/**
 * Map/Reduce Readiness Diagnostic — Companion Tests for §6.13
 *
 * Proves:
 *   1. Q_mr, O_beta and R_qr are bounded and well-formed in [0, 1]
 *   2. O_beta captures topological opportunity from the Bule deficit
 *   3. Q_mr captures structural readiness of map/reduce workloads
 *   4. R_qr = Q_mr * O_beta is high only when both readiness and opportunity are high
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

describe('Map/Reduce Readiness Diagnostic (§6.13)', () => {
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

  it('R_qr correlates with observed gain in a synthetic promotion harness', () => {
    const rng = makeRng(0x613);
    const sampleCount = 160;
    const readinessScores: number[] = [];
    const realizedGains: number[] = [];

    for (let index = 0; index < sampleCount; index++) {
      const intrinsicBeta1 = 4 + Math.floor(rng() * 60);
      const implementationBeta1 = Math.floor(rng() * intrinsicBeta1);

      const scores = computeReadinessScores({
        mapIndependence: rng(),
        reduceAssociativity: rng(),
        keySkew: rng(),
        zeroCopyRatio: rng(),
        intrinsicBeta1,
        implementationBeta1,
      });

      // Synthetic observed gain with bounded noise:
      // throughput gain follows R_qr under this harness model.
      const centeredNoise = (rng() - 0.5) * 0.12;
      const observedGain = clamp01(0.04 + 0.9 * scores.rQr + centeredNoise);

      readinessScores.push(scores.rQr);
      realizedGains.push(observedGain);
    }

    const slope = linearRegressionSlope(readinessScores, realizedGains);
    expect(slope).toBeGreaterThan(0.7);
  });
});

