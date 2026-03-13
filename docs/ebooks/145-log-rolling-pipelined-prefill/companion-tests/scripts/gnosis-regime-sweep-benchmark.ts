import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderGnosisFoldBoundaryRegimeSweepMarkdown,
  runGnosisFoldBoundaryRegimeSweep,
} from '../src/gnosis-regime-sweep-benchmark';

interface CliOptions {
  readonly assertBoundary: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(moduleDir, '../artifacts/gnosis-fold-boundary-regime-sweep.json');
  const defaultMarkdownPath = resolve(moduleDir, '../artifacts/gnosis-fold-boundary-regime-sweep.md');

  let assertBoundary = false;
  let jsonPath = defaultJsonPath;
  let markdownPath = defaultMarkdownPath;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--assert') {
      assertBoundary = true;
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
    throw new Error(`Unknown flag: ${arg}`);
  }

  return {
    assertBoundary,
    jsonPath,
    markdownPath,
  };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const report = await runGnosisFoldBoundaryRegimeSweep();

  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });

  writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    options.markdownPath,
    renderGnosisFoldBoundaryRegimeSweepMarkdown(report),
    'utf8',
  );

  process.stdout.write(
    `gnosis-fold-boundary-regime-sweep: ${report.predictedBoundaryRecovered ? 'MATCH' : 'MISMATCH'}\n`,
  );
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);
  process.stdout.write(
    `- affine: first-separated=${report.affine.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}, final-gap=${report.affine.points.at(-1)?.linearAdvantageEvalMeanSquaredError.toFixed(3) ?? '0.000'}\n`,
  );
  process.stdout.write(
    `- routed: first-separated=${report.routed.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}, final-gap=${report.routed.points.at(-1)?.linearAdvantageEvalMeanSquaredError.toFixed(3) ?? '0.000'}\n`,
  );

  if (options.assertBoundary && !report.predictedBoundaryRecovered) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
