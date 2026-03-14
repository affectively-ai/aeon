import { describe, expect, it } from 'vitest';

import {
  buildCh17MoaTransformerFigureReport,
  renderCh17MoaTransformerFigureMarkdown,
  renderCh17MoaTransformerFigureSvg,
} from './ch17-moa-transformer-figure';
import { runGnosisMoaTransformerEvidenceBenchmark } from './gnosis-moa-transformer-evidence-benchmark';

describe('Chapter 17 MoA transformer figure', () => {
  it('builds a figure report from the GG-backed MoA evidence artifact surface', async () => {
    const figure = buildCh17MoaTransformerFigureReport(
      await runGnosisMoaTransformerEvidenceBenchmark()
    );

    expect(figure.label).toBe('ch17-moa-transformer-figure-v1');
    expect(figure.sourceLabel).toBe('gnosis-moa-transformer-evidence-v1');
    expect(figure.primitive).toBe('StructuredMoA');
    expect(figure.scalePoints).toHaveLength(3);
    expect(figure.ablationPoints).toHaveLength(4);
    expect(figure.speedupRange.max).toBeGreaterThan(figure.speedupRange.min);
    expect(figure.wideWorkload.accuracyGap).toBeLessThan(
      figure.scalePoints[0]?.accuracyGap ?? Number.POSITIVE_INFINITY
    );
  });

  it('renders markdown and svg outputs with sweep, frontier, and GG identity panels', async () => {
    const figure = buildCh17MoaTransformerFigureReport(
      await runGnosisMoaTransformerEvidenceBenchmark()
    );

    const markdown = renderCh17MoaTransformerFigureMarkdown(figure);
    const svg = renderCh17MoaTransformerFigureSvg(figure);

    expect(markdown).toContain('# Chapter 17 MoA Transformer Figure');
    expect(markdown).toContain('## Scale Sweep');
    expect(markdown).toContain('## Ablation Frontier');
    expect(markdown).toContain('StructuredMoA');
    expect(svg).toContain('<svg');
    expect(svg).toContain('Scale Sweep Speedup');
    expect(svg).toContain('Accuracy Gap Closes');
    expect(svg).toContain('Ablation Frontier');
    expect(svg).toContain('GG Surface');
  });
});
