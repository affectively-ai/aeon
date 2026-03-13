import { describe, expect, it } from 'vitest';

import { runAdaptiveSupremumWitness } from './adaptive-supremum-witness';
import {
  loadCheckedInFormalAdaptiveWitnessCatalog,
  parseRationalLiteral,
  renderFormalAdaptiveWitnessCatalogMarkdown,
} from './formal-adaptive-witness-catalog';

describe('Formal adaptive witness catalog', () => {
  it('loads the Lean-emitted adaptive witness descriptor used by the runtime adaptive witness checks', () => {
    const report = loadCheckedInFormalAdaptiveWitnessCatalog();

    expect(report.label).toBe('formal-adaptive-supremum-witness-catalog-v1');
    expect(report.witnesses).toHaveLength(1);
    expect(report.witnesses[0]?.id).toBe('two-node-adaptive-raw-ceiling');
    expect(report.witnesses[0]?.stationaryBalanceRef).toContain(
      'kernelFamily_stationary_balance_from_supremum_schema',
    );
  });

  it('matches the checked runtime adaptive witness artifact on alpha and drift invariants', () => {
    const report = loadCheckedInFormalAdaptiveWitnessCatalog();
    const formal = report.witnesses[0];
    const runtime = runAdaptiveSupremumWitness();

    expect(formal).toBeDefined();
    expect(parseRationalLiteral(formal!.arrivalLeft)).toBeCloseTo(runtime.parameters.arrivalLeft, 12);
    expect(parseRationalLiteral(formal!.arrivalRight)).toBeCloseTo(runtime.parameters.arrivalRight, 12);
    expect(parseRationalLiteral(formal!.rerouteProbability)).toBeCloseTo(
      runtime.parameters.rerouteProbability,
      12,
    );
    expect(parseRationalLiteral(formal!.serviceLeft)).toBeCloseTo(runtime.parameters.serviceLeft, 12);
    expect(parseRationalLiteral(formal!.serviceRight)).toBeCloseTo(runtime.parameters.serviceRight, 12);
    expect(parseRationalLiteral(formal!.alphaLeft)).toBeCloseTo(runtime.candidate.left, 12);
    expect(parseRationalLiteral(formal!.alphaRight)).toBeCloseTo(runtime.candidate.right, 12);
    expect(parseRationalLiteral(formal!.driftGap)).toBeCloseTo(runtime.drift.gap, 12);
    expect(parseRationalLiteral(formal!.spectralRadius)).toBeCloseTo(
      runtime.ceiling.spectralRadius,
      12,
    );
    expect(formal!.stateCount).toBe(runtime.drift.stateCount);
    expect(formal!.smallSetCount).toBe(runtime.drift.smallSetCount);
  });

  it('renders a markdown manifest for the adaptive witness catalog', () => {
    const markdown = renderFormalAdaptiveWitnessCatalogMarkdown(
      loadCheckedInFormalAdaptiveWitnessCatalog(),
    );

    expect(markdown).toContain('# Formal Adaptive Witness Catalog');
    expect(markdown).toContain('two-node-adaptive-raw-ceiling');
    expect(markdown).toContain('constructiveThroughput_stable');
  });
});
