import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderAdaptiveSupremumFamilySweepMarkdown,
  runAdaptiveSupremumFamilySweep,
} from '../src/adaptive-supremum-family-sweep';

interface CliOptions {
  readonly assertChecks: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(
    moduleDir,
    '../artifacts/adaptive-supremum-family-sweep.json',
  );
  const defaultMarkdownPath = resolve(
    moduleDir,
    '../artifacts/adaptive-supremum-family-sweep.md',
  );

  let assertChecks = false;
  let jsonPath = defaultJsonPath;
  let markdownPath = defaultMarkdownPath;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--assert') {
      assertChecks = true;
      continue;
    }
    if (arg === '--json') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --json');
      }
      jsonPath = resolve(next);
      index += 1;
      continue;
    }
    if (arg === '--markdown') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --markdown');
      }
      markdownPath = resolve(next);
      index += 1;
      continue;
    }
    throw new Error(`Unknown flag: ${arg}`);
  }

  return {
    assertChecks,
    jsonPath,
    markdownPath,
  };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const report = runAdaptiveSupremumFamilySweep();

  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });

  writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    options.markdownPath,
    renderAdaptiveSupremumFamilySweepMarkdown(report),
    'utf8',
  );

  process.stdout.write(
    `adaptive-supremum-family-sweep: ${report.summary.familyClosureRecovered ? 'READY' : 'FAILED'}\n`,
  );
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);
  process.stdout.write(
    `- cases=${report.summary.caseCount}, min-drift-gap=${report.summary.minDriftGap.toFixed(3)}, min-right-slack=${report.summary.minRightSlack.toFixed(3)}, max-states=${report.summary.maxStateCount}\n`,
  );
  process.stdout.write(`- tightest-case=${report.summary.worstCaseId}\n`);

  if (options.assertChecks && !report.summary.familyClosureRecovered) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
