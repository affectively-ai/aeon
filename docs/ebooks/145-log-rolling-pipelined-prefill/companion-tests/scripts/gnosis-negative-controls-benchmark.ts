import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderGnosisNegativeControlsBenchmarkMarkdown,
  runGnosisNegativeControlsBenchmark,
} from '../src/gnosis-negative-controls-benchmark';

interface CliOptions {
  readonly assertParity: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(moduleDir, '../artifacts/gnosis-negative-controls.json');
  const defaultMarkdownPath = resolve(moduleDir, '../artifacts/gnosis-negative-controls.md');

  let assertParity = false;
  let jsonPath = defaultJsonPath;
  let markdownPath = defaultMarkdownPath;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--assert') {
      assertParity = true;
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
    assertParity,
    jsonPath,
    markdownPath,
  };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const report = await runGnosisNegativeControlsBenchmark();

  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });

  writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    options.markdownPath,
    renderGnosisNegativeControlsBenchmarkMarkdown(report),
    'utf8',
  );

  process.stdout.write(
    `gnosis-negative-controls: ${report.allControlsPass ? 'MATCH' : 'MISMATCH'}\n`,
  );
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);
  for (const [taskId, task] of Object.entries(report.tasks)) {
    process.stdout.write(
      `- ${taskId}: gap=${task.maxEvalMeanSquaredErrorGap.toFixed(3)}, min-exact=${task.minExactWithinToleranceFraction.toFixed(3)}, parity=${task.parityRecovered ? 'yes' : 'no'}\n`,
    );
  }

  if (options.assertParity && !report.allControlsPass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
