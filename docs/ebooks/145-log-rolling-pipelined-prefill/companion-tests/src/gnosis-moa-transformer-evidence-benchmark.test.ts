import { describe, expect, it } from 'vitest';

import {
  renderGnosisMoaTransformerEvidenceMarkdown,
  runGnosisMoaTransformerEvidenceBenchmark,
} from './gnosis-moa-transformer-evidence-benchmark';

describe('Gnosis MoA transformer evidence benchmark (§1.7, §6.12)', () => {
  it('surfaces the GG-backed sparse MoA evidence layer with timing and sparsity claims', async () => {
    const report = await runGnosisMoaTransformerEvidenceBenchmark({
      label: 'gnosis-moa-transformer-evidence-v1',
      base: {
        label: 'gnosis-moa-transformer-shootout-v1',
        seedCount: 3,
        epochs: 260,
        learningRate: 0.018,
        exactPredictionTolerance: 0.08,
        dualActiveThreshold: 0.4,
        frameStageCount: 4,
        activeBlockCount: 2,
        activeHeadCount: 2,
        trainAxis: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5],
        evalAxis: [-1.4, -0.8, -0.1, 0.4, 1.1],
        samplePoints: [
          [-1.2, -1.2],
          [-1.2, 1.2],
          [1.2, -1.2],
          [1.2, 1.2],
          [1.2, 0],
        ],
      },
      scales: [
        {
          id: 'compact',
          title: 'Compact workload',
          trainAxisPointCount: 5,
          evalAxisPointCount: 4,
          epochsMultiplier: 0.8,
        },
        {
          id: 'baseline',
          title: 'Baseline workload',
          trainAxisPointCount: 7,
          evalAxisPointCount: 5,
          epochsMultiplier: 1,
        },
      ],
      ablations: [
        {
          id: 'full-moa',
          title: 'Full MoA',
          description: 'Baseline outer and inner sparsity.',
          activeBlockCount: 2,
          activeHeadCount: 2,
        },
        {
          id: 'no-outer-sparsity',
          title: 'No outer sparsity',
          description: 'All blocks live, sparse heads retained.',
          activeBlockCount: 4,
          activeHeadCount: 2,
        },
        {
          id: 'no-inner-sparsity',
          title: 'No inner sparsity',
          description: 'Sparse blocks retained, all heads live.',
          activeBlockCount: 2,
          activeHeadCount: 4,
        },
        {
          id: 'under-routed',
          title: 'Under-routed',
          description: 'Only one block kept live.',
          activeBlockCount: 1,
          activeHeadCount: 2,
        },
      ],
    });

    expect(report.topologySurface.moaStructuredPrimitive).toBe('StructuredMoA');
    expect(report.topologySurface.moaTopologyPath).toContain(
      'moa-transformer-moa.gg'
    );
    expect(report.timingAdvantageRecovered).toBe(true);
    expect(report.accuracyGapClosesWithScale).toBe(true);
    expect(report.outerSparsityImprovesEfficiency).toBe(true);
    expect(report.innerSparsityImprovesEfficiency).toBe(true);
    expect(report.underRoutingHurtsAccuracy).toBe(true);
  });

  it('renders markdown with GG topology identity and evidence sections', async () => {
    const markdown = renderGnosisMoaTransformerEvidenceMarkdown(
      await runGnosisMoaTransformerEvidenceBenchmark({
        label: 'gnosis-moa-transformer-evidence-v1',
        base: {
          label: 'gnosis-moa-transformer-shootout-v1',
          seedCount: 2,
          epochs: 180,
          learningRate: 0.018,
          exactPredictionTolerance: 0.08,
          dualActiveThreshold: 0.4,
          frameStageCount: 4,
          activeBlockCount: 2,
          activeHeadCount: 2,
          trainAxis: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5],
          evalAxis: [-1.4, -0.8, -0.1, 0.4, 1.1],
          samplePoints: [
            [-1.2, -1.2],
            [-1.2, 1.2],
            [1.2, -1.2],
            [1.2, 1.2],
            [1.2, 0],
          ],
        },
        scales: [
          {
            id: 'compact',
            title: 'Compact workload',
            trainAxisPointCount: 5,
            evalAxisPointCount: 4,
            epochsMultiplier: 0.8,
          },
        ],
        ablations: [
          {
            id: 'full-moa',
            title: 'Full MoA',
            description: 'Baseline outer and inner sparsity.',
            activeBlockCount: 2,
            activeHeadCount: 2,
          },
          {
            id: 'under-routed',
            title: 'Under-routed',
            description: 'Only one block kept live.',
            activeBlockCount: 1,
            activeHeadCount: 2,
          },
        ],
      })
    );

    expect(markdown).toContain('# Gnosis MoA Transformer Evidence');
    expect(markdown).toContain('Sparse GG primitive');
    expect(markdown).toContain('StructuredMoA');
    expect(markdown).toContain('## Scale Sweep');
    expect(markdown).toContain('## Ablations');
  });
});
