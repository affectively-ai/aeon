import { describe, expect, it } from 'vitest';

import {
  renderGnosisMiniMoeRoutingBenchmarkMarkdown,
  runGnosisMiniMoeRoutingBenchmark,
} from './gnosis-moe-routing-benchmark';

describe('Gnosis mini-MoE routing benchmark (§1.7, §6.12)', () => {
  it('keeps the routed topology parameter-matched while learned performance separates by fold rule', async () => {
    const report = await runGnosisMiniMoeRoutingBenchmark();

    expect(report.topology.parameterCount).toBe(16);
    expect(report.topology.expertCount).toBe(4);
    expect(report.predictedRankingMatches).toBe(true);
    expect(report.rankingByEvalMeanSquaredError).toEqual([
      'linear',
      'winner-take-all',
      'early-stop',
    ]);

    expect(report.strategies.linear.meanEvalMeanSquaredError).toBeLessThan(0.01);
    expect(report.strategies.linear.meanExactWithinToleranceFraction).toBeGreaterThan(0.9);
    expect(report.strategies['winner-take-all'].meanEvalMeanSquaredError).toBeGreaterThan(0.2);
    expect(report.strategies['early-stop'].meanEvalMeanSquaredError).toBeGreaterThan(
      report.strategies['winner-take-all'].meanEvalMeanSquaredError,
    );
    expect(report.strategies['winner-take-all'].meanDualActiveRegionMeanAbsoluteError).toBeGreaterThan(
      0.3,
    );
  });

  it('renders a markdown report with interval-backed routed metrics', async () => {
    const markdown = renderGnosisMiniMoeRoutingBenchmarkMarkdown(
      await runGnosisMiniMoeRoutingBenchmark(),
    );

    expect(markdown).toContain('# Gnosis Mini-MoE Routing Benchmark');
    expect(markdown).toContain('Eval MSE 95% CI');
    expect(markdown).toContain('Dual-active abs error');
    expect(markdown).toContain('winner-take-all');
  });
});
