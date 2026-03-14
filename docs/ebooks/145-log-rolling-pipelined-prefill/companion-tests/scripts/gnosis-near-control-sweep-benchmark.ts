import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderGnosisNearControlSweepMarkdown,
  runGnosisNearControlSweep,
} from '../src/gnosis-near-control-sweep-benchmark';

interface CliOptions {
  readonly assertBoundary: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(moduleDir, '../artifacts/gnosis-near-control-sweep.json');
  const defaultMarkdownPath = resolve(moduleDir, '../artifacts/gnosis-near-control-sweep.md');

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
  const report = await runGnosisNearControlSweep();

  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });

  writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    options.markdownPath,
    renderGnosisNearControlSweepMarkdown(report),
    'utf8',
  );

  process.stdout.write(
    `gnosis-near-control-sweep: ${report.predictedNearControlRecovered ? 'MATCH' : 'MISMATCH'}\n`,
  );
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);
  process.stdout.write(
    `- affine: last-parity=${report.affine.lastParityRegimeValue?.toFixed(2) ?? 'none'}, first-separated=${report.affine.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}\n`,
  );
  process.stdout.write(
    `- routed: last-parity=${report.routed.lastParityRegimeValue?.toFixed(2) ?? 'none'}, first-separated=${report.routed.firstSeparatedRegimeValue?.toFixed(2) ?? 'none'}\n`,
  );

  if (options.assertBoundary && !report.predictedNearControlRecovered) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
