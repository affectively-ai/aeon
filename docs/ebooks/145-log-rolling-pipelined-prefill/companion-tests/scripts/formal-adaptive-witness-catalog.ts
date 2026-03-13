import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderFormalAdaptiveWitnessCatalogMarkdown,
  type FormalAdaptiveWitnessCatalogReport,
} from '../src/formal-adaptive-witness-catalog';

interface CliOptions {
  readonly assertCatalog: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(moduleDir, '../artifacts/formal-adaptive-witness-catalog.json');
  const defaultMarkdownPath = resolve(moduleDir, '../artifacts/formal-adaptive-witness-catalog.md');

  let assertCatalog = false;
  let jsonPath = defaultJsonPath;
  let markdownPath = defaultMarkdownPath;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--assert') {
      assertCatalog = true;
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
    assertCatalog,
    jsonPath,
    markdownPath,
  };
}

function extractCatalog(stdout: string): FormalAdaptiveWitnessCatalogReport {
  const trimmed = stdout.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart === -1) {
    throw new Error('Lean adaptive witness export did not emit JSON.');
  }
  return JSON.parse(trimmed.slice(jsonStart)) as FormalAdaptiveWitnessCatalogReport;
}

function main(): void {
  const options = parseCli(process.argv.slice(2));
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const leanDir = resolve(moduleDir, '../formal/lean');

  const buildResult = spawnSync('lake', ['build', 'ForkRaceFoldTheorems.AdaptiveWitnesses'], {
    cwd: leanDir,
    encoding: 'utf8',
  });

  if (buildResult.status !== 0) {
    process.stderr.write(buildResult.stderr);
    process.exit(buildResult.status ?? 1);
  }

  const result = spawnSync(
    'lake',
    ['env', 'lean', 'Lean/ForkRaceFoldTheorems/AdaptiveWitnessExport.lean'],
    {
      cwd: leanDir,
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  const report = extractCatalog(result.stdout);
  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });

  writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    options.markdownPath,
    renderFormalAdaptiveWitnessCatalogMarkdown(report),
    'utf8',
  );

  process.stdout.write(
    `formal-adaptive-witness-catalog: ${report.witnesses.length > 0 ? 'READY' : 'EMPTY'}\n`,
  );
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);
  process.stdout.write(`witnesses: ${report.witnesses.length}\n`);

  if (
    options.assertCatalog &&
    !(
      report.label === 'formal-adaptive-supremum-witness-catalog-v1' &&
      report.witnesses.length >= 1 &&
      report.witnesses.some((witness) => witness.id === 'two-node-adaptive-raw-ceiling')
    )
  ) {
    process.exitCode = 1;
  }
}

main();
