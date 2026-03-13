import { describe, expect, it } from 'vitest';

import {
  buildCh17BoundaryExpansionFigureReport,
  renderCh17BoundaryExpansionFigureMarkdown,
  renderCh17BoundaryExpansionFigureSvg,
} from './ch17-boundary-expansion-figure';
import { runGnosisAdversarialControlsBenchmark } from './gnosis-adversarial-controls-benchmark';
import { runGnosisFoldBoundaryRegimeSweep } from './gnosis-regime-sweep-benchmark';

describe('Chapter 17 boundary expansion figure', () => {
  it('combines the regime-sweep and adversarial artifacts into one report', async () => {
    const figure = buildCh17BoundaryExpansionFigureReport(
      await runGnosisFoldBoundaryRegimeSweep(),
      await runGnosisAdversarialControlsBenchmark(),
    );

    expect(figure.sources.regimeSweepLabel).toBe('gnosis-fold-boundary-regime-sweep-v1');
    expect(figure.sources.adversarialLabel).toBe('gnosis-adversarial-controls-benchmark-v1');
    expect(figure.affineRegime.firstSeparatedRegimeValue).toBe(0.5);
    expect(figure.routedRegime.firstSeparatedRegimeValue).toBe(0.75);
    expect(
      figure.adversarial.rankingByFinalEvalMeanSquaredError['winner-affine-maxabs']?.[0],
    ).toBe('winner-take-all');
    expect(
      figure.adversarial.rankingByLearningCurveArea['early-stop-left-priority-short-budget']?.[0],
    ).toBe('early-stop');
  });

  it('renders markdown and svg outputs with all four panels', async () => {
    const figure = buildCh17BoundaryExpansionFigureReport(
      await runGnosisFoldBoundaryRegimeSweep(),
      await runGnosisAdversarialControlsBenchmark(),
    );

    const markdown = renderCh17BoundaryExpansionFigureMarkdown(figure);
    const svg = renderCh17BoundaryExpansionFigureSvg(figure);

    expect(markdown).toContain('# Chapter 17 Boundary Expansion Figure');
    expect(markdown).toContain('## Regime Sweep');
    expect(markdown).toContain('## Adversarial Controls');
    expect(svg).toContain('<svg');
    expect(svg).toContain('Affine Regime Sweep');
    expect(svg).toContain('Routed Regime Sweep');
    expect(svg).toContain('Adversarial Final Error');
    expect(svg).toContain('Adversarial Learning Area');
  });
});
