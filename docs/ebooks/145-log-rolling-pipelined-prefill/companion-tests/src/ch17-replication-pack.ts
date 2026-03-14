import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ReplicationPackCategory =
  | 'artifact'
  | 'document'
  | 'formal'
  | 'script'
  | 'topology'
  | 'workflow';

export interface ReplicationPackEntry {
  readonly label: string;
  readonly category: ReplicationPackCategory;
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface Ch17ReplicationPackReport {
  readonly label: 'ch17-replication-pack-v1';
  readonly rootCommand: string;
  readonly entries: readonly ReplicationPackEntry[];
  readonly entryCount: number;
  readonly artifactCount: number;
  readonly complete: boolean;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

const replicationPaths = [
  ['Manuscript draft', 'document', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/ch17-arxiv-manuscript.md'],
  ['Companion README', 'document', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/README.md'],
  ['Evidence workflow', 'workflow', '.github/workflows/ch17-evidence.yml'],
  ['Quantum ablation artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/quantum-recombination-ablation.json'],
  ['Toy attention artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/toy-attention-fold-ablation.json'],
  ['Gnosis fold artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-fold-training-benchmark.json'],
  ['Gnosis negative-controls artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-negative-controls.json'],
  ['Gnosis near-control artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-near-control-sweep.json'],
  ['Gnosis regime-sweep artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-fold-boundary-regime-sweep.json'],
  ['Gnosis adversarial-controls artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-adversarial-controls-benchmark.json'],
  ['Gnosis mini-MoE artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-moe-routing-benchmark.json'],
  ['Gnosis MoA evidence artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-moa-transformer-evidence-benchmark.json'],
  ['Formal witness artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/formal-witness-catalog.json'],
  ['Formal adaptive witness artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/formal-adaptive-witness-catalog.json'],
  ['Adaptive supremum witness artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/adaptive-supremum-witness.json'],
  ['Adaptive supremum family-sweep artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/adaptive-supremum-family-sweep.json'],
  ['Figure artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/ch17-correspondence-boundary-figure.svg'],
  ['Expansion figure artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/ch17-boundary-expansion-figure.svg'],
  ['MoA figure artifact', 'artifact', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/ch17-moa-transformer-figure.svg'],
  ['Replication-pack script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/ch17-replication-pack.ts'],
  ['Negative-controls script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-negative-controls-benchmark.ts'],
  ['Near-control script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-near-control-sweep-benchmark.ts'],
  ['Regime-sweep script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-regime-sweep-benchmark.ts'],
  ['Adversarial-controls script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-adversarial-controls-benchmark.ts'],
  ['MoA evidence script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-moa-transformer-evidence-benchmark.ts'],
  ['Formal witness script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/formal-witness-catalog.ts'],
  ['Formal adaptive witness script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/formal-adaptive-witness-catalog.ts'],
  ['Adaptive supremum witness script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/adaptive-supremum-witness.ts'],
  ['Adaptive supremum family-sweep script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/adaptive-supremum-family-sweep.ts'],
  ['Expansion figure script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/ch17-boundary-expansion-figure.ts'],
  ['MoA figure script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/ch17-moa-transformer-figure.ts'],
  ['External replication script', 'script', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/ch17-external-replication.ts'],
  ['Lean claims', 'formal', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Claims.lean'],
  ['Lean witness catalog', 'formal', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Witnesses.lean'],
  ['Lean adaptive witness catalog', 'formal', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/AdaptiveWitnesses.lean'],
  ['Theorem ledger', 'formal', 'open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/THEOREM_LEDGER.md'],
  ['Affine benchmark topology suite', 'topology', 'open-source/gnosis/examples/benchmarks/fold-training.test.gg'],
  ['Routed benchmark topology suite', 'topology', 'open-source/gnosis/examples/benchmarks/moe-routing.test.gg'],
  ['MoA benchmark topology suite', 'topology', 'open-source/gnosis/examples/benchmarks/moa-transformer.test.gg'],
  ['StructuredMoA sparse topology', 'topology', 'open-source/gnosis/examples/benchmarks/moa-transformer-moa.gg'],
] as const satisfies readonly [string, ReplicationPackCategory, string][];

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function runCh17ReplicationPack(): Ch17ReplicationPackReport {
  const entries = replicationPaths.map(([label, category, relativePath]) => {
    const absolutePath = resolve(repoRoot, relativePath);
    const stats = statSync(absolutePath);
    return {
      label,
      category,
      path: relativePath,
      sizeBytes: stats.size,
      sha256: hashFile(absolutePath),
    } satisfies ReplicationPackEntry;
  });

  return {
    label: 'ch17-replication-pack-v1',
    rootCommand:
      'cd open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests && bun run test:ch17-external-replication',
    entries,
    entryCount: entries.length,
    artifactCount: entries.filter((entry) => entry.category === 'artifact').length,
    complete: entries.every((entry) => entry.sha256.length === 64 && entry.sizeBytes > 0),
  };
}

export function renderCh17ReplicationPackMarkdown(
  report: Ch17ReplicationPackReport,
): string {
  const lines: string[] = [];
  lines.push('# Chapter 17 Replication Pack');
  lines.push('');
  lines.push('- Label: `' + report.label + '`');
  lines.push('- Root command: `' + report.rootCommand + '`');
  lines.push('- Entries: `' + String(report.entryCount) + '`');
  lines.push('- Artifact entries: `' + String(report.artifactCount) + '`');
  lines.push('- Complete: `' + (report.complete ? 'yes' : 'no') + '`');
  lines.push('');
  lines.push('| Label | Category | Path | Bytes | SHA-256 |');
  lines.push('| --- | --- | --- | ---: | --- |');
  for (const entry of report.entries) {
    lines.push(
      `| ${entry.label} | \`${entry.category}\` | \`${entry.path}\` | ${entry.sizeBytes} | \`${entry.sha256}\` |`,
    );
  }
  lines.push('');
  lines.push(
    'Interpretation: this pack fingerprints the concrete files needed to reproduce the current Chapter 17 evidence surface, including the generated artifacts, the formal theorem package, the benchmark topology suites, and the CI entrypoint.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}
