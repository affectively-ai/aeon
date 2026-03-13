import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runLeanSandbox } from '@affectively/aeon-logic';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const leanDir = join(rootDir, 'formal', 'lean');
const buildTargets = (process.env.AEON_LEAN_BUILD_TARGETS ?? 'ForkRaceFoldTheorems')
  .split(',')
  .map((target) => target.trim())
  .filter((target) => target.length > 0);

function fail(message: string, details?: readonly string[]): never {
  process.stderr.write(`${message}\n`);
  for (const detail of details ?? []) {
    process.stderr.write(`${detail}\n`);
  }
  process.exit(1);
}

function main(): void {
  process.stdout.write('Running Lean mechanized theorem build via aeon-logic Lean sandbox\n');

  const result = runLeanSandbox({
    path: leanDir,
    build: true,
    buildTargets,
  });

  for (const logLine of result.logs) {
    process.stdout.write(`${logLine}\n`);
  }

  const buildStdout = result.report.build.stdout.trim();
  if (buildStdout.length > 0) {
    process.stdout.write(`${buildStdout}\n`);
  }

  const buildStderr = result.report.build.stderr.trim();
  if (buildStderr.length > 0) {
    process.stderr.write(`${buildStderr}\n`);
  }

  if (!result.report.project.lakefile) {
    fail('Lean Lake project configuration not found.', [
      `Resolved project root: ${result.report.project.root}`,
    ]);
  }

  if (!result.report.tool.lakeAvailable) {
    fail('Lean Lake tool not found.', [
      'Install Lean via elan (https://leanprover.github.io/elan/) or ensure "lake" is on PATH.',
    ]);
  }

  if (!result.report.build.attempted) {
    fail('Lean build was not attempted by the aeon-logic Lean sandbox.');
  }

  if (result.report.build.ok !== true) {
    fail('Lean mechanized theorem build failed.', [
      `Project root: ${result.report.project.root}`,
      `Exit code: ${result.report.build.exitCode ?? 'unknown'}`,
    ]);
  }

  process.stdout.write(
    `aeon-logic Lean sandbox validation passed (${result.report.project.moduleCount} Lean modules)\n`,
  );
}

main();
