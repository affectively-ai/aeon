import { describe, expect, it } from 'vitest';

import {
  renderGnosisFoldBoundaryRegimeSweepMarkdown,
  runGnosisFoldBoundaryRegimeSweep,
} from './gnosis-regime-sweep-benchmark';

describe('Gnosis fold boundary regime sweep (§1.7, §6.12)', () => {
  it('maps where linear advantage emerges as recombination demand increases', async () => {
    const report = await runGnosisFoldBoundaryRegimeSweep();

    expect(report.predictedBoundaryRecovered).toBe(true);
    expect(report.affine.topology.parameterCount).toBe(4);
    expect(report.routed.topology.parameterCount).toBe(16);
    expect(report.affine.firstSeparatedRegimeValue).toBe(0.5);
    expect(report.routed.firstSeparatedRegimeValue).toBe(0.75);
    expect(report.affine.points[0]?.linearAdvantageEvalMeanSquaredError ?? 1).toBeLessThan(0.05);
    expect(report.affine.points[4]?.linearAdvantageEvalMeanSquaredError ?? 0).toBeGreaterThan(0.3);
    expect(report.routed.points[0]?.linearAdvantageEvalMeanSquaredError ?? 1).toBeLessThan(0.01);
    expect(report.routed.points[4]?.linearAdvantageEvalMeanSquaredError ?? 0).toBeGreaterThan(0.1);
  });

  it('renders a markdown report with both regime families', async () => {
    const markdown = renderGnosisFoldBoundaryRegimeSweepMarkdown(
      await runGnosisFoldBoundaryRegimeSweep(),
    );

    expect(markdown).toContain('# Gnosis Fold Boundary Regime Sweep');
    expect(markdown).toContain('Affine cancellation regime sweep');
    expect(markdown).toContain('Routed dual-activation regime sweep');
    expect(markdown).toContain('First separated regime value');
  });
});
