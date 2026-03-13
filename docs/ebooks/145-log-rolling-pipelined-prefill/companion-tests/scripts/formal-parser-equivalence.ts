import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { dirname, extname, join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  parseTlaModule,
  parseTlcConfig,
  renderTlaModule,
  serializeTlcConfig,
} from '@affectively/aeon-logic';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const formalDir = join(rootDir, 'formal');

interface FormalPair {
  readonly baseName: string;
  readonly tlaPath: string;
  readonly cfgPath: string;
  readonly tlaSource: string;
  readonly cfgSource: string;
}

interface ParseOutcome {
  readonly ok: boolean;
  readonly message?: string;
}

interface SanyResult extends ParseOutcome {
  readonly elapsedMs: number;
}

interface BenchmarkCounters {
  originalsCompared: number;
  originalsAgreement: number;
  roundTripsCompared: number;
  roundTripsAgreement: number;
  invalidCompared: number;
  invalidAgreement: number;
}

interface Disagreement {
  readonly caseLabel: string;
  readonly aeonOk: boolean;
  readonly sanyOk: boolean;
  readonly aeonMessage?: string;
  readonly sanyMessage?: string;
}

function nowMs(): number {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function safeMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
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
    if (!existsSync(tlaPath)) continue;

    pairs.push({
      baseName,
      tlaPath,
      cfgPath,
      tlaSource: readFileSync(tlaPath, 'utf8'),
      cfgSource: readFileSync(cfgPath, 'utf8'),
    });
  }
  return pairs;
}

function equivalenceFilter(): string | null {
  const value = process.env.FORMAL_EQUIVALENCE_FILTER?.trim();
  return value && value.length > 0 ? value : null;
}

function tryAeonParseTla(source: string): ParseOutcome {
  try {
    parseTlaModule(source);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

function tryAeonParseCfg(source: string): ParseOutcome {
  try {
    parseTlcConfig(source);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
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

function runSany(javaBin: string, jarPath: string, tlaPath: string): SanyResult {
  const start = nowMs();
  const result = spawnSync(
    javaBin,
    ['-cp', jarPath, 'tla2sany.SANY', tlaPath],
    {
      cwd: formalDir,
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
  const elapsedMs = nowMs() - start;

  if (result.status === 0) {
    return { ok: true, elapsedMs };
  }

  const lines = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const message =
    lines.find(
      (line) =>
        !line.startsWith('****** SANY2 Version') &&
        !line.startsWith('Parsing file') &&
        !line.startsWith('Semantic processing') &&
        !line.startsWith('Linting'),
    ) ?? lines[0] ?? 'SANY parse failed';
  return {
    ok: false,
    elapsedMs,
    message,
  };
}

function invalidMutations(baseName: string): readonly string[] {
  return [
    `@@@INVALID_${baseName}_TOKEN@@@`,
    `EXTENDS Naturals\nASSUME TRUE\n\\* missing module header (${baseName})\n`,
  ];
}

function roundTripTla(source: string): string {
  return renderTlaModule(parseTlaModule(source));
}

function roundTripCfg(source: string): string {
  return serializeTlcConfig(parseTlcConfig(source));
}

function compareOutcomes(
  counters: BenchmarkCounters,
  disagreements: Disagreement[],
  caseLabel: string,
  aeon: ParseOutcome,
  sany: ParseOutcome,
  bucket: 'original' | 'roundtrip' | 'invalid',
): void {
  if (bucket === 'original') {
    counters.originalsCompared += 1;
  } else if (bucket === 'roundtrip') {
    counters.roundTripsCompared += 1;
  } else {
    counters.invalidCompared += 1;
  }

  if (aeon.ok === sany.ok) {
    if (bucket === 'original') counters.originalsAgreement += 1;
    else if (bucket === 'roundtrip') counters.roundTripsAgreement += 1;
    else counters.invalidAgreement += 1;
    return;
  }

  disagreements.push({
    caseLabel,
    aeonOk: aeon.ok,
    sanyOk: sany.ok,
    aeonMessage: aeon.message,
    sanyMessage: sany.message,
  });
}

function printRatio(label: string, numerator: number, denominator: number): void {
  const pct = denominator > 0 ? (numerator / denominator) * 100 : 0;
  process.stdout.write(`${label}: ${numerator}/${denominator} (${pct.toFixed(1)}%)\n`);
}

function main(): void {
  const filter = equivalenceFilter();
  const formalPairs = loadFormalPairs().filter(
    (pair) => filter === null || pair.baseName.includes(filter),
  );
  if (formalPairs.length === 0) {
    throw new Error('No formal .tla/.cfg pairs found for equivalence benchmark');
  }

  process.stdout.write('\n=== Formal Semantic-Equivalence Benchmark ===\n');
  process.stdout.write(`corpus: ${formalPairs.length} formal module pairs\n`);

  const tmpRoot = mkdtempSync(join(tmpdir(), 'aeon-logic-equivalence-'));
  const jarPath = join(formalDir, '.tools', 'tla2tools.jar');
  const javaBin = resolveJavaBinary();

  let aeonTlaParses = 0;
  let aeonCfgParses = 0;
  let aeonRoundTripStable = 0;

  const counters: BenchmarkCounters = {
    originalsCompared: 0,
    originalsAgreement: 0,
    roundTripsCompared: 0,
    roundTripsAgreement: 0,
    invalidCompared: 0,
    invalidAgreement: 0,
  };
  const disagreements: Disagreement[] = [];

  const javaAvailable = Boolean(javaBin && existsSync(jarPath));
  if (!javaAvailable) {
    process.stdout.write(
      'java SANY differential checks: skipped (java and/or tla2tools.jar unavailable)\n',
    );
  }

  for (const pair of formalPairs) {
    const aeonTla = tryAeonParseTla(pair.tlaSource);
    const aeonCfg = tryAeonParseCfg(pair.cfgSource);
    if (aeonTla.ok) aeonTlaParses += 1;
    if (aeonCfg.ok) aeonCfgParses += 1;

    let tlaRoundTrip = '';
    let cfgRoundTrip = '';
    let roundTripParse: ParseOutcome = { ok: false, message: 'roundtrip unavailable' };
    if (aeonTla.ok && aeonCfg.ok) {
      try {
        tlaRoundTrip = roundTripTla(pair.tlaSource);
        cfgRoundTrip = roundTripCfg(pair.cfgSource);
        const reparseTla = tryAeonParseTla(tlaRoundTrip);
        const reparseCfg = tryAeonParseCfg(cfgRoundTrip);
        roundTripParse = {
          ok: reparseTla.ok && reparseCfg.ok,
          message: [reparseTla.message, reparseCfg.message].filter(Boolean).join(' | '),
        };
        if (roundTripParse.ok) {
          aeonRoundTripStable += 1;
        }
      } catch (error) {
        roundTripParse = { ok: false, message: safeMessage(error) };
      }
    }

    if (!javaAvailable || !javaBin) {
      continue;
    }

    const moduleTmpDir = join(tmpRoot, pair.baseName);
    mkdirSync(moduleTmpDir, { recursive: true });
    const renderedTlaPath = join(moduleTmpDir, `${pair.baseName}.tla`);
    writeFileSync(renderedTlaPath, tlaRoundTrip.length > 0 ? tlaRoundTrip : pair.tlaSource, 'utf8');

    const sanyOriginal = runSany(javaBin, jarPath, pair.tlaPath);
    const sanyRoundTrip = runSany(javaBin, jarPath, renderedTlaPath);

    compareOutcomes(
      counters,
      disagreements,
      `${pair.baseName}:original`,
      aeonTla,
      sanyOriginal,
      'original',
    );
    compareOutcomes(
      counters,
      disagreements,
      `${pair.baseName}:roundtrip`,
      roundTripParse,
      sanyRoundTrip,
      'roundtrip',
    );

    const invalidVariants = invalidMutations(pair.baseName);
    for (let i = 0; i < invalidVariants.length; i += 1) {
      const invalidPath = join(moduleTmpDir, `${pair.baseName}.tla`);
      writeFileSync(invalidPath, invalidVariants[i], 'utf8');
      const aeonInvalid = tryAeonParseTla(invalidVariants[i]);
      const sanyInvalid = runSany(javaBin, jarPath, invalidPath);

      const aeonRejects = { ok: !aeonInvalid.ok, message: aeonInvalid.message };
      const sanyRejects = { ok: !sanyInvalid.ok, message: sanyInvalid.message };

      compareOutcomes(
        counters,
        disagreements,
        `${pair.baseName}:invalid:${i + 1}`,
        aeonRejects,
        sanyRejects,
        'invalid',
      );
    }
  }

  process.stdout.write('\n[aeon-logic self-checks]\n');
  printRatio('tla parse success', aeonTlaParses, formalPairs.length);
  printRatio('cfg parse success', aeonCfgParses, formalPairs.length);
  printRatio('roundtrip parse stability', aeonRoundTripStable, formalPairs.length);

  if (javaAvailable) {
    process.stdout.write('\n[differential agreement: aeon-logic vs SANY]\n');
    printRatio('original acceptance agreement', counters.originalsAgreement, counters.originalsCompared);
    printRatio('roundtrip acceptance agreement', counters.roundTripsAgreement, counters.roundTripsCompared);
    printRatio('invalid-rejection agreement', counters.invalidAgreement, counters.invalidCompared);

    if (disagreements.length > 0) {
      process.stdout.write('\nDisagreements:\n');
      for (const item of disagreements) {
        process.stdout.write(
          `- ${item.caseLabel}: aeon=${item.aeonOk ? 'ok' : 'fail'} | sany=${item.sanyOk ? 'ok' : 'fail'}\n`,
        );
        if (item.aeonMessage) process.stdout.write(`  aeon: ${item.aeonMessage}\n`);
        if (item.sanyMessage) process.stdout.write(`  sany: ${item.sanyMessage}\n`);
      }
      process.exitCode = 1;
    }
  }

  process.stdout.write('\n[capability delta beyond parsing]\n');
  process.stdout.write(
    '- aeon-logic ships superposition chains, quorum temporal operators, topology bridges, TLC trace adapters and an embedded model checker in the same runtime surface.\n',
  );
  process.stdout.write(
    '- SANY baseline in this harness is used as a parser acceptance oracle only.\n',
  );

  rmSync(tmpRoot, { recursive: true, force: true });
}

main();
