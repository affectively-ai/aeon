import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, extname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { parseTlaModule, parseTlcConfig } from '@affectively/aeon-logic';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const formalDir = join(rootDir, 'formal');

const parserIterations = Number.parseInt(process.env.PARSER_ITERS ?? '1200', 10);
const parserSamples = Number.parseInt(process.env.PARSER_SAMPLES ?? '9', 10);
const parserWarmups = Number.parseInt(process.env.PARSER_WARMUPS ?? '2', 10);
const javaSamples = Number.parseInt(process.env.JAVA_SAMPLES ?? '9', 10);
const javaWarmups = Number.parseInt(process.env.JAVA_WARMUPS ?? '1', 10);

interface FormalPair {
  readonly baseName: string;
  readonly tlaSource: string;
  readonly cfgSource: string;
}

function nowMs(): number {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? 0;
  }
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const clamped = Math.min(Math.max(q, 0), 1);
  const index = Math.floor(clamped * (sorted.length - 1));
  return sorted[index] ?? 0;
}

function loadFormalPairs(): readonly FormalPair[] {
  const files = readdirSync(formalDir).filter((entry) => !entry.startsWith('.'));
  const cfgBases = files
    .filter((entry) => extname(entry) === '.cfg')
    .map((entry) => basename(entry, '.cfg'))
    .sort();

  const pairs: FormalPair[] = [];
  for (const baseName of cfgBases) {
    const tlaPath = join(formalDir, `${baseName}.tla`);
    const cfgPath = join(formalDir, `${baseName}.cfg`);
    if (!existsSync(tlaPath)) {
      continue;
    }
    pairs.push({
      baseName,
      tlaSource: readFileSync(tlaPath, 'utf8'),
      cfgSource: readFileSync(cfgPath, 'utf8'),
    });
  }
  return pairs;
}

function runAeonLogicParserBench(formalPairs: readonly FormalPair[]): {
  elapsedMs: number;
  artifactsParsed: number;
} {
  const start = nowMs();
  let artifactsParsed = 0;

  for (let iteration = 0; iteration < parserIterations; iteration += 1) {
    for (const pair of formalPairs) {
      parseTlaModule(pair.tlaSource);
      parseTlcConfig(pair.cfgSource);
      artifactsParsed += 2;
    }
  }

  const elapsedMs = nowMs() - start;
  return { elapsedMs, artifactsParsed };
}

function resolveJavaBinary(): string | null {
  if (process.env.JAVA_BIN && existsSync(process.env.JAVA_BIN)) {
    return process.env.JAVA_BIN;
  }

  const homebrewJava = '/opt/homebrew/opt/openjdk/bin/java';
  if (existsSync(homebrewJava)) {
    return homebrewJava;
  }

  const whichJava = spawnSync('sh', ['-lc', 'command -v java'], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  if (whichJava.status === 0) {
    const candidate = whichJava.stdout.trim();
    return candidate.length > 0 ? candidate : null;
  }
  return null;
}

function benchJavaSany(javaBin: string, tlaPath: string, jarPath: string): readonly number[] {
  for (let i = 0; i < Math.max(javaWarmups, 0); i += 1) {
    const warmup = spawnSync(
      javaBin,
      ['-cp', jarPath, 'tla2sany.SANY', tlaPath],
      { cwd: formalDir, encoding: 'utf8' },
    );
    if (warmup.status !== 0) {
      return [];
    }
  }

  const samples: number[] = [];
  for (let i = 0; i < javaSamples; i += 1) {
    const start = nowMs();
    const result = spawnSync(
      javaBin,
      ['-cp', jarPath, 'tla2sany.SANY', tlaPath],
      { cwd: formalDir, encoding: 'utf8' },
    );
    const elapsed = nowMs() - start;
    if (result.status !== 0) {
      return [];
    }
    samples.push(elapsed);
  }
  return samples;
}

function main(): void {
  const formalPairs = loadFormalPairs();
  if (formalPairs.length === 0) {
    throw new Error('No formal .tla/.cfg pairs found for shootoff');
  }

  for (let i = 0; i < Math.max(parserWarmups, 0); i += 1) {
    runAeonLogicParserBench(formalPairs);
  }

  const parserRuns = Array.from({ length: Math.max(parserSamples, 1) }, () =>
    runAeonLogicParserBench(formalPairs),
  );
  const parserElapsed = parserRuns.map((run) => run.elapsedMs);
  const artifactsParsed = parserRuns[0]?.artifactsParsed ?? 0;
  const parserMedianMs = median(parserElapsed);
  const parserQ1Ms = quantile(parserElapsed, 0.25);
  const parserQ3Ms = quantile(parserElapsed, 0.75);
  const parserPerSecond = parserMedianMs > 0 ? (artifactsParsed / parserMedianMs) * 1000 : 0;

  process.stdout.write('\n=== Formal Parser Shootoff ===\n');
  process.stdout.write(
    `aeon-logic parser median: ${artifactsParsed} artifacts in ${parserMedianMs.toFixed(2)} ms (${parserPerSecond.toFixed(1)} artifacts/sec)\n`,
  );
  process.stdout.write(
    `aeon-logic parser IQR (q1-q3): ${parserQ1Ms.toFixed(2)}-${parserQ3Ms.toFixed(2)} ms (${Math.max(parserSamples, 1)} samples, ${Math.max(parserWarmups, 0)} warmups)\n`,
  );
  process.stdout.write(
    `(workload: ${formalPairs.length} module pairs × ${parserIterations} iterations)\n`,
  );

  const javaBin = resolveJavaBinary();
  const jarPath = join(formalDir, '.tools', 'tla2tools.jar');
  const baselineTla = join(formalDir, `${formalPairs[0]?.baseName ?? 'ForkRaceFoldC1C4'}.tla`);

  if (!javaBin || !existsSync(jarPath) || !existsSync(baselineTla)) {
    process.stdout.write(
      'java baseline: skipped (java and/or tla2tools.jar not found; run `bun run test:formal` first)\n',
    );
    return;
  }

  const javaSamplesMs = benchJavaSany(javaBin, baselineTla, jarPath);
  if (javaSamplesMs.length === 0) {
    process.stdout.write('java baseline: skipped (unable to run tla2sany.SANY)\n');
    return;
  }

  const javaMedianMs = median(javaSamplesMs);
  const javaQ1Ms = quantile(javaSamplesMs, 0.25);
  const javaQ3Ms = quantile(javaSamplesMs, 0.75);
  const parserArtifactMs = parserMedianMs > 0 && artifactsParsed > 0 ? parserMedianMs / artifactsParsed : 0;
  const normalizedRatio = parserArtifactMs > 0 ? javaMedianMs / parserArtifactMs : 0;
  process.stdout.write(
    `java SANY parse median: ${javaMedianMs.toFixed(2)} ms for ${basename(baselineTla)} (${javaSamples} samples)\n`,
  );
  process.stdout.write(
    `java SANY IQR (q1-q3): ${javaQ1Ms.toFixed(2)}-${javaQ3Ms.toFixed(2)} ms (${Math.max(javaWarmups, 0)} warmups)\n`,
  );
  process.stdout.write(
    `normalized per-artifact throughput ratio (median): ${normalizedRatio.toFixed(1)}x\n`,
  );
  process.stdout.write(
    'note: this is a startup+parse baseline and not a semantic-equivalence benchmark\n',
  );
}

main();
