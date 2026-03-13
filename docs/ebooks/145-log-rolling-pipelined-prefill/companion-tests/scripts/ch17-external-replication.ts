import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderCh17ExternalReplicationMarkdown,
  runCh17ExternalReplication,
} from '../src/ch17-external-replication';

interface CliOptions {
  readonly assertRun: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(moduleDir, '../artifacts/ch17-external-replication.json');
  const defaultMarkdownPath = resolve(moduleDir, '../artifacts/ch17-external-replication.md');

  let assertRun = false;
  let jsonPath = defaultJsonPath;
  let markdownPath = defaultMarkdownPath;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--assert') {
      assertRun = true;
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
    assertRun,
    jsonPath,
    markdownPath,
  };
}

function main(): void {
  const options = parseCli(process.argv.slice(2));
  const report = runCh17ExternalReplication();

  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });

  writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    options.markdownPath,
    renderCh17ExternalReplicationMarkdown(report),
    'utf8',
  );

  process.stdout.write(`ch17-external-replication: ${report.ok ? 'PASS' : 'FAIL'}\n`);
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);
  process.stdout.write(`hashes: ${report.hashChecks.length} verified\n`);

  if (options.assertRun && !report.ok) {
    process.exitCode = 1;
  }
}

main();
