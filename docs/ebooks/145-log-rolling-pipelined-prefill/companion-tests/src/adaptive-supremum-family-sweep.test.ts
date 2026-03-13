import { describe, expect, it } from 'vitest';

import {
  renderAdaptiveSupremumFamilySweepMarkdown,
  runAdaptiveSupremumFamilySweep,
} from './adaptive-supremum-family-sweep';

describe('Adaptive supremum family sweep', () => {
  it('recovers the bounded adaptive closure across a raw-parameter family', () => {
    const report = runAdaptiveSupremumFamilySweep();

    expect(report.label).toBe('adaptive-supremum-family-sweep-v1');
    expect(report.summary.caseCount).toBe(9);
    expect(report.summary.familyClosureRecovered).toBe(true);
    expect(report.summary.allRawAssumptionsSatisfied).toBe(true);
    expect(report.summary.schedulesRecoveredInEveryCase).toBe(true);
    expect(report.summary.allSpectralRadiusZero).toBe(true);
    expect(report.summary.maxStateCount).toBe(32);
    expect(report.summary.worstCaseId).toBe('tight-right-slack-2x2');
    expect(report.summary.minDriftGap).toBeCloseTo(0.026, 9);
    expect(report.summary.minRightSlack).toBeCloseTo(0.026, 9);
    for (const entry of report.cases) {
      expect(entry.rawAssumptionsSatisfied).toBe(true);
      expect(entry.allChecksPass).toBe(true);
      expect(entry.schedulesRecovered).toBe(true);
      expect(entry.spectralRadius).toBe(0);
      expect(entry.smallSetCount).toBe(1);
    }
  });

  it('renders a markdown summary table', () => {
    const markdown = renderAdaptiveSupremumFamilySweepMarkdown(
      runAdaptiveSupremumFamilySweep(),
    );

    expect(markdown).toContain('# Adaptive Supremum Family Sweep');
    expect(markdown).toContain('tight-right-slack-2x2');
    expect(markdown).toContain('| Case | Cube | Alpha left | Alpha right |');
  });
});
