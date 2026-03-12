/**
 * Evidence Traceability — Companion checks for §6.12 evidence constants.
 *
 * Ensures empirical constants used in evidence-table tests are explicitly
 * tagged with citation IDs, provenance metadata and calibration bounds.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EVIDENCE_DATA } from './evidence-sources.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANUSCRIPT_PATH = join(__dirname, '..', '..', 'ch17-arxiv-manuscript.md');

function parseReferenceIds(markdown: string): Set<number> {
  const ids = new Set<number>();
  for (const match of markdown.matchAll(/^\[(\d+)\]\s/mg)) {
    const numericId = Number(match[1]);
    if (Number.isInteger(numericId)) {
      ids.add(numericId);
    }
  }
  return ids;
}

describe('Evidence Traceability (§6.12)', () => {
  it('all evidence constants declare citations, provenance and calibration bounds', () => {
    for (const datum of Object.values(EVIDENCE_DATA)) {
      expect(datum.id.length).toBeGreaterThan(0);
      expect(Number.isFinite(datum.value)).toBe(true);
      expect(datum.unit.length).toBeGreaterThan(0);
      expect(datum.citationIds.length).toBeGreaterThan(0);
      expect(datum.provenance === 'literature' || datum.provenance === 'simulation').toBe(true);
      expect(
        datum.evidenceType === 'primary-measurement' ||
          datum.evidenceType === 'derived-scenario',
      ).toBe(true);
      expect(datum.calibrationRange).toBeDefined();
      if (datum.calibrationRange === undefined) {
        throw new Error(`${datum.id} must define a calibration range`);
      }
      expect(datum.calibrationRange.min).toBeLessThanOrEqual(datum.calibrationRange.max);
      expect(datum.value).toBeGreaterThanOrEqual(datum.calibrationRange.min);
      expect(datum.value).toBeLessThanOrEqual(datum.calibrationRange.max);
      expect(datum.note.length).toBeGreaterThan(0);
    }
  });

  it('evidence-type semantics are consistent', () => {
    for (const datum of Object.values(EVIDENCE_DATA)) {
      if (datum.evidenceType === 'primary-measurement') {
        expect(datum.provenance).toBe('literature');
      } else {
        expect(datum.provenance).toBe('simulation');
      }
    }
  });

  it('evidence citations resolve to manuscript references', () => {
    const manuscript = readFileSync(MANUSCRIPT_PATH, 'utf8');
    const referenceIds = parseReferenceIds(manuscript);
    for (const datum of Object.values(EVIDENCE_DATA)) {
      for (const citationId of datum.citationIds) {
        expect(referenceIds.has(citationId)).toBe(true);
      }
    }
  });

  it('key manuscript-scale constants remain in calibrated ranges', () => {
    expect(EVIDENCE_DATA.rareDiseaseDelayYears.value).toBeCloseTo(4.7, 3);
    expect(EVIDENCE_DATA.settlementDailyVolumeUsd.value).toBeGreaterThan(2e12);
    expect(EVIDENCE_DATA.settlementDailyVolumeBroadScopeUsd.value).toBeGreaterThan(
      EVIDENCE_DATA.settlementDailyVolumeUsd.value,
    );
    expect(EVIDENCE_DATA.photosyntheticEfficiencyFloor.value).toBeGreaterThanOrEqual(0.95);
  });
});
