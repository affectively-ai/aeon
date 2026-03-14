import { describe, expect, it } from 'vitest';

import {
  renderGnosisAeonFramedTransformerBenchmarkMarkdown,
  runGnosisAeonFramedTransformerBenchmark,
} from './gnosis-aeon-framed-transformer-benchmark';

describe('Gnosis aeon-framed transformer benchmark (§7.1, §7.3)', () => {
  it('keeps the framed transformer battery parameter-matched while learned performance separates by fold rule', async () => {
    const report = await runGnosisAeonFramedTransformerBenchmark();

    expect(report.topology.parameterCount).toBe(16);
    expect(report.topology.transformerletCount).toBe(4);
    expect(report.topology.rotationStageCount).toBe(4);
    expect(report.predictedRankingMatches).toBe(true);
    expect(report.rankingByEvalMeanSquaredError).toEqual([
      'linear',
      'winner-take-all',
      'early-stop',
    ]);

    expect(report.strategies.linear.meanFrameCount).toBe(16);
    expect(report.strategies.linear.meanEvalMeanSquaredError).toBeLessThan(0.02);
    expect(report.strategies.linear.meanExactWithinToleranceFraction).toBeGreaterThan(0.9);
    expect(report.strategies['winner-take-all'].meanEvalMeanSquaredError).toBeGreaterThan(0.2);
    expect(report.strategies['early-stop'].meanEvalMeanSquaredError).toBeGreaterThan(
      report.strategies['winner-take-all'].meanEvalMeanSquaredError,
    );
    expect(report.strategies.linear.meanCodecRoundTripExactFraction).toBe(1);
    expect(report.strategies.linear.meanReassemblyExactFraction).toBe(1);
    expect(report.strategies.linear.meanFoldInvarianceExactFraction).toBe(1);
  });

  it('renders a markdown report with interval-backed semantic and frame metrics', async () => {
    const markdown = renderGnosisAeonFramedTransformerBenchmarkMarkdown(
      await runGnosisAeonFramedTransformerBenchmark(),
    );

    expect(markdown).toContain('# Gnosis Aeon-Framed Transformer Benchmark');
    expect(markdown).toContain('Codec round-trip');
    expect(markdown).toContain('Reassembly');
    expect(markdown).toContain('winner-take-all');
  });
});
