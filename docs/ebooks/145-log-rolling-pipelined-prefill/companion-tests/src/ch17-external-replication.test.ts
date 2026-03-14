import { describe, expect, it } from 'vitest';

import {
  renderCh17ExternalReplicationMarkdown,
  runCh17ExternalReplication,
} from './ch17-external-replication';

describe('Chapter 17 external replication', () => {
  it('verifies the current replication manifest without rerunning commands in unit-test mode', () => {
    const report = runCh17ExternalReplication({ executeCommands: false });

    expect(report.label).toBe('ch17-external-replication-v1');
    expect(report.steps).toHaveLength(13);
    expect(report.steps.every((step) => step.skipped)).toBe(true);
    expect(report.totalDurationMs).toBe(0);
    expect(report.slowestStepLabel).toBe('n/a');
    expect(report.slowestStepDurationMs).toBe(0);
    expect(report.manifestStable).toBe(true);
    expect(report.allHashesMatch).toBe(true);
  });

  it('renders a markdown rerun report', () => {
    const markdown = renderCh17ExternalReplicationMarkdown(
      runCh17ExternalReplication({ executeCommands: false })
    );

    expect(markdown).toContain('# Chapter 17 External Replication');
    expect(markdown).toContain('Approx runtime');
    expect(markdown).toContain('## Steps');
    expect(markdown).toContain('## Hash Checks');
  });
});
