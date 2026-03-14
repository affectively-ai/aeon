import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCh17BoundaryExpansionFigureReport,
  renderCh17BoundaryExpansionFigureMarkdown,
  renderCh17BoundaryExpansionFigureSvg,
  type AdversarialControlsFigureInput,
  type NearControlSweepFigureInput,
  type RegimeSweepFigureInput,
} from '../src/ch17-boundary-expansion-figure';

interface CliOptions {
  readonly assertSurface: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
  readonly svgPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(moduleDir, '../artifacts/ch17-boundary-expansion-figure.json');
  const defaultMarkdownPath = resolve(moduleDir, '../artifacts/ch17-boundary-expansion-figure.md');
  const defaultSvgPath = resolve(moduleDir, '../artifacts/ch17-boundary-expansion-figure.svg');

  let assertSurface = false;
  let jsonPath = defaultJsonPath;
  let markdownPath = defaultMarkdownPath;
  let svgPath = defaultSvgPath;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--assert') {
      assertSurface = true;
      continue;
    }
    if (arg === '--json') {
      const next = argv[++index];
      if (!next) {
        throw new Error('Missing value for --json');
      }
      jsonPath = resolve(next);
      continue;
    }
    if (arg === '--markdown') {
      const next = argv[++index];
      if (!next) {
        throw new Error('Missing value for --markdown');
      }
      markdownPath = resolve(next);
      continue;
    }
    if (arg === '--svg') {
      const next = argv[++index];
      if (!next) {
        throw new Error('Missing value for --svg');
      }
      svgPath = resolve(next);
      continue;
    }
    throw new Error(`Unknown flag: ${arg}`);
  }

  return {
    assertSurface,
    jsonPath,
    markdownPath,
    svgPath,
  };
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function main(): void {
  const options = parseCli(process.argv.slice(2));
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const artifactsDir = resolve(moduleDir, '../artifacts');
  const nearControl = loadJson<NearControlSweepFigureInput>(
    resolve(artifactsDir, 'gnosis-near-control-sweep.json'),
  );
  const regimeSweep = loadJson<RegimeSweepFigureInput>(
    resolve(artifactsDir, 'gnosis-fold-boundary-regime-sweep.json'),
  );
  const adversarial = loadJson<AdversarialControlsFigureInput>(
    resolve(artifactsDir, 'gnosis-adversarial-controls-benchmark.json'),
  );
  const report = buildCh17BoundaryExpansionFigureReport(
    nearControl,
    regimeSweep,
    adversarial,
  );

  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });
  mkdirSync(dirname(options.svgPath), { recursive: true });

  writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    options.markdownPath,
    renderCh17BoundaryExpansionFigureMarkdown(report),
    'utf8',
  );
  writeFileSync(options.svgPath, renderCh17BoundaryExpansionFigureSvg(report), 'utf8');

  process.stdout.write(`ch17-boundary-expansion-figure: ${report.label}\n`);
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);
  process.stdout.write(`svg: ${options.svgPath}\n`);
  process.stdout.write(
    `- near-control affine parity=${report.nearControl.affine.lastParityRegimeValue?.toFixed(2) ?? 'none'} -> split=${report.nearControl.affine.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}\n`,
  );
  process.stdout.write(
    `- affine first-separated=${report.affineRegime.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}\n`,
  );
  process.stdout.write(
    `- adversarial tasks=${report.adversarial.taskIds.length}\n`,
  );

  if (
    options.assertSurface &&
    !(
      report.nearControl.affine.lastParityRegimeValue !== null &&
      report.nearControl.routed.lastParityRegimeValue !== null &&
      report.affineRegime.firstSeparatedRegimeValue !== null &&
      report.routedRegime.firstSeparatedRegimeValue !== null &&
      report.adversarial.rankingByFinalEvalMeanSquaredError['winner-affine-maxabs']?.[0] ===
        'winner-take-all' &&
      report.adversarial.rankingByLearningCurveArea['early-stop-left-priority-short-budget']?.[0] ===
        'early-stop'
    )
  ) {
    process.exitCode = 1;
  }
}

main();
