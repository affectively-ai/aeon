import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderGnosisMiniMoeRoutingBenchmarkMarkdown,
  runGnosisMiniMoeRoutingBenchmark,
} from '../src/gnosis-moe-routing-benchmark';

interface CliOptions {
  readonly assertRanking: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(moduleDir, '../artifacts/gnosis-moe-routing-benchmark.json');
  const defaultMarkdownPath = resolve(moduleDir, '../artifacts/gnosis-moe-routing-benchmark.md');

  let assertRanking = false;
  let jsonPath = defaultJsonPath;
  let markdownPath = defaultMarkdownPath;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--assert') {
      assertRanking = true;
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
    assertRanking,
    jsonPath,
    markdownPath,
  };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const report = await runGnosisMiniMoeRoutingBenchmark();

  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });

  writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    options.markdownPath,
    renderGnosisMiniMoeRoutingBenchmarkMarkdown(report),
    'utf8',
  );

  process.stdout.write(
    `gnosis-moe-routing-benchmark: ${report.predictedRankingMatches ? 'MATCH' : 'MISMATCH'}\n`,
  );
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);

  for (const strategy of report.rankingByEvalMeanSquaredError) {
    const metrics = report.strategies[strategy];
    process.stdout.write(
      `- ${strategy}: eval-mse=${metrics.meanEvalMeanSquaredError.toFixed(3)}, exact=${metrics.meanExactWithinToleranceFraction.toFixed(3)}, dual=${metrics.meanDualActiveRegionMeanAbsoluteError.toFixed(3)}\n`,
    );
  }

  if (options.assertRanking && !report.predictedRankingMatches) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
