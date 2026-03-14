import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import {
  parseTlaModule,
  parseTlcConfig,
  renderTlaModule,
  runLeanSandbox,
  serializeTlcConfig,
} from '@affectively/aeon-logic';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formalDir = resolve(currentDir, '../formal');
const leanDir = resolve(formalDir, 'lean');

describe('Formal parser compatibility (aeon-logic)', () => {
  it('every .tla artifact round-trips through our parser', () => {
    const files = readdirSync(formalDir);
    const cfgBases = new Set(
      files
        .filter((entry) => extname(entry) === '.cfg')
        .map((entry) => basename(entry, '.cfg')),
    );
    const tlaFiles = files
      .filter((entry) => extname(entry) === '.tla')
      .filter((entry) => cfgBases.has(basename(entry, '.tla')))
      .sort();

    expect(tlaFiles.length).toBeGreaterThan(0);

    for (const tlaFile of tlaFiles) {
      const source = readFileSync(join(formalDir, tlaFile), 'utf8');
      const parsed = parseTlaModule(source);
      const rendered = renderTlaModule(parsed);
      const reparsed = parseTlaModule(rendered);

      expect(reparsed).toEqual(parsed);
      expect(parsed.moduleName).toBe(basename(tlaFile, '.tla'));
    }
  });

  it('every .cfg artifact round-trips through our parser', () => {
    const cfgFiles = readdirSync(formalDir)
      .filter((entry) => extname(entry) === '.cfg')
      .sort();

    expect(cfgFiles.length).toBeGreaterThan(0);

    for (const cfgFile of cfgFiles) {
      const source = readFileSync(join(formalDir, cfgFile), 'utf8');
      const parsed = parseTlcConfig(source);
      const rendered = serializeTlcConfig(parsed);
      const reparsed = parseTlcConfig(rendered);

      expect(reparsed).toEqual(parsed);
      expect(Boolean(parsed.specification || (parsed.init && parsed.next))).toBe(true);
    }
  });

  it('every formal module has a matching config file', () => {
    const files = readdirSync(formalDir);
    const modules = new Set(
      files
        .filter((entry) => extname(entry) === '.tla')
        .map((entry) => basename(entry, '.tla')),
    );
    const configs = new Set(
      files
        .filter((entry) => extname(entry) === '.cfg')
        .map((entry) => basename(entry, '.cfg')),
    );

    for (const configName of configs) {
      expect(modules.has(configName)).toBe(true);
    }
  });

  it('inspects the Lean theorem project through aeon-logic', () => {
    const result = runLeanSandbox({
      path: leanDir,
      build: false,
    });

    expect(result.report.mode).toBe('lean-sandbox');
    expect(result.report.project.lakefile).not.toBeNull();
    expect(result.report.project.toolchain).not.toBeNull();
    expect(result.report.project.moduleCount).toBeGreaterThan(0);
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.FailureComposition');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.FailureDurability');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.FailureEntropy');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.FailureFamilies');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.FailureTrilemma');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.FailureUniversality');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.InterferenceCoarsening');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.QuorumAsyncNetwork');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.QuorumConsistency');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.QuorumLinearizability');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.QuorumOrdering');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.QuorumVisibility');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.JacksonEnvelopeClosure');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.JacksonExactClosure');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.JacksonFeedForwardClosure');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.JacksonQueueing');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.JacksonRawClosure');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.AdaptiveWitnesses');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.QueueBoundary');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.MeasureQueueing');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.QueueStability');
    expect(result.report.project.moduleNames).toContain('ForkRaceFoldTheorems.StateDependentQueueFamilies');
    expect(result.report.build.attempted).toBe(false);
  });
});
