import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCh17ReplicationPack } from './ch17-replication-pack';

export interface ExternalReplicationStep {
  readonly label: string;
  readonly cwd: string;
  readonly command: string;
  readonly ok: boolean;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly stdoutTail: string;
  readonly stderrTail: string;
  readonly skipped: boolean;
}

export interface ExternalReplicationHashCheck {
  readonly path: string;
  readonly expectedSha256: string;
  readonly actualSha256: string;
  readonly matches: boolean;
}

export interface Ch17ExternalReplicationReport {
  readonly label: 'ch17-external-replication-v1';
  readonly rootCommand: string;
  readonly steps: readonly ExternalReplicationStep[];
  readonly totalDurationMs: number;
  readonly slowestStepLabel: string;
  readonly slowestStepDurationMs: number;
  readonly manifestStable: boolean;
  readonly hashChecks: readonly ExternalReplicationHashCheck[];
  readonly allHashesMatch: boolean;
  readonly ok: boolean;
}

interface ExternalReplicationOptions {
  readonly executeCommands?: boolean;
}

interface ReplicationManifestEntry {
  readonly path: string;
  readonly sha256: string;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const companionRoot = resolve(moduleDir, '..');
const repoRoot = resolve(companionRoot, '../../../../../..');
const gnosisRoot = resolve(repoRoot, 'open-source/gnosis');
const manifestPath = resolve(companionRoot, 'artifacts/ch17-replication-pack.json');

const commandPlan = [
  {
    label: 'Install workspace dependencies',
    cwd: repoRoot,
    command: 'bun install --frozen-lockfile',
  },
  { label: 'Build Gnosis', cwd: gnosisRoot, command: 'bun run build' },
  { label: 'Test Gnosis fold training', cwd: gnosisRoot, command: 'bun run test:fold-training' },
  { label: 'Test Gnosis negative controls', cwd: gnosisRoot, command: 'bun run test:negative-controls' },
  { label: 'Test Gnosis regime sweep', cwd: gnosisRoot, command: 'bun run test:regime-sweep' },
  { label: 'Test Gnosis adversarial controls', cwd: gnosisRoot, command: 'bun run test:adversarial-controls' },
  { label: 'Test Gnosis mini-MoE routing', cwd: gnosisRoot, command: 'bun run test:mini-moe-routing' },
  { label: 'Export formal witness catalog', cwd: companionRoot, command: 'bun run test:formal:witnesses' },
  {
    label: 'Export formal adaptive witness catalog',
    cwd: companionRoot,
    command: 'bun run test:formal:adaptive-witnesses',
  },
  {
    label: 'Run Chapter 17 reproduction surface',
    cwd: companionRoot,
    command: 'bun run test:ch17-reproduction-surface',
  },
  { label: 'Refresh replication manifest', cwd: companionRoot, command: 'bun run test:ch17-replication-pack' },
] as const;

function tail(text: string, lineCount = 8): string {
  return text.trim().split('\n').slice(-lineCount).join('\n');
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function executeStep(
  step: (typeof commandPlan)[number],
  executeCommands: boolean,
): ExternalReplicationStep {
  if (!executeCommands) {
    return {
      label: step.label,
      cwd: step.cwd,
      command: step.command,
      ok: true,
      exitCode: 0,
      durationMs: 0,
      stdoutTail: '',
      stderrTail: '',
      skipped: true,
    };
  }

  const start = Date.now();
  const result = spawnSync('bun', step.command.replace(/^bun /, '').split(' '), {
    cwd: step.cwd,
    encoding: 'utf8',
  });

  return {
    label: step.label,
    cwd: step.cwd,
    command: step.command,
    ok: result.status === 0,
    exitCode: result.status ?? 1,
    durationMs: Date.now() - start,
    stdoutTail: tail(result.stdout ?? ''),
    stderrTail: tail(result.stderr ?? ''),
    skipped: false,
  };
}

function verifyManifestHashes(entries: readonly ReplicationManifestEntry[]): ExternalReplicationHashCheck[] {
  return entries.map((entry) => {
    const absolutePath = resolve(repoRoot, entry.path);
    const actualSha256 = hashFile(absolutePath);
    return {
      path: entry.path,
      expectedSha256: entry.sha256,
      actualSha256,
      matches: actualSha256 === entry.sha256,
    };
  });
}

export function runCh17ExternalReplication(
  options: ExternalReplicationOptions = {},
): Ch17ExternalReplicationReport {
  const executeCommands = options.executeCommands ?? true;
  const steps: ExternalReplicationStep[] = [];

  for (const step of commandPlan) {
    const reportStep = executeStep(step, executeCommands);
    steps.push(reportStep);
    if (!reportStep.ok) {
      break;
    }
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    readonly entries: readonly ReplicationManifestEntry[];
  };
  const recomputedManifest = runCh17ReplicationPack();
  const hashChecks = verifyManifestHashes(manifest.entries);
  const allHashesMatch = hashChecks.every((entry) => entry.matches);
  const manifestStable =
    JSON.stringify(manifest.entries) === JSON.stringify(recomputedManifest.entries);
  const executedSteps = steps.filter((step) => !step.skipped);
  const totalDurationMs = executedSteps.reduce((sum, step) => sum + step.durationMs, 0);
  const slowestStep = executedSteps.reduce<ExternalReplicationStep | null>(
    (currentSlowest, step) =>
      currentSlowest === null || step.durationMs > currentSlowest.durationMs ? step : currentSlowest,
    null,
  );

  return {
    label: 'ch17-external-replication-v1',
    rootCommand:
      'cd open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests && bun run test:ch17-external-replication',
    steps,
    totalDurationMs,
    slowestStepLabel: slowestStep?.label ?? 'n/a',
    slowestStepDurationMs: slowestStep?.durationMs ?? 0,
    manifestStable,
    hashChecks,
    allHashesMatch,
    ok: steps.every((step) => step.ok) && allHashesMatch && manifestStable,
  };
}

export function renderCh17ExternalReplicationMarkdown(
  report: Ch17ExternalReplicationReport,
): string {
  const lines: string[] = [];
  lines.push('# Chapter 17 External Replication');
  lines.push('');
  lines.push(`- Label: \`${report.label}\``);
  lines.push(`- Root command: \`${report.rootCommand}\``);
  lines.push(`- Total duration ms: \`${report.totalDurationMs}\``);
  lines.push(`- Approx runtime: \`${(report.totalDurationMs / 1000).toFixed(3)} s\``);
  lines.push(
    `- Slowest step: \`${report.slowestStepLabel}\` (\`${report.slowestStepDurationMs} ms\`)`,
  );
  lines.push(`- Manifest stable: \`${report.manifestStable ? 'yes' : 'no'}\``);
  lines.push(`- All hashes match: \`${report.allHashesMatch ? 'yes' : 'no'}\``);
  lines.push(`- Overall result: \`${report.ok ? 'pass' : 'fail'}\``);
  lines.push('');
  lines.push('## Steps');
  lines.push('');
  lines.push('| Step | Result | Duration ms | Command |');
  lines.push('| --- | --- | ---: | --- |');
  for (const step of report.steps) {
    lines.push(
      `| ${step.label} | \`${step.skipped ? 'skipped' : step.ok ? 'ok' : `exit ${step.exitCode}`}\` | ${step.durationMs} | \`${step.command}\` |`,
    );
  }
  lines.push('');
  lines.push('## Hash Checks');
  lines.push('');
  lines.push('| Path | Matches | SHA-256 |');
  lines.push('| --- | --- | --- |');
  for (const check of report.hashChecks) {
    lines.push(
      `| \`${check.path}\` | \`${check.matches ? 'yes' : 'no'}\` | \`${check.actualSha256}\` |`,
    );
  }
  lines.push('');
  lines.push(
    'Interpretation: this report is the outside-rerun summary for the checked Chapter 17 evidence bundle only. It executes the Gnosis and Chapter 17 artifact/witness/manuscript reproduction surface, does not rebuild the TeX/PDF layer, and then independently recomputes the replication-pack hashes to verify that the checked-in evidence bundle still matches the files on disk.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}
