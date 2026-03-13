import { describe, expect, it } from 'vitest';

import {
  loadCheckedInFormalWitnessCatalog,
  renderFormalWitnessCatalogMarkdown,
} from './formal-witness-catalog';

describe('Formal witness catalog', () => {
  it('loads the Lean-emitted witness descriptors used by the runtime boundary tests', () => {
    const report = loadCheckedInFormalWitnessCatalog();

    expect(report.label).toBe('formal-fold-boundary-witness-catalog-v1');
    expect(report.witnesses).toHaveLength(7);
    expect(report.witnesses.some((witness) => witness.id === 'winner-partition-counterexample')).toBe(
      true,
    );
    expect(report.witnesses.some((witness) => witness.theoremRef.includes('Claims.early_stop_not_order_invariant'))).toBe(
      true,
    );
  });

  it('renders a markdown manifest for the witness catalog', () => {
    const markdown = renderFormalWitnessCatalogMarkdown(loadCheckedInFormalWitnessCatalog());

    expect(markdown).toContain('# Formal Witness Catalog');
    expect(markdown).toContain('winner-partition-counterexample');
    expect(markdown).toContain('Claims.winner_selection_not_partition_additive');
  });
});
