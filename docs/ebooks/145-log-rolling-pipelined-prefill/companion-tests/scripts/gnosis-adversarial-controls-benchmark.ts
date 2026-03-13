import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderGnosisAdversarialControlsBenchmarkMarkdown,
  runGnosisAdversarialControlsBenchmark,
} from '../src/gnosis-adversarial-controls-benchmark';

interface CliOptions {
  readonly assertPredictions: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(moduleDir, '../artifacts/gnosis-adversarial-controls-benchmark.json');
  const defaultMarkdownPath = resolve(moduleDir, '../artifacts/gnosis-adversarial-controls-benchmark.md');

  let assertPredictions = false;
  let jsonPath = defaultJsonPath;
  let markdownPath = defaultMarkdownPath;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--assert') {
      assertPredictions = true;
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
    assertPredictions,
    jsonPath,
    markdownPath,
  };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const report = await runGnosisAdversarialControlsBenchmark();

  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });

  writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    options.markdownPath,
    renderGnosisAdversarialControlsBenchmarkMarkdown(report),
    'utf8',
  );

  process.stdout.write(
    `gnosis-adversarial-controls-benchmark: ${report.allAdversarialPredictionsRecovered ? 'MATCH' : 'MISMATCH'}\n`,
  );
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);
  for (const [taskId, task] of Object.entries(report.tasks)) {
    process.stdout.write(
      `- ${taskId}: favored=${task.favoredStrategy}, final=${task.rankingByFinalEvalMeanSquaredError[0]}, auc=${task.rankingByLearningCurveArea[0]}, recovered=${task.predictionRecovered ? 'yes' : 'no'}\n`,
    );
  }

  if (options.assertPredictions && !report.allAdversarialPredictionsRecovered) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
