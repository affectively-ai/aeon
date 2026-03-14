import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderGnosisMoaTransformerEvidenceMarkdown,
  runGnosisMoaTransformerEvidenceBenchmark,
} from '../src/gnosis-moa-transformer-evidence-benchmark';

interface CliOptions {
  readonly assertClaims: boolean;
  readonly jsonPath: string;
  readonly markdownPath: string;
}

function parseCli(argv: readonly string[]): CliOptions {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const defaultJsonPath = resolve(
    moduleDir,
    '../artifacts/gnosis-moa-transformer-evidence-benchmark.json'
  );
  const defaultMarkdownPath = resolve(
    moduleDir,
    '../artifacts/gnosis-moa-transformer-evidence-benchmark.md'
  );

  let assertClaims = false;
  let jsonPath = defaultJsonPath;
  let markdownPath = defaultMarkdownPath;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--assert') {
      assertClaims = true;
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
    assertClaims,
    jsonPath,
    markdownPath,
  };
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2));
  const report = await runGnosisMoaTransformerEvidenceBenchmark();

  mkdirSync(dirname(options.jsonPath), { recursive: true });
  mkdirSync(dirname(options.markdownPath), { recursive: true });

  writeFileSync(
    options.jsonPath,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    options.markdownPath,
    renderGnosisMoaTransformerEvidenceMarkdown(report),
    'utf8'
  );

  const allClaimsHold =
    report.timingAdvantageRecovered &&
    report.accuracyGapClosesWithScale &&
    report.outerSparsityImprovesEfficiency &&
    report.innerSparsityImprovesEfficiency &&
    report.underRoutingHurtsAccuracy;

  process.stdout.write(
    `gnosis-moa-transformer-evidence-benchmark: ${
      allClaimsHold ? 'PASS' : 'FAIL'
    }\n`
  );
  process.stdout.write(
    `gg-sparse-surface: ${report.topologySurface.moaStructuredPrimitive} @ ${report.topologySurface.moaTopologyPath}\n`
  );
  process.stdout.write(`json: ${options.jsonPath}\n`);
  process.stdout.write(`markdown: ${options.markdownPath}\n`);

  for (const scale of report.scales) {
    process.stdout.write(
      `- scale ${
        scale.id
      }: speedup=${scale.moaEvalWallTimeSpeedupVsRegular.toFixed(
        2
      )}x, moa-mse=${scale.families.moa.meanEvalMeanSquaredError.toFixed(
        4
      )}, regular-mse=${scale.families.regular.meanEvalMeanSquaredError.toFixed(
        4
      )}, moa-heads=${scale.families.moa.meanActiveHeadCount.toFixed(
        1
      )}, regular-heads=${scale.families.regular.meanActiveHeadCount.toFixed(
        1
      )}\n`
    );
  }

  for (const ablation of report.ablations) {
    process.stdout.write(
      `- ablation ${
        ablation.id
      }: eval-mse=${ablation.families.moa.meanEvalMeanSquaredError.toFixed(
        4
      )}, exact=${ablation.families.moa.meanExactWithinToleranceFraction.toFixed(
        4
      )}, speedup=${ablation.moaEvalWallTimeSpeedupVsRegular.toFixed(2)}x\n`
    );
  }

  if (
    options.assertClaims &&
    (!allClaimsHold ||
      report.topologySurface.moaStructuredPrimitive !== 'StructuredMoA')
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
