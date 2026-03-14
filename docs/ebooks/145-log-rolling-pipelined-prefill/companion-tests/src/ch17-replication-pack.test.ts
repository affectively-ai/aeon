import { describe, expect, it } from 'vitest';

import {
  renderCh17ReplicationPackMarkdown,
  runCh17ReplicationPack,
} from './ch17-replication-pack';

describe('Chapter 17 replication pack', () => {
  it('fingerprints the evidence bundle needed for outside reruns', () => {
    const report = runCh17ReplicationPack();

    expect(report.label).toBe('ch17-replication-pack-v1');
    expect(report.complete).toBe(true);
    expect(report.entryCount).toBeGreaterThanOrEqual(12);
    expect(report.artifactCount).toBeGreaterThanOrEqual(6);
    expect(
      report.entries.some((entry) =>
        entry.path.endsWith('gnosis-negative-controls.json')
      )
    ).toBe(true);
    expect(
      report.entries.some((entry) =>
        entry.path.endsWith('gnosis-near-control-sweep.json')
      )
    ).toBe(true);
    expect(
      report.entries.some((entry) =>
        entry.path.endsWith('gnosis-moa-transformer-evidence-benchmark.json')
      )
    ).toBe(true);
    expect(
      report.entries.some((entry) =>
        entry.path.endsWith('ch17-moa-transformer-figure.svg')
      )
    ).toBe(true);
    for (const entry of report.entries) {
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('renders a markdown manifest for the replication bundle', () => {
    const markdown = renderCh17ReplicationPackMarkdown(
      runCh17ReplicationPack()
    );

    expect(markdown).toContain('# Chapter 17 Replication Pack');
    expect(markdown).toContain('Root command');
    expect(markdown).toContain('gnosis-negative-controls.json');
    expect(markdown).toContain('gnosis-near-control-sweep.json');
    expect(markdown).toContain(
      'gnosis-moa-transformer-evidence-benchmark.json'
    );
    expect(markdown).toContain('ch17-moa-transformer-figure.svg');
    expect(markdown).toContain('SHA-256');
  });
});
