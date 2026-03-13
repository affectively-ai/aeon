import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface FormalWitnessDescriptor {
  readonly id: string;
  readonly theoremRef: string;
  readonly kind: 'cancellation' | 'partition' | 'order';
  readonly fold: string;
  readonly inputs: readonly number[];
  readonly observed: number;
  readonly alternate: number | null;
  readonly note: string;
}

export interface FormalWitnessCatalogReport {
  readonly label: 'formal-fold-boundary-witness-catalog-v1';
  readonly witnesses: readonly FormalWitnessDescriptor[];
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultArtifactPath = resolve(moduleDir, '../artifacts/formal-witness-catalog.json');

export function loadCheckedInFormalWitnessCatalog(
  artifactPath = defaultArtifactPath,
): FormalWitnessCatalogReport {
  return JSON.parse(readFileSync(artifactPath, 'utf8')) as FormalWitnessCatalogReport;
}

export function renderFormalWitnessCatalogMarkdown(
  report: FormalWitnessCatalogReport,
): string {
  const lines: string[] = [];
  lines.push('# Formal Witness Catalog');
  lines.push('');
  lines.push(`- Label: \`${report.label}\``);
  lines.push(`- Witness count: \`${report.witnesses.length}\``);
  lines.push('');
  lines.push('| Witness | Kind | Fold | Inputs | Observed | Alternate | Theorem |');
  lines.push('| --- | --- | --- | --- | ---: | ---: | --- |');
  for (const witness of report.witnesses) {
    lines.push(
      `| \`${witness.id}\` | \`${witness.kind}\` | \`${witness.fold}\` | \`${witness.inputs.join(', ')}\` | ${witness.observed} | ${witness.alternate ?? 'null'} | \`${witness.theoremRef}\` |`,
    );
  }
  lines.push('');
  lines.push(
    'Interpretation: these witnesses are emitted directly from the Lean theorem package and consumed by the runtime boundary tests, so the formal layer now supplies concrete executable counterexamples instead of merely describing them.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}
