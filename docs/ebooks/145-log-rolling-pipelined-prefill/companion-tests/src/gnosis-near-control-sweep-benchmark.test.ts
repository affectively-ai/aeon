import { describe, expect, it } from 'vitest';

import {
  renderGnosisNearControlSweepMarkdown,
  runGnosisNearControlSweep,
} from './gnosis-near-control-sweep-benchmark';

describe('Gnosis near-control sweep (§1.7, §6.12)', () => {
  it('shows parity persisting at the control end before separation opens', async () => {
    const report = await runGnosisNearControlSweep();

    expect(report.label).toBe('gnosis-near-control-sweep-v1');
    expect(report.predictedNearControlRecovered).toBe(true);
    expect(report.affine.lastParityRegimeValue).toBe(0.35);
    expect(report.affine.firstSeparatedRegimeValue).toBe(0.4);
    expect(report.routed.lastParityRegimeValue).toBe(0.6);
    expect(report.routed.firstSeparatedRegimeValue).toBe(0.65);
    expect(report.affine.points[0]?.linearAdvantageEvalMeanSquaredError ?? 1).toBeLessThan(0.01);
    expect(report.routed.points[0]?.linearAdvantageEvalMeanSquaredError ?? 1).toBeLessThan(0.01);
  });

  it('renders a markdown report for the near-control zoom', async () => {
    const markdown = renderGnosisNearControlSweepMarkdown(await runGnosisNearControlSweep());

    expect(markdown).toContain('# Gnosis Near-Control Sweep');
    expect(markdown).toContain('Last parity regime value');
    expect(markdown).toContain('First separated regime value');
    expect(markdown).toContain('Near-control divergence recovered');
  });
});
