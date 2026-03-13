import { describe, expect, it } from 'vitest';

import {
  renderAdaptiveSupremumWitnessMarkdown,
  runAdaptiveSupremumWitness,
} from './adaptive-supremum-witness';

describe('Adaptive supremum witness', () => {
  it('recovers the two-node ceiling, candidate, and drift checks without violations', () => {
    const report = runAdaptiveSupremumWitness();

    expect(report.label).toBe('adaptive-supremum-witness-v1');
    expect(report.allChecksPass).toBe(true);
    expect(report.ceiling.spectralRadius).toBe(0);
    expect(report.ceiling.squareIsZero).toBe(true);
    expect(report.ceiling.strictRowSubstochastic).toBe(true);
    expect(report.candidate.fixedPointResidualLeft).toBe(0);
    expect(report.candidate.fixedPointResidualRight).toBe(0);
    expect(report.candidate.serviceSlackLeft).toBeGreaterThan(0);
    expect(report.candidate.serviceSlackRight).toBeGreaterThan(0);
    expect(report.drift.gap).toBeCloseTo(0.125, 12);
    expect(report.drift.dominationViolations).toBe(0);
    expect(report.drift.rowSumViolations).toBe(0);
    expect(report.drift.driftViolations).toBe(0);

    const alwaysUncongested = report.schedules.find((schedule) => schedule.id === 'always-uncongested');
    const alwaysCongested = report.schedules.find((schedule) => schedule.id === 'always-congested');
    const alternating = report.schedules.find((schedule) => schedule.id === 'alternating');

    expect(alwaysUncongested?.supremum.right).toBeCloseTo(report.parameters.arrivalRight, 12);
    expect(alwaysCongested?.supremum.right).toBeCloseTo(report.candidate.right, 12);
    expect(alwaysCongested?.allApproximantsBoundedByCandidate).toBe(true);
    expect(alternating?.recoveredExpectedSupremum).toBe(true);
  });

  it('renders a markdown report for the executable adaptive witness', () => {
    const markdown = renderAdaptiveSupremumWitnessMarkdown(runAdaptiveSupremumWitness());

    expect(markdown).toContain('# Adaptive Supremum Witness');
    expect(markdown).toContain('Spectral radius: 0.000');
    expect(markdown).toContain('always-congested');
    expect(markdown).toContain('Drift gap: 0.125');
  });
});
