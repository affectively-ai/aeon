export interface EvidenceDatum {
  readonly id: string;
  readonly value: number;
  readonly unit: string;
  readonly citationIds: readonly number[];
  readonly provenance: 'literature' | 'simulation';
  readonly evidenceType: 'primary-measurement' | 'derived-scenario';
  readonly calibrationRange?: {
    readonly min: number;
    readonly max: number;
  };
  readonly note: string;
}

export const EVIDENCE_DATA = {
  rareDiseaseDelayYears: {
    id: 'rare_disease_delay_years',
    value: 4.7,
    unit: 'years',
    citationIds: [29],
    provenance: 'literature',
    evidenceType: 'primary-measurement',
    calibrationRange: { min: 4.0, max: 6.0 },
    note: 'Average total diagnosis time used in §6.12 evidence table (Netherlands 2013 vs 2023 comparison).',
  },
  settlementDailyVolumeUsd: {
    id: 'settlement_daily_volume_usd_core',
    value: 2.219e12,
    unit: 'USD/day',
    citationIds: [30],
    provenance: 'literature',
    evidenceType: 'primary-measurement',
    calibrationRange: { min: 2.0e12, max: 2.5e12 },
    note: 'Core daily NSCC average value baseline used for conservative T+2 lockup estimates.',
  },
  settlementDailyVolumeBroadScopeUsd: {
    id: 'settlement_daily_volume_usd_broad_scope',
    value: 35e12,
    unit: 'USD/day',
    citationIds: [21],
    provenance: 'simulation',
    evidenceType: 'derived-scenario',
    calibrationRange: { min: 20e12, max: 50e12 },
    note: 'Broad-scope market-volume scenario used for upper-bound lockup sensitivity (maps to ~70T at T+2).',
  },
  photosyntheticEfficiencyFloor: {
    id: 'photosynthetic_efficiency_floor',
    value: 0.95,
    unit: 'ratio',
    citationIds: [6],
    provenance: 'literature',
    evidenceType: 'primary-measurement',
    calibrationRange: { min: 0.95, max: 0.99 },
    note: 'Lower-bound efficiency used in biological Δβ≈0 examples.',
  },
} as const satisfies Record<string, EvidenceDatum>;
