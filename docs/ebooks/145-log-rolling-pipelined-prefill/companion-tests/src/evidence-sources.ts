export interface EvidenceDatum {
  readonly id: string;
  readonly value: number;
  readonly unit: string;
  readonly citationIds: readonly number[];
  readonly provenance: 'literature' | 'simulation';
  readonly note: string;
}

export const EVIDENCE_DATA = {
  rareDiseaseDelayYears: {
    id: 'rare_disease_delay_years',
    value: 4.8,
    unit: 'years',
    citationIds: [21],
    provenance: 'literature',
    note: 'Average diagnostic delay used in §6.12 evidence table.',
  },
  settlementDailyVolumeUsd: {
    id: 'settlement_daily_volume_usd',
    value: 35e12,
    unit: 'USD/day',
    citationIds: [21],
    provenance: 'literature',
    note: 'Daily notional volume used to derive T+2 locked capital scale.',
  },
  photosyntheticEfficiencyFloor: {
    id: 'photosynthetic_efficiency_floor',
    value: 0.95,
    unit: 'ratio',
    citationIds: [6],
    provenance: 'literature',
    note: 'Lower-bound efficiency used in biological Δβ≈0 examples.',
  },
} as const satisfies Record<string, EvidenceDatum>;

