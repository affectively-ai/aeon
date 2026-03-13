import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface FormalAdaptiveWitnessDescriptor {
  readonly id: string;
  readonly theoremRef: string;
  readonly ceilingTheoremRef: string;
  readonly driftTheoremRef: string;
  readonly stationaryBalanceRef: string;
  readonly terminalBalanceRef: string;
  readonly maxLeftQueue: number;
  readonly maxRightQueue: number;
  readonly arrivalLeft: string;
  readonly arrivalRight: string;
  readonly rerouteProbability: string;
  readonly serviceLeft: string;
  readonly serviceRight: string;
  readonly alphaLeft: string;
  readonly alphaRight: string;
  readonly driftGap: string;
  readonly spectralRadius: string;
  readonly stateCount: number;
  readonly smallSetCount: number;
  readonly note: string;
}

export interface FormalAdaptiveWitnessCatalogReport {
  readonly label: 'formal-adaptive-supremum-witness-catalog-v1';
  readonly witnesses: readonly FormalAdaptiveWitnessDescriptor[];
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultArtifactPath = resolve(moduleDir, '../artifacts/formal-adaptive-witness-catalog.json');

export function loadCheckedInFormalAdaptiveWitnessCatalog(
  artifactPath = defaultArtifactPath,
): FormalAdaptiveWitnessCatalogReport {
  return JSON.parse(readFileSync(artifactPath, 'utf8')) as FormalAdaptiveWitnessCatalogReport;
}

export function parseRationalLiteral(literal: string): number {
  const [numeratorPart, denominatorPart] = literal.split('/');
  const numerator = Number(numeratorPart);
  if (Number.isNaN(numerator)) {
    throw new Error(`Invalid rational literal numerator: ${literal}`);
  }
  if (denominatorPart === undefined) {
    return numerator;
  }
  const denominator = Number(denominatorPart);
  if (Number.isNaN(denominator) || denominator === 0) {
    throw new Error(`Invalid rational literal denominator: ${literal}`);
  }
  return numerator / denominator;
}

export function renderFormalAdaptiveWitnessCatalogMarkdown(
  report: FormalAdaptiveWitnessCatalogReport,
): string {
  const lines: string[] = [];
  lines.push('# Formal Adaptive Witness Catalog');
  lines.push('');
  lines.push(`- Label: \`${report.label}\``);
  lines.push(`- Witness count: \`${report.witnesses.length}\``);
  lines.push('');
  lines.push('| Witness | Alpha | Drift gap | Spectral radius | Bounded states | Theorem |');
  lines.push('| --- | --- | --- | --- | ---: | --- |');
  for (const witness of report.witnesses) {
    lines.push(
      `| \`${witness.id}\` | \`(${witness.alphaLeft}, ${witness.alphaRight})\` | \`${witness.driftGap}\` | \`${witness.spectralRadius}\` | ${witness.stateCount} | \`${witness.theoremRef}\` |`,
    );
  }
  lines.push('');
  lines.push(
    'Interpretation: this catalog is emitted from the Lean theorem package and pins the concrete adaptive rerouting alpha witness that the runtime adaptive-supremum artifact must match.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}
