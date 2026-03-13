import { describe, expect, it } from 'vitest';

import {
  renderGnosisAdversarialControlsBenchmarkMarkdown,
  runGnosisAdversarialControlsBenchmark,
} from './gnosis-adversarial-controls-benchmark';

describe('Gnosis adversarial controls benchmark (§1.7, §6.12)', () => {
  it('shows symmetric boundary cases where sparse selection is the right inductive bias', async () => {
    const report = await runGnosisAdversarialControlsBenchmark();

    expect(report.allAdversarialPredictionsRecovered).toBe(true);
    expect(report.tasks['winner-affine-maxabs'].favoredStrategy).toBe('winner-take-all');
    expect(report.tasks['winner-affine-maxabs'].favoredStrategyWinsFinal).toBe(true);
    expect(report.tasks['winner-affine-maxabs'].favoredStrategyWinsSampleEfficiency).toBe(true);
    expect(
      report.tasks['early-stop-routing-first-expert-short-budget']
        .favoredStrategyWinsSampleEfficiency,
    ).toBe(true);
    expect(
      report.tasks['early-stop-left-priority-short-budget']
        .favoredStrategyWinsSampleEfficiency,
    ).toBe(true);
  });

  it('renders a markdown report with all adversarial tasks', async () => {
    const markdown = renderGnosisAdversarialControlsBenchmarkMarkdown(
      await runGnosisAdversarialControlsBenchmark(),
    );

    expect(markdown).toContain('# Gnosis Adversarial Controls Benchmark');
    expect(markdown).toContain('Winner-aligned affine max-abs task');
    expect(markdown).toContain('Early-stop aligned routed first-expert task');
    expect(markdown).toContain('Early-stop aligned left-priority task');
    expect(markdown).toContain('Learning-curve area');
  });
});
