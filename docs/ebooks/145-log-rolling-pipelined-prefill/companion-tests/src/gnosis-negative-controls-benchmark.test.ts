import { describe, expect, it } from 'vitest';

import {
  renderGnosisNegativeControlsBenchmarkMarkdown,
  runGnosisNegativeControlsBenchmark,
} from './gnosis-negative-controls-benchmark';

describe('Gnosis negative controls benchmark (§1.7, §6.12)', () => {
  it('shows parity on one-path control tasks where additive recombination is unnecessary', async () => {
    const report = await runGnosisNegativeControlsBenchmark();

    expect(report.label).toBe('gnosis-negative-controls-v1');
    expect(report.allControlsPass).toBe(true);
    expect(report.tasks['affine-left-only'].parityRecovered).toBe(true);
    expect(report.tasks['routing-positive-x-only'].parityRecovered).toBe(true);
    expect(report.tasks['affine-left-only'].maxEvalMeanSquaredErrorGap).toBeLessThanOrEqual(0.02);
    expect(report.tasks['routing-positive-x-only'].maxEvalMeanSquaredErrorGap).toBeLessThanOrEqual(
      0.04,
    );
  });

  it('renders a markdown report with both control tasks', async () => {
    const markdown = renderGnosisNegativeControlsBenchmarkMarkdown(
      await runGnosisNegativeControlsBenchmark(),
    );

    expect(markdown).toContain('# Gnosis Negative Controls Benchmark');
    expect(markdown).toContain('Affine left-only control');
    expect(markdown).toContain('Positive-x single-expert routing control');
  });
});
