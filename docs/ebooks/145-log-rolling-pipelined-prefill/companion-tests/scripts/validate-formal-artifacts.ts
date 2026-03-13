import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseTlaModule,
  parseTlcConfig,
  renderTlaModule,
  runLeanSandbox,
  serializeTlcConfig,
} from '@affectively/aeon-logic';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const formalDir = join(rootDir, 'formal');
const leanDir = join(formalDir, 'lean');

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function validateTlaFile(filename: string): void {
  const fullPath = join(formalDir, filename);
  const source = readFileSync(fullPath, 'utf8');
  const parsed = parseTlaModule(source);
  const rendered = renderTlaModule(parsed);
  const reparsed = parseTlaModule(rendered);

  assert(
    JSON.stringify(reparsed) === JSON.stringify(parsed),
    `TLA round-trip mismatch for ${filename}`,
  );
  assert(parsed.moduleName === basename(filename, '.tla'), `Module name mismatch for ${filename}`);
}

function validateCfgFile(filename: string): void {
  const fullPath = join(formalDir, filename);
  const source = readFileSync(fullPath, 'utf8');
  const parsed = parseTlcConfig(source);
  const rendered = serializeTlcConfig(parsed);
  const reparsed = parseTlcConfig(rendered);

  assert(
    JSON.stringify(reparsed) === JSON.stringify(parsed),
    `CFG round-trip mismatch for ${filename}`,
  );
  assert(
    Boolean(parsed.specification || (parsed.init && parsed.next)),
    `Config ${filename} must specify SPECIFICATION or INIT+NEXT`,
  );
}

function validateLeanProject(): number {
  const result = runLeanSandbox({
    path: leanDir,
    build: false,
  });

  assert(result.report.project.lakefile !== null, 'Lean project must define a Lake configuration');
  assert(result.report.project.toolchain !== null, 'Lean project must define a lean-toolchain');
  assert(result.report.project.moduleCount > 0, 'Lean project must contain at least one module');
  assert(
    result.report.project.moduleNames.includes('ForkRaceFoldTheorems'),
    'Lean project must expose the ForkRaceFoldTheorems entrypoint',
  );
  assert(
    result.report.project.moduleNames.includes('ForkRaceFoldTheorems.MeasureQueueing'),
    'Lean project must expose the MeasureQueueing module',
  );
  assert(
    result.report.project.moduleNames.includes('ForkRaceFoldTheorems.FailureComposition'),
    'Lean project must expose the FailureComposition module',
  );
  assert(
    result.report.project.moduleNames.includes('ForkRaceFoldTheorems.FailureUniversality'),
    'Lean project must expose the FailureUniversality module',
  );
  assert(
    result.report.project.moduleNames.includes('ForkRaceFoldTheorems.FailureEntropy'),
    'Lean project must expose the FailureEntropy module',
  );
  assert(
    result.report.project.moduleNames.includes('ForkRaceFoldTheorems.FailureFamilies'),
    'Lean project must expose the FailureFamilies module',
  );
  assert(
    result.report.project.moduleNames.includes('ForkRaceFoldTheorems.FailureTrilemma'),
    'Lean project must expose the FailureTrilemma module',
  );
  assert(
    result.report.project.moduleNames.includes('ForkRaceFoldTheorems.QueueStability'),
    'Lean project must expose the QueueStability module',
  );
  assert(
    result.report.project.moduleNames.includes('ForkRaceFoldTheorems.JacksonQueueing'),
    'Lean project must expose the JacksonQueueing module',
  );
  assert(
    result.report.build.attempted === false,
    'Lean inspection preflight must not execute a build',
  );

  return result.report.project.moduleCount;
}

function main(): void {
  const files = readdirSync(formalDir).filter((entry) => !entry.startsWith('.'));
  const allTlaFiles = files.filter((entry) => extname(entry) === '.tla');
  const cfgFiles = files.filter((entry) => extname(entry) === '.cfg');

  assert(cfgFiles.length > 0, 'No .cfg files found in formal/');

  const cfgByBase = new Set(cfgFiles.map((entry) => basename(entry, '.cfg')));
  const tlaFiles = allTlaFiles.filter((entry) => cfgByBase.has(basename(entry, '.tla')));
  assert(tlaFiles.length > 0, 'No .tla files with matching .cfg found in formal/');

  for (const cfgFile of cfgFiles) {
    const baseName = basename(cfgFile, '.cfg');
    assert(
      allTlaFiles.includes(`${baseName}.tla`),
      `Missing module for config ${baseName}.cfg`,
    );
  }

  for (const filename of tlaFiles) {
    validateTlaFile(filename);
  }
  for (const filename of cfgFiles) {
    validateCfgFile(filename);
  }
  const leanModuleCount = validateLeanProject();

  process.stdout.write(
    `aeon-logic formal validation passed (${tlaFiles.length} TLA modules, ${cfgFiles.length} CFG files, ${leanModuleCount} Lean modules)\n`,
  );
}

main();
