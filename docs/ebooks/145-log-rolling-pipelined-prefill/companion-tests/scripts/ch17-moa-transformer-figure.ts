import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCh17MoaTransformerFigureReport,
  renderCh17MoaTransformerFigureMarkdown,
  renderCh17MoaTransformerFigureSvg,
} from '../src/ch17-moa-transformer-figure';
import type { GnosisMoaTransformerEvidenceReport } from '../src/gnosis-moa-transformer-evidence-benchmark';

interface CliOptions {
  readonly assertSurface: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
  readonly svgPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(
    moduleDir,
    '../artifacts/ch17-moa-transformer-figure.json'
  );
  const defaultMarkdownPath = resolve(
    moduleDir,
    '../artifacts/ch17-moa-transformer-figure.md'
  );
  const defaultSvgPath = resolve(
    moduleDir,
    '../artifacts/ch17-moa-transformer-figure.svg'
  );

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

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const artifactsDir = resolve(moduleDir, '../artifacts');
  const evidence = loadJson<GnosisMoaTransformerEvidenceReport>(
    resolve(artifactsDir, 'gnosis-moa-transformer-evidence-benchmark.json')
  );
  const report = buildCh17MoaTransformerFigureReport(evidence);

  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });
  mkdirSync(dirname(options.svgPath), { recursive: true });

  writeFileSync(
    options.jsonPath,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    options.markdownPath,
    renderCh17MoaTransformerFigureMarkdown(report),
    'utf8'
  );
  writeFileSync(
    options.svgPath,
    renderCh17MoaTransformerFigureSvg(report),
    'utf8'
  );

  process.stdout.write(`ch17-moa-transformer-figure: ${report.label}\n`);
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);
  process.stdout.write(`svg: ${options.svgPath}\n`);
  process.stdout.write(
    `- primitive: ${
      report.primitive
    }, speedup-range=${report.speedupRange.min.toFixed(
      2
    )}x-${report.speedupRange.max.toFixed(
      2
    )}x, wide-gap=${report.wideWorkload.accuracyGap.toFixed(4)}\n`
  );

  if (
    options.assertSurface &&
    !(
      report.primitive === 'StructuredMoA' &&
      report.claims.timingAdvantageRecovered &&
      report.claims.accuracyGapClosesWithScale &&
      report.speedupRange.min > 1 &&
      report.wideWorkload.accuracyGap <
        (report.scalePoints[0]?.accuracyGap ?? Infinity)
    )
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
