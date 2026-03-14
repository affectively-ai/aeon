type StrategyName = 'linear' | 'winner-take-all' | 'early-stop';

interface Interval {
  readonly low: number;
  readonly high: number;
}

interface RegimeSweepPointInput {
  readonly regimeValue: number;
  readonly linearAdvantageEvalMeanSquaredError: number;
  readonly linearAdvantageExactWithinToleranceFraction: number;
}

export interface RegimeSweepFigureInput {
  readonly label: string;
  readonly affine: {
    readonly firstSeparatedRegimeValue: number | null;
    readonly points: readonly RegimeSweepPointInput[];
  };
  readonly routed: {
    readonly firstSeparatedRegimeValue: number | null;
    readonly points: readonly RegimeSweepPointInput[];
  };
}

export interface NearControlSweepFigureInput {
  readonly label: string;
  readonly affine: {
    readonly lastParityRegimeValue: number | null;
    readonly firstSeparatedRegimeValue: number | null;
    readonly points: readonly RegimeSweepPointInput[];
  };
  readonly routed: {
    readonly lastParityRegimeValue: number | null;
    readonly firstSeparatedRegimeValue: number | null;
    readonly points: readonly RegimeSweepPointInput[];
  };
}

export interface AdversarialControlsFigureInput {
  readonly label: string;
  readonly tasks: Record<
    string,
    {
      readonly title: string;
      readonly favoredStrategy: StrategyName;
      readonly successCriterion: string;
      readonly rankingByFinalEvalMeanSquaredError: readonly StrategyName[];
      readonly rankingByLearningCurveArea: readonly StrategyName[];
      readonly strategies: Record<
        StrategyName,
        {
          readonly meanFinalEvalMeanSquaredError: number;
          readonly finalEvalMeanSquaredErrorCi95: Interval;
          readonly meanLearningCurveArea: number;
          readonly learningCurveAreaCi95: Interval;
        }
      >;
    }
  >;
}

export interface Ch17BoundaryExpansionFigureReport {
  readonly label: 'ch17-boundary-expansion-figure-v2';
  readonly sources: {
    readonly nearControlLabel: string;
    readonly regimeSweepLabel: string;
    readonly adversarialLabel: string;
  };
  readonly nearControl: {
    readonly affine: {
      readonly lastParityRegimeValue: number | null;
      readonly firstSeparatedRegimeValue: number | null;
      readonly points: readonly RegimeSweepPointInput[];
    };
    readonly routed: {
      readonly lastParityRegimeValue: number | null;
      readonly firstSeparatedRegimeValue: number | null;
      readonly points: readonly RegimeSweepPointInput[];
    };
  };
  readonly affineRegime: {
    readonly firstSeparatedRegimeValue: number | null;
    readonly points: readonly RegimeSweepPointInput[];
  };
  readonly routedRegime: {
    readonly firstSeparatedRegimeValue: number | null;
    readonly points: readonly RegimeSweepPointInput[];
  };
  readonly adversarial: {
    readonly taskIds: readonly string[];
    readonly favoredStrategies: Record<string, StrategyName>;
    readonly finalEvalMeanSquaredError: Record<string, Record<StrategyName, number>>;
    readonly learningCurveArea: Record<string, Record<StrategyName, number>>;
    readonly rankingByFinalEvalMeanSquaredError: Record<string, readonly StrategyName[]>;
    readonly rankingByLearningCurveArea: Record<string, readonly StrategyName[]>;
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatNumber(value: number): string {
  return value.toFixed(3);
}

function strategyColor(strategy: StrategyName): string {
  if (strategy === 'linear') {
    return '#0f766e';
  }
  if (strategy === 'winner-take-all') {
    return '#c2410c';
  }
  return '#991b1b';
}

export function buildCh17BoundaryExpansionFigureReport(
  nearControl: NearControlSweepFigureInput,
  regimeSweep: RegimeSweepFigureInput,
  adversarial: AdversarialControlsFigureInput,
): Ch17BoundaryExpansionFigureReport {
  const taskIds = Object.keys(adversarial.tasks);
  return {
    label: 'ch17-boundary-expansion-figure-v2',
    sources: {
      nearControlLabel: nearControl.label,
      regimeSweepLabel: regimeSweep.label,
      adversarialLabel: adversarial.label,
    },
    nearControl: {
      affine: {
        lastParityRegimeValue: nearControl.affine.lastParityRegimeValue,
        firstSeparatedRegimeValue: nearControl.affine.firstSeparatedRegimeValue,
        points: nearControl.affine.points,
      },
      routed: {
        lastParityRegimeValue: nearControl.routed.lastParityRegimeValue,
        firstSeparatedRegimeValue: nearControl.routed.firstSeparatedRegimeValue,
        points: nearControl.routed.points,
      },
    },
    affineRegime: {
      firstSeparatedRegimeValue: regimeSweep.affine.firstSeparatedRegimeValue,
      points: regimeSweep.affine.points,
    },
    routedRegime: {
      firstSeparatedRegimeValue: regimeSweep.routed.firstSeparatedRegimeValue,
      points: regimeSweep.routed.points,
    },
    adversarial: {
      taskIds,
      favoredStrategies: Object.fromEntries(
        taskIds.map((taskId) => [taskId, adversarial.tasks[taskId]?.favoredStrategy ?? 'linear']),
      ),
      finalEvalMeanSquaredError: Object.fromEntries(
        taskIds.map((taskId) => [
          taskId,
          {
            linear: adversarial.tasks[taskId]?.strategies.linear.meanFinalEvalMeanSquaredError ?? 0,
            'winner-take-all':
              adversarial.tasks[taskId]?.strategies['winner-take-all']
                .meanFinalEvalMeanSquaredError ?? 0,
            'early-stop':
              adversarial.tasks[taskId]?.strategies['early-stop'].meanFinalEvalMeanSquaredError ??
              0,
          },
        ]),
      ),
      learningCurveArea: Object.fromEntries(
        taskIds.map((taskId) => [
          taskId,
          {
            linear: adversarial.tasks[taskId]?.strategies.linear.meanLearningCurveArea ?? 0,
            'winner-take-all':
              adversarial.tasks[taskId]?.strategies['winner-take-all'].meanLearningCurveArea ?? 0,
            'early-stop':
              adversarial.tasks[taskId]?.strategies['early-stop'].meanLearningCurveArea ?? 0,
          },
        ]),
      ),
      rankingByFinalEvalMeanSquaredError: Object.fromEntries(
        taskIds.map((taskId) => [
          taskId,
          adversarial.tasks[taskId]?.rankingByFinalEvalMeanSquaredError ?? [],
        ]),
      ),
      rankingByLearningCurveArea: Object.fromEntries(
        taskIds.map((taskId) => [
          taskId,
          adversarial.tasks[taskId]?.rankingByLearningCurveArea ?? [],
        ]),
      ),
    },
  };
}

export function renderCh17BoundaryExpansionFigureMarkdown(
  report: Ch17BoundaryExpansionFigureReport,
): string {
  const lines: string[] = [];
  lines.push('# Chapter 17 Boundary Expansion Figure');
  lines.push('');
  lines.push(`- Label: \`${report.label}\``);
  lines.push(`- Near-control source: \`${report.sources.nearControlLabel}\``);
  lines.push(`- Regime sweep source: \`${report.sources.regimeSweepLabel}\``);
  lines.push(`- Adversarial source: \`${report.sources.adversarialLabel}\``);
  lines.push('');
  lines.push('## Near-Control Zoom');
  lines.push('');
  lines.push(
    `- Affine last parity / first separated: \`${report.nearControl.affine.lastParityRegimeValue?.toFixed(2) ?? 'none'}\` / \`${report.nearControl.affine.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}\``,
  );
  lines.push(
    `- Routed last parity / first separated: \`${report.nearControl.routed.lastParityRegimeValue?.toFixed(2) ?? 'none'}\` / \`${report.nearControl.routed.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}\``,
  );
  lines.push('');
  lines.push('| Family | Regime | Linear advantage (eval MSE) |');
  lines.push('| --- | ---: | ---: |');
  for (const point of report.nearControl.affine.points) {
    lines.push(
      `| \`affine\` | ${point.regimeValue.toFixed(2)} | ${point.linearAdvantageEvalMeanSquaredError.toFixed(3)} |`,
    );
  }
  for (const point of report.nearControl.routed.points) {
    lines.push(
      `| \`routed\` | ${point.regimeValue.toFixed(2)} | ${point.linearAdvantageEvalMeanSquaredError.toFixed(3)} |`,
    );
  }
  lines.push('');
  lines.push('## Regime Sweep');
  lines.push('');
  lines.push(
    `- Affine first separated regime value: \`${report.affineRegime.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}\``,
  );
  lines.push(
    `- Routed first separated regime value: \`${report.routedRegime.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}\``,
  );
  lines.push('');
  lines.push('| Family | Regime | Linear advantage (eval MSE) | Linear exact advantage |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const point of report.affineRegime.points) {
    lines.push(
      `| \`affine\` | ${point.regimeValue.toFixed(2)} | ${point.linearAdvantageEvalMeanSquaredError.toFixed(3)} | ${point.linearAdvantageExactWithinToleranceFraction.toFixed(3)} |`,
    );
  }
  for (const point of report.routedRegime.points) {
    lines.push(
      `| \`routed\` | ${point.regimeValue.toFixed(2)} | ${point.linearAdvantageEvalMeanSquaredError.toFixed(3)} | ${point.linearAdvantageExactWithinToleranceFraction.toFixed(3)} |`,
    );
  }
  lines.push('');
  lines.push('## Adversarial Controls');
  lines.push('');
  lines.push('| Task | Favored | Final winner | AUC winner |');
  lines.push('| --- | --- | --- | --- |');
  for (const taskId of report.adversarial.taskIds) {
    lines.push(
      `| \`${taskId}\` | \`${report.adversarial.favoredStrategies[taskId]}\` | \`${report.adversarial.rankingByFinalEvalMeanSquaredError[taskId]?.[0] ?? 'n/a'}\` | \`${report.adversarial.rankingByLearningCurveArea[taskId]?.[0] ?? 'n/a'}\` |`,
    );
  }
  lines.push('');
  lines.push(
    'Interpretation: the near-control zoom makes the parity-to-separation onset explicit at low recombination demand, the coarse regime sweeps show how that advantage continues to grow, and the adversarial controls show the other side of the boundary by exhibiting tasks where sparse nonlinear selection or early stopping is the better inductive bias.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function renderNearControlPanel(
  svg: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  nearControl: Ch17BoundaryExpansionFigureReport['nearControl'],
): void {
  const chartLeft = x + 64;
  const chartRight = x + width - 32;
  const chartTop = y + 86;
  const chartBottom = y + height - 52;
  const affineColor = '#0f766e';
  const routedColor = '#b45309';
  const xMax = Math.max(
    1,
    ...nearControl.affine.points.map((point) => point.regimeValue),
    ...nearControl.routed.points.map((point) => point.regimeValue),
  );
  const yMax = Math.max(
    0.08,
    ...nearControl.affine.points.map((point) => point.linearAdvantageEvalMeanSquaredError),
    ...nearControl.routed.points.map((point) => point.linearAdvantageEvalMeanSquaredError),
  );
  const families = [
    {
      label: 'affine',
      color: affineColor,
      points: nearControl.affine.points,
      lastParityRegimeValue: nearControl.affine.lastParityRegimeValue,
      firstSeparatedRegimeValue: nearControl.affine.firstSeparatedRegimeValue,
    },
    {
      label: 'routed',
      color: routedColor,
      points: nearControl.routed.points,
      lastParityRegimeValue: nearControl.routed.lastParityRegimeValue,
      firstSeparatedRegimeValue: nearControl.routed.firstSeparatedRegimeValue,
    },
  ] as const;

  const pointX = (regimeValue: number): number =>
    chartLeft + (regimeValue / xMax) * (chartRight - chartLeft);
  const pointY = (advantage: number): number =>
    chartBottom - (advantage / yMax) * (chartBottom - chartTop);

  svg.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="#fffaf0" stroke="#d6d3d1"/>`,
  );
  svg.push(
    `<text x="${x + 24}" y="${y + 34}" font-family="Georgia, serif" font-size="24" fill="#111827">Near-Control Zoom</text>`,
  );
  svg.push(
    `<text x="${x + 24}" y="${y + 58}" font-family="Georgia, serif" font-size="13" fill="#57534e">Parity at the control end, then visible divergence as recombination demand rises</text>`,
  );
  svg.push(
    `<text x="${x + 24}" y="${y + height - 18}" font-family="ui-monospace, SFMono-Regular, monospace" font-size="12" fill="#6b7280">linear advantage (eval MSE) over the best nonlinear strategy</text>`,
  );
  svg.push(
    `<line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#9ca3af" stroke-width="1"/>`,
  );
  svg.push(
    `<line x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${chartBottom}" stroke="#9ca3af" stroke-width="1"/>`,
  );

  for (const family of families) {
    const polyline = family.points
      .map((point) => `${pointX(point.regimeValue)},${pointY(point.linearAdvantageEvalMeanSquaredError)}`)
      .join(' ');
    svg.push(
      `<polyline fill="none" stroke="${family.color}" stroke-width="3" points="${polyline}"/>`,
    );

    for (const point of family.points) {
      const cx = pointX(point.regimeValue);
      const cy = pointY(point.linearAdvantageEvalMeanSquaredError);
      svg.push(`<circle cx="${cx}" cy="${cy}" r="4" fill="${family.color}"/>`);
    }

    const parityPoint = family.points.find(
      (point) => point.regimeValue === family.lastParityRegimeValue,
    );
    if (parityPoint) {
      const cx = pointX(parityPoint.regimeValue);
      const cy = pointY(parityPoint.linearAdvantageEvalMeanSquaredError);
      svg.push(
        `<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${family.color}" stroke-width="2"/>`,
      );
    }

    const separatedPoint = family.points.find(
      (point) => point.regimeValue === family.firstSeparatedRegimeValue,
    );
    if (separatedPoint) {
      const cx = pointX(separatedPoint.regimeValue);
      const cy = pointY(separatedPoint.linearAdvantageEvalMeanSquaredError);
      svg.push(
        `<line x1="${cx}" y1="${chartTop}" x2="${cx}" y2="${chartBottom}" stroke="${family.color}" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.55"/>`,
      );
      svg.push(
        `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" fill="#fffaf0" stroke="${family.color}" stroke-width="2"/>`,
      );
    }
  }

  for (const tick of [0, 0.25, 0.5, 0.75]) {
    const tickX = pointX(tick);
    svg.push(
      `<text x="${tickX}" y="${chartBottom + 20}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, monospace" font-size="11" fill="#6b7280">${tick.toFixed(2)}</text>`,
    );
  }
  for (const tick of [0, yMax / 2, yMax]) {
    const tickY = pointY(tick);
    svg.push(
      `<text x="${chartLeft - 12}" y="${tickY + 4}" text-anchor="end" font-family="ui-monospace, SFMono-Regular, monospace" font-size="11" fill="#6b7280">${tick.toFixed(3)}</text>`,
    );
  }

  svg.push(
    `<text x="${chartRight - 180}" y="${y + 34}" font-family="ui-monospace, SFMono-Regular, monospace" font-size="12" fill="${affineColor}">affine parity ${nearControl.affine.lastParityRegimeValue?.toFixed(2) ?? 'none'} → split ${nearControl.affine.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}</text>`,
  );
  svg.push(
    `<text x="${chartRight - 180}" y="${y + 54}" font-family="ui-monospace, SFMono-Regular, monospace" font-size="12" fill="${routedColor}">routed parity ${nearControl.routed.lastParityRegimeValue?.toFixed(2) ?? 'none'} → split ${nearControl.routed.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}</text>`,
  );
}

function renderLinePanel(
  svg: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  subtitle: string,
  points: readonly RegimeSweepPointInput[],
  firstSeparated: number | null,
): void {
  const chartLeft = x + 48;
  const chartRight = x + width - 28;
  const chartTop = y + 90;
  const chartBottom = y + height - 44;
  const xMax = Math.max(...points.map((point) => point.regimeValue), 1);
  const yMax = Math.max(...points.map((point) => point.linearAdvantageEvalMeanSquaredError), 0.1);

  svg.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="#fffaf0" stroke="#d6d3d1"/>`,
  );
  svg.push(
    `<text x="${x + 24}" y="${y + 34}" font-family="Georgia, serif" font-size="22" fill="#111827">${escapeXml(
      title,
    )}</text>`,
  );
  svg.push(
    `<text x="${x + 24}" y="${y + 58}" font-family="Georgia, serif" font-size="13" fill="#57534e">${escapeXml(
      subtitle,
    )}</text>`,
  );
  svg.push(
    `<text x="${x + 24}" y="${y + 78}" font-family="ui-monospace, SFMono-Regular, monospace" font-size="12" fill="#374151">Linear advantage in eval MSE</text>`,
  );
  svg.push(
    `<line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#9ca3af" stroke-width="1"/>`,
  );
  svg.push(
    `<line x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${chartBottom}" stroke="#9ca3af" stroke-width="1"/>`,
  );

  const polylinePoints = points
    .map((point) => {
      const pointX = chartLeft + (point.regimeValue / xMax) * (chartRight - chartLeft);
      const pointY =
        chartBottom -
        (point.linearAdvantageEvalMeanSquaredError / yMax) * (chartBottom - chartTop);
      return `${pointX},${pointY}`;
    })
    .join(' ');
  svg.push(
    `<polyline fill="none" stroke="#0f766e" stroke-width="3" points="${polylinePoints}"/>`,
  );

  for (const point of points) {
    const pointX = chartLeft + (point.regimeValue / xMax) * (chartRight - chartLeft);
    const pointY =
      chartBottom -
      (point.linearAdvantageEvalMeanSquaredError / yMax) * (chartBottom - chartTop);
    svg.push(`<circle cx="${pointX}" cy="${pointY}" r="4.5" fill="#0f766e"/>`);
    svg.push(
      `<text x="${pointX}" y="${chartBottom + 20}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, monospace" font-size="11" fill="#6b7280">${point.regimeValue.toFixed(
        2,
      )}</text>`,
    );
    svg.push(
      `<text x="${pointX}" y="${pointY - 10}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, monospace" font-size="10" fill="#374151">${formatNumber(
        point.linearAdvantageEvalMeanSquaredError,
      )}</text>`,
    );
  }

  svg.push(
    `<text x="${x + 24}" y="${y + height - 16}" font-family="ui-monospace, SFMono-Regular, monospace" font-size="12" fill="#6b7280">first separated: ${firstSeparated === null ? 'none' : firstSeparated.toFixed(2)}</text>`,
  );
}

function renderAdversarialPanel(
  svg: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  subtitle: string,
  taskIds: readonly string[],
  favoredStrategies: Record<string, StrategyName>,
  values: Record<string, Record<StrategyName, number>>,
  rankings: Record<string, readonly StrategyName[]>,
): void {
  const strategies: StrategyName[] = ['linear', 'winner-take-all', 'early-stop'];
  const chartLeft = x + 40;
  const chartTop = y + 88;
  const groupWidth = 156;
  const barWidth = 34;
  const chartBottom = y + height - 48;
  const chartHeight = height - 150;
  const maxValue = Math.max(
    0.1,
    ...taskIds.flatMap((taskId) =>
      strategies.map((strategy) => values[taskId]?.[strategy] ?? 0),
    ),
  );

  svg.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="#fffaf0" stroke="#d6d3d1"/>`,
  );
  svg.push(
    `<text x="${x + 24}" y="${y + 34}" font-family="Georgia, serif" font-size="22" fill="#111827">${escapeXml(
      title,
    )}</text>`,
  );
  svg.push(
    `<text x="${x + 24}" y="${y + 58}" font-family="Georgia, serif" font-size="13" fill="#57534e">${escapeXml(
      subtitle,
    )}</text>`,
  );

  for (const [taskIndex, taskId] of taskIds.entries()) {
    const groupX = chartLeft + taskIndex * groupWidth;
    for (const [strategyIndex, strategy] of strategies.entries()) {
      const value = values[taskId]?.[strategy] ?? 0;
      const barHeight = (value / maxValue) * chartHeight;
      const barX = groupX + strategyIndex * (barWidth + 8);
      const barY = chartBottom - barHeight;
      svg.push(
        `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="10" fill="${strategyColor(
          strategy,
        )}"/>`,
      );
      svg.push(
        `<text x="${barX + barWidth / 2}" y="${barY - 8}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, monospace" font-size="10" fill="#374151">${formatNumber(
          value,
        )}</text>`,
      );
    }
    svg.push(
      `<text x="${groupX + 54}" y="${chartBottom + 20}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, monospace" font-size="10" fill="#111827">${escapeXml(
        taskId,
      )}</text>`,
    );
    svg.push(
      `<text x="${groupX + 54}" y="${chartBottom + 38}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, monospace" font-size="10" fill="#6b7280">favored ${escapeXml(
        favoredStrategies[taskId] ?? 'n/a',
      )} | winner ${escapeXml(rankings[taskId]?.[0] ?? 'n/a')}</text>`,
    );
  }
}

export function renderCh17BoundaryExpansionFigureSvg(
  report: Ch17BoundaryExpansionFigureReport,
): string {
  const svg: string[] = [];
  svg.push('<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1240" viewBox="0 0 1240 1240" role="img" aria-labelledby="title desc">');
  svg.push('<title id="title">Chapter 17 boundary expansion figure</title>');
  svg.push('<desc id="desc">A near-control zoom chart, two regime-sweep line charts, and two adversarial-control grouped bar charts generated from the Chapter 17 artifacts.</desc>');
  svg.push('<defs>');
  svg.push('<linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">');
  svg.push('<stop offset="0%" stop-color="#f7f3e8"/>');
  svg.push('<stop offset="100%" stop-color="#fffdf8"/>');
  svg.push('</linearGradient>');
  svg.push('</defs>');
  svg.push('<rect width="1240" height="1240" fill="url(#bg2)" rx="24"/>');
  svg.push('<text x="48" y="56" font-family="Georgia, serif" font-size="28" fill="#111827">Chapter 17 Boundary Expansion</text>');
  svg.push('<text x="48" y="84" font-family="Georgia, serif" font-size="14" fill="#4b5563">Near-control zoom, regime sweeps, and adversarial controls generated from the Gnosis evidence artifacts</text>');

  renderNearControlPanel(svg, 40, 120, 1160, 240, report.nearControl);

  renderLinePanel(
    svg,
    40,
    400,
    560,
    300,
    'Affine Regime Sweep',
    'From one-path parity to full cancellation',
    report.affineRegime.points,
    report.affineRegime.firstSeparatedRegimeValue,
  );

  renderLinePanel(
    svg,
    640,
    400,
    560,
    300,
    'Routed Regime Sweep',
    'From one-expert parity to dual-activation demand',
    report.routedRegime.points,
    report.routedRegime.firstSeparatedRegimeValue,
  );

  renderAdversarialPanel(
    svg,
    40,
    740,
    560,
    420,
    'Adversarial Final Error',
    'Where sparse selection is the right final inductive bias',
    report.adversarial.taskIds,
    report.adversarial.favoredStrategies,
    report.adversarial.finalEvalMeanSquaredError,
    report.adversarial.rankingByFinalEvalMeanSquaredError,
  );

  renderAdversarialPanel(
    svg,
    640,
    740,
    560,
    420,
    'Adversarial Learning Area',
    'Where sparse selection or early stop wins on sample efficiency',
    report.adversarial.taskIds,
    report.adversarial.favoredStrategies,
    report.adversarial.learningCurveArea,
    report.adversarial.rankingByLearningCurveArea,
  );

  svg.push('</svg>');
  return `${svg.join('')}\n`;
}
