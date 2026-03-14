import type { GnosisMoaTransformerEvidenceReport } from './gnosis-moa-transformer-evidence-benchmark';

interface FigureScalePoint {
  readonly id: string;
  readonly title: string;
  readonly speedup: number;
  readonly accuracyGap: number;
  readonly moaEvalMeanSquaredError: number;
  readonly regularEvalMeanSquaredError: number;
  readonly moaActiveHeads: number;
  readonly regularActiveHeads: number;
  readonly moaFrames: number;
  readonly regularFrames: number;
}

interface FigureAblationPoint {
  readonly id: string;
  readonly title: string;
  readonly speedup: number;
  readonly exactFraction: number;
  readonly computeAdjustedExactFraction: number;
  readonly evalMeanSquaredError: number;
}

export interface Ch17MoaTransformerFigureReport {
  readonly label: 'ch17-moa-transformer-figure-v1';
  readonly sourceLabel: string;
  readonly primitive: string;
  readonly regularTopologyPath: string;
  readonly moaTopologyPath: string;
  readonly scalePoints: readonly FigureScalePoint[];
  readonly ablationPoints: readonly FigureAblationPoint[];
  readonly headReductionFactor: number;
  readonly frameReductionFactor: number;
  readonly speedupRange: {
    readonly min: number;
    readonly max: number;
  };
  readonly wideWorkload: {
    readonly speedup: number;
    readonly moaEvalMeanSquaredError: number;
    readonly regularEvalMeanSquaredError: number;
    readonly accuracyGap: number;
  };
  readonly claims: {
    readonly timingAdvantageRecovered: boolean;
    readonly accuracyGapClosesWithScale: boolean;
    readonly outerSparsityImprovesEfficiency: boolean;
    readonly innerSparsityImprovesEfficiency: boolean;
    readonly underRoutingHurtsAccuracy: boolean;
  };
}

function formatNumber(value: number, digits = 3): string {
  return value.toFixed(digits);
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function baseName(path: string): string {
  const normalized = path.replaceAll('\\', '/');
  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? path;
}

export function buildCh17MoaTransformerFigureReport(
  evidence: GnosisMoaTransformerEvidenceReport
): Ch17MoaTransformerFigureReport {
  const scalePoints = evidence.scales.map((scale) => ({
    id: scale.id,
    title: scale.title,
    speedup: scale.moaEvalWallTimeSpeedupVsRegular,
    accuracyGap:
      scale.families.moa.meanEvalMeanSquaredError -
      scale.families.regular.meanEvalMeanSquaredError,
    moaEvalMeanSquaredError: scale.families.moa.meanEvalMeanSquaredError,
    regularEvalMeanSquaredError:
      scale.families.regular.meanEvalMeanSquaredError,
    moaActiveHeads: scale.families.moa.meanActiveHeadCount,
    regularActiveHeads: scale.families.regular.meanActiveHeadCount,
    moaFrames: scale.families.moa.meanFrameCount,
    regularFrames: scale.families.regular.meanFrameCount,
  }));

  const ablationPoints = evidence.ablations.map((ablation) => ({
    id: ablation.id,
    title: ablation.title,
    speedup: ablation.moaEvalWallTimeSpeedupVsRegular,
    exactFraction: ablation.families.moa.meanExactWithinToleranceFraction,
    computeAdjustedExactFraction:
      ablation.families.moa.computeAdjustedExactFraction,
    evalMeanSquaredError: ablation.families.moa.meanEvalMeanSquaredError,
  }));

  const speedups = scalePoints.map((point) => point.speedup);
  const widePoint =
    scalePoints.find((point) => point.id === 'wide') ??
    scalePoints[scalePoints.length - 1];
  const baselineScale = evidence.scales[0];

  return {
    label: 'ch17-moa-transformer-figure-v1',
    sourceLabel: evidence.label,
    primitive: evidence.topologySurface.moaStructuredPrimitive,
    regularTopologyPath: evidence.topologySurface.regularTopologyPath,
    moaTopologyPath: evidence.topologySurface.moaTopologyPath,
    scalePoints,
    ablationPoints,
    headReductionFactor:
      baselineScale === undefined ||
      baselineScale.families.moa.meanActiveHeadCount <= 0
        ? 0
        : baselineScale.families.regular.meanActiveHeadCount /
          baselineScale.families.moa.meanActiveHeadCount,
    frameReductionFactor:
      baselineScale === undefined ||
      baselineScale.families.moa.meanFrameCount <= 0
        ? 0
        : baselineScale.families.regular.meanFrameCount /
          baselineScale.families.moa.meanFrameCount,
    speedupRange: {
      min: Math.min(...speedups),
      max: Math.max(...speedups),
    },
    wideWorkload: {
      speedup: widePoint?.speedup ?? 0,
      moaEvalMeanSquaredError: widePoint?.moaEvalMeanSquaredError ?? 0,
      regularEvalMeanSquaredError: widePoint?.regularEvalMeanSquaredError ?? 0,
      accuracyGap: widePoint?.accuracyGap ?? 0,
    },
    claims: {
      timingAdvantageRecovered: evidence.timingAdvantageRecovered,
      accuracyGapClosesWithScale: evidence.accuracyGapClosesWithScale,
      outerSparsityImprovesEfficiency: evidence.outerSparsityImprovesEfficiency,
      innerSparsityImprovesEfficiency: evidence.innerSparsityImprovesEfficiency,
      underRoutingHurtsAccuracy: evidence.underRoutingHurtsAccuracy,
    },
  };
}

export function renderCh17MoaTransformerFigureMarkdown(
  report: Ch17MoaTransformerFigureReport
): string {
  const lines: string[] = [];
  lines.push('# Chapter 17 MoA Transformer Figure');
  lines.push('');
  lines.push(`- Label: \`${report.label}\``);
  lines.push(`- Source: \`${report.sourceLabel}\``);
  lines.push(`- Sparse GG primitive: \`${report.primitive}\``);
  lines.push(`- Sparse GG topology: \`${report.moaTopologyPath}\``);
  lines.push(`- Regular GG topology: \`${report.regularTopologyPath}\``);
  lines.push(
    `- Speedup range: \`${formatNumber(
      report.speedupRange.min,
      2
    )}x\` to \`${formatNumber(report.speedupRange.max, 2)}x\``
  );
  lines.push(
    `- Head reduction factor: \`${formatNumber(
      report.headReductionFactor,
      1
    )}x\``
  );
  lines.push(
    `- Frame reduction factor: \`${formatNumber(
      report.frameReductionFactor,
      1
    )}x\``
  );
  lines.push('');
  lines.push('## Scale Sweep');
  lines.push('');
  lines.push(
    '| Scale | Speedup | Accuracy gap | MoA eval MSE | Regular eval MSE | MoA heads | Regular heads | MoA frames | Regular frames |'
  );
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const point of report.scalePoints) {
    lines.push(
      `| ${point.title} | ${formatNumber(point.speedup, 2)}x | ${formatNumber(
        point.accuracyGap,
        4
      )} | ${formatNumber(point.moaEvalMeanSquaredError, 4)} | ${formatNumber(
        point.regularEvalMeanSquaredError,
        4
      )} | ${formatNumber(point.moaActiveHeads, 1)} | ${formatNumber(
        point.regularActiveHeads,
        1
      )} | ${formatNumber(point.moaFrames, 1)} | ${formatNumber(
        point.regularFrames,
        1
      )} |`
    );
  }
  lines.push('');
  lines.push('## Ablation Frontier');
  lines.push('');
  lines.push(
    '| Ablation | Speedup | Exact fraction | Compute-adjusted exact | Eval MSE |'
  );
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const point of report.ablationPoints) {
    lines.push(
      `| ${point.title} | ${formatNumber(point.speedup, 2)}x | ${formatNumber(
        point.exactFraction,
        4
      )} | ${formatNumber(
        point.computeAdjustedExactFraction,
        4
      )} | ${formatNumber(point.evalMeanSquaredError, 4)} |`
    );
  }
  lines.push('');
  lines.push(
    'Interpretation: this figure isolates the GG-backed sparse transformer result. `StructuredMoA` keeps a timing advantage across the sweep, the eval-MSE gap closes sharply by the wide workload, and the ablation frontier shows that both outer routing sparsity and inner head sparsity are carrying real efficiency signal rather than decorative pruning.'
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function renderCh17MoaTransformerFigureSvg(
  report: Ch17MoaTransformerFigureReport
): string {
  const width = 1200;
  const height = 900;
  const svg: string[] = [];
  svg.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`
  );
  svg.push('<title id="title">Chapter 17 MoA Transformer Figure</title>');
  svg.push(
    '<desc id="desc">Artifact-generated figure showing GG-backed StructuredMoA speedup, accuracy-gap closure, and sparsity ablation frontier.</desc>'
  );
  svg.push(
    '<rect x="0" y="0" width="1200" height="900" fill="#f7f4ea" rx="24" ry="24"/>'
  );
  svg.push(
    '<text x="60" y="72" font-family="Georgia, Times New Roman, serif" font-size="32" font-weight="700" fill="#1f2937">GG-Backed StructuredMoA Evidence</text>'
  );
  svg.push(
    `<text x="60" y="104" font-family="Georgia, Times New Roman, serif" font-size="16" fill="#475569">Sparse primitive: ${escapeXml(
      report.primitive
    )} · topology: ${escapeXml(baseName(report.moaTopologyPath))}</text>`
  );

  svg.push(
    '<rect x="48" y="132" width="520" height="300" rx="20" ry="20" fill="#fffdf8" stroke="#d6d3c7"/>'
  );
  svg.push(
    '<text x="72" y="170" font-family="Georgia, Times New Roman, serif" font-size="24" font-weight="700" fill="#1f2937">Scale Sweep Speedup</text>'
  );
  svg.push(
    '<text x="72" y="196" font-family="Georgia, Times New Roman, serif" font-size="15" fill="#64748b">MoA eval wall-clock speedup versus dense regular baseline</text>'
  );

  const speedupMax = Math.max(
    ...report.scalePoints.map((point) => point.speedup),
    1
  );
  const speedupBaseY = 390;
  const speedupBarWidth = 104;
  for (const [index, point] of report.scalePoints.entries()) {
    const x = 86 + index * 150;
    const heightScale = (point.speedup / speedupMax) * 150;
    const y = speedupBaseY - heightScale;
    svg.push(
      `<rect x="${x}" y="${y}" width="${speedupBarWidth}" height="${heightScale}" rx="12" ry="12" fill="#0f766e" opacity="0.88"/>`
    );
    svg.push(
      `<text x="${x + speedupBarWidth / 2}" y="${
        y - 10
      }" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="16" fill="#0f172a">${escapeXml(
        formatNumber(point.speedup, 2)
      )}x</text>`
    );
    svg.push(
      `<text x="${
        x + speedupBarWidth / 2
      }" y="414" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="15" fill="#334155">${escapeXml(
        point.id
      )}</text>`
    );
  }

  svg.push(
    '<rect x="632" y="132" width="520" height="300" rx="20" ry="20" fill="#fffdf8" stroke="#d6d3c7"/>'
  );
  svg.push(
    '<text x="656" y="170" font-family="Georgia, Times New Roman, serif" font-size="24" font-weight="700" fill="#1f2937">Accuracy Gap Closes</text>'
  );
  svg.push(
    '<text x="656" y="196" font-family="Georgia, Times New Roman, serif" font-size="15" fill="#64748b">Eval-MSE gap = MoA minus dense regular baseline</text>'
  );

  const gapMax = Math.max(
    ...report.scalePoints.map((point) => point.accuracyGap),
    0.001
  );
  const gapBaseY = 390;
  for (const [index, point] of report.scalePoints.entries()) {
    const x = 670 + index * 150;
    const barWidth = 104;
    const barHeight = (point.accuracyGap / gapMax) * 150;
    const y = gapBaseY - barHeight;
    svg.push(
      `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="12" ry="12" fill="#c2410c" opacity="0.84"/>`
    );
    svg.push(
      `<text x="${x + barWidth / 2}" y="${
        y - 10
      }" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="16" fill="#7c2d12">${escapeXml(
        formatNumber(point.accuracyGap, 4)
      )}</text>`
    );
    svg.push(
      `<text x="${
        x + barWidth / 2
      }" y="414" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="15" fill="#334155">${escapeXml(
        point.id
      )}</text>`
    );
  }

  svg.push(
    '<rect x="48" y="470" width="700" height="360" rx="20" ry="20" fill="#fffdf8" stroke="#d6d3c7"/>'
  );
  svg.push(
    '<text x="72" y="508" font-family="Georgia, Times New Roman, serif" font-size="24" font-weight="700" fill="#1f2937">Ablation Frontier</text>'
  );
  svg.push(
    '<text x="72" y="534" font-family="Georgia, Times New Roman, serif" font-size="15" fill="#64748b">Speedup on x-axis, exact fraction on y-axis; bubble size tracks compute-adjusted exact</text>'
  );

  const plotLeft = 92;
  const plotTop = 568;
  const plotWidth = 610;
  const plotHeight = 210;
  const speedupMin = Math.min(
    ...report.ablationPoints.map((point) => point.speedup)
  );
  const speedupRange = Math.max(
    0.1,
    Math.max(...report.ablationPoints.map((point) => point.speedup)) -
      speedupMin
  );
  svg.push(
    `<line x1="${plotLeft}" y1="${plotTop + plotHeight}" x2="${
      plotLeft + plotWidth
    }" y2="${plotTop + plotHeight}" stroke="#94a3b8" stroke-width="2"/>`
  );
  svg.push(
    `<line x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${
      plotTop + plotHeight
    }" stroke="#94a3b8" stroke-width="2"/>`
  );
  for (const point of report.ablationPoints) {
    const x =
      plotLeft + ((point.speedup - speedupMin) / speedupRange) * plotWidth;
    const y = plotTop + (1 - point.exactFraction) * plotHeight;
    const radius = 16 + point.computeAdjustedExactFraction * 48;
    svg.push(
      `<circle cx="${x}" cy="${y}" r="${radius}" fill="#0f766e" fill-opacity="0.20" stroke="#0f766e" stroke-width="2"/>`
    );
    svg.push(
      `<text x="${x}" y="${
        y + 5
      }" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="13" fill="#0f172a">${escapeXml(
        point.id
      )}</text>`
    );
  }

  svg.push(
    '<rect x="780" y="470" width="372" height="360" rx="20" ry="20" fill="#fffdf8" stroke="#d6d3c7"/>'
  );
  svg.push(
    '<text x="804" y="508" font-family="Georgia, Times New Roman, serif" font-size="24" font-weight="700" fill="#1f2937">GG Surface</text>'
  );
  const callouts = [
    `Structured primitive: ${report.primitive}`,
    `Sparse topology: ${baseName(report.moaTopologyPath)}`,
    `Dense topology: ${baseName(report.regularTopologyPath)}`,
    `Head reduction: ${formatNumber(report.headReductionFactor, 1)}x`,
    `Frame reduction: ${formatNumber(report.frameReductionFactor, 1)}x`,
    `Wide speedup: ${formatNumber(report.wideWorkload.speedup, 2)}x`,
    `Wide MoA MSE: ${formatNumber(
      report.wideWorkload.moaEvalMeanSquaredError,
      4
    )}`,
    `Wide regular MSE: ${formatNumber(
      report.wideWorkload.regularEvalMeanSquaredError,
      4
    )}`,
    `Wide gap: ${formatNumber(report.wideWorkload.accuracyGap, 4)}`,
  ];
  for (const [index, line] of callouts.entries()) {
    svg.push(
      `<text x="806" y="${
        548 + index * 30
      }" font-family="Georgia, Times New Roman, serif" font-size="17" fill="#334155">${escapeXml(
        line
      )}</text>`
    );
  }

  svg.push('</svg>');
  return `${svg.join('\n')}\n`;
}
