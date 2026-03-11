/**
 * Evidence Traceability — Companion checks for §6.12 evidence constants.
 *
 * Ensures empirical constants used in evidence-table tests are explicitly
 * tagged with citation IDs and provenance metadata.
 */

import { describe, expect, it } from 'vitest';

import { EVIDENCE_DATA } from './evidence-sources.js';

describe('Evidence Traceability (§6.12)', () => {
  it('all evidence constants declare citations and provenance', () => {
    for (const datum of Object.values(EVIDENCE_DATA)) {
      expect(datum.id.length).toBeGreaterThan(0);
      expect(Number.isFinite(datum.value)).toBe(true);
      expect(datum.unit.length).toBeGreaterThan(0);
      expect(datum.citationIds.length).toBeGreaterThan(0);
      expect(datum.provenance === 'literature' || datum.provenance === 'simulation').toBe(true);
      expect(datum.note.length).toBeGreaterThan(0);
    }
  });

  it('key manuscript-scale constants remain in expected ranges', () => {
    expect(EVIDENCE_DATA.rareDiseaseDelayYears.value).toBeCloseTo(4.8, 3);
    expect(EVIDENCE_DATA.settlementDailyVolumeUsd.value).toBeGreaterThan(1e12);
    expect(EVIDENCE_DATA.photosyntheticEfficiencyFloor.value).toBeGreaterThan(0.9);
  });
});

