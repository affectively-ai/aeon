import { describe, expect, it } from 'vitest';

import {
  buildCh17BoundaryExpansionFigureReport,
  renderCh17BoundaryExpansionFigureMarkdown,
  renderCh17BoundaryExpansionFigureSvg,
} from './ch17-boundary-expansion-figure';
import { runGnosisAdversarialControlsBenchmark } from './gnosis-adversarial-controls-benchmark';
import { runGnosisNearControlSweep } from './gnosis-near-control-sweep-benchmark';
import { runGnosisFoldBoundaryRegimeSweep } from './gnosis-regime-sweep-benchmark';

describe('Chapter 17 boundary expansion figure', () => {
  it('combines the near-control, regime-sweep, and adversarial artifacts into one report', async () => {
    const figure = buildCh17BoundaryExpansionFigureReport(
      await runGnosisNearControlSweep(),
      await runGnosisFoldBoundaryRegimeSweep(),
      await runGnosisAdversarialControlsBenchmark(),
    );

    expect(figure.label).toBe('ch17-boundary-expansion-figure-v2');
    expect(figure.sources.nearControlLabel).toBe('gnosis-near-control-sweep-v1');
    expect(figure.sources.regimeSweepLabel).toBe('gnosis-fold-boundary-regime-sweep-v1');
    expect(figure.sources.adversarialLabel).toBe('gnosis-adversarial-controls-benchmark-v1');
    expect(figure.nearControl.affine.lastParityRegimeValue).toBe(0.35);
    expect(figure.nearControl.affine.firstSeparatedRegimeValue).toBe(0.4);
    expect(figure.nearControl.routed.lastParityRegimeValue).toBe(0.6);
    expect(figure.nearControl.routed.firstSeparatedRegimeValue).toBe(0.65);
    expect(figure.affineRegime.firstSeparatedRegimeValue).toBe(0.5);
    expect(figure.routedRegime.firstSeparatedRegimeValue).toBe(0.75);
    expect(
      figure.adversarial.rankingByFinalEvalMeanSquaredError['winner-affine-maxabs']?.[0],
    ).toBe('winner-take-all');
    expect(
      figure.adversarial.rankingByLearningCurveArea['early-stop-left-priority-short-budget']?.[0],
    ).toBe('early-stop');
  });

  it('renders markdown and svg outputs with the near-control zoom and all four legacy panels', async () => {
    const figure = buildCh17BoundaryExpansionFigureReport(
      await runGnosisNearControlSweep(),
      await runGnosisFoldBoundaryRegimeSweep(),
      await runGnosisAdversarialControlsBenchmark(),
    );

    const markdown = renderCh17BoundaryExpansionFigureMarkdown(figure);
    const svg = renderCh17BoundaryExpansionFigureSvg(figure);

    expect(markdown).toContain('# Chapter 17 Boundary Expansion Figure');
    expect(markdown).toContain('## Near-Control Zoom');
    expect(markdown).toContain('## Regime Sweep');
    expect(markdown).toContain('## Adversarial Controls');
    expect(svg).toContain('<svg');
    expect(svg).toContain('Near-Control Zoom');
    expect(svg).toContain('Affine Regime Sweep');
    expect(svg).toContain('Routed Regime Sweep');
    expect(svg).toContain('Adversarial Final Error');
    expect(svg).toContain('Adversarial Learning Area');
  });
});
