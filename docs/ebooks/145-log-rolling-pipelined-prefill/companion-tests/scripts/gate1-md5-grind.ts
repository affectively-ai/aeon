import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  makeMd5GrindGate1Config,
  renderGate1Markdown,
  runGate1Matrix,
} from '../src/gate1-wallclock';

interface CliOptions {
  readonly assertGate: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
  readonly label: string | null;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(
    moduleDir,
    '../artifacts/gate1-wallclock-md5-grind.json',
  );
  const defaultMarkdownPath = resolve(
    moduleDir,
    '../artifacts/gate1-wallclock-md5-grind.md',
  );

  let assertGate = false;
  let jsonPath = defaultJsonPath;
  let markdownPath = defaultMarkdownPath;
  let label: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--assert') {
      assertGate = true;
      continue;
    }
    if (arg === '--json') {
      const next = argv[++i];
      if (!next) {
        throw new Error('Missing value for --json');
      }
      jsonPath = resolve(next);
      continue;
    }
    if (arg === '--markdown') {
      const next = argv[++i];
      if (!next) {
        throw new Error('Missing value for --markdown');
      }
      markdownPath = resolve(next);
      continue;
    }
    if (arg === '--label') {
      const next = argv[++i];
      if (!next) {
        throw new Error('Missing value for --label');
      }
      label = next;
      continue;
    }
    throw new Error(`Unknown flag: ${arg}`);
  }

  return {
    assertGate,
    jsonPath,
    markdownPath,
    label,
  };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const config = makeMd5GrindGate1Config();
  const report = await runGate1Matrix(config, {
    label: options.label ?? 'loopback-md5-grind',
  });

  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });

  writeFileSync(options.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(options.markdownPath, renderGate1Markdown(report), 'utf8');

  process.stdout.write(`gate1-md5 verdict: ${report.gate.pass ? 'PASS' : 'DENY'}\n`);
  process.stdout.write(
    `primary cells: ${report.gate.passedPrimaryCells.length}/${report.gate.primaryCells.length}\n`,
  );
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);

  for (const cell of report.cells) {
    process.stdout.write(
      `- ${cell.cellId}: seq-p50=${cell.sequential.p50Ms.toFixed(2)}ms, chunked-p50=${cell.chunked.p50Ms.toFixed(2)}ms, speedup=${cell.speedupMedian.toFixed(3)}x\n`,
    );
  }

  if (options.assertGate && !report.gate.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
