import ForkRaceFoldTheorems.JacksonQueueing

open MeasureTheory

namespace ForkRaceFoldTheorems

/--
Constructive one-path boundary witness for the canonical stable `M/M/1` queue.
`beta1 = 0` records the absence of parallel path width; the remaining fields use the
classical arrival/service notation to package the boundary quantities cited in the manuscript.
-/
structure QueueBoundaryWitness where
  beta1 : Nat
  arrivalRate : ℝ
  serviceRate : ℝ
  occupancy : ℝ
  residenceTime : ℝ

def QueueBoundaryWitness.capacity (boundary : QueueBoundaryWitness) : Nat :=
  boundary.beta1 + 1

/--
Canonical stable one-path witness for a queue with arrival rate `λ` and service rate `μ`.
The occupancy/residence fields are the familiar `M/M/1` closed forms.
-/
noncomputable def canonicalMM1Boundary
    (lam mu : ℝ)
    (_hlam_nonneg : 0 ≤ lam)
    (_hmu_pos : 0 < mu)
    (_hlam_lt_mu : lam < mu) : QueueBoundaryWitness where
  beta1 := 0
  arrivalRate := lam
  serviceRate := mu
  occupancy := lam / (mu - lam)
  residenceTime := 1 / (mu - lam)

theorem canonicalMM1Boundary_beta1_zero
    (lam mu : ℝ)
    (hlam_nonneg : 0 ≤ lam)
    (hmu_pos : 0 < mu)
    (hlam_lt_mu : lam < mu) :
    (canonicalMM1Boundary lam mu hlam_nonneg hmu_pos hlam_lt_mu).beta1 = 0 :=
  rfl

theorem canonicalMM1Boundary_capacity_eq_one
    (lam mu : ℝ)
    (hlam_nonneg : 0 ≤ lam)
    (hmu_pos : 0 < mu)
    (hlam_lt_mu : lam < mu) :
    (canonicalMM1Boundary lam mu hlam_nonneg hmu_pos hlam_lt_mu).capacity = 1 := by
  simp [QueueBoundaryWitness.capacity, canonicalMM1Boundary]

theorem canonicalMM1Boundary_little_law
    (lam mu : ℝ)
    (hlam_nonneg : 0 ≤ lam)
    (hmu_pos : 0 < mu)
    (hlam_lt_mu : lam < mu) :
    (canonicalMM1Boundary lam mu hlam_nonneg hmu_pos hlam_lt_mu).occupancy =
      (canonicalMM1Boundary lam mu hlam_nonneg hmu_pos hlam_lt_mu).arrivalRate *
        (canonicalMM1Boundary lam mu hlam_nonneg hmu_pos hlam_lt_mu).residenceTime := by
  have hDiffPos : 0 < mu - lam := by
    linarith
  have hDiffNe : mu - lam ≠ 0 := ne_of_gt hDiffPos
  simp [canonicalMM1Boundary]
  field_simp [hDiffNe]

theorem canonicalMM1Boundary_stationary_mean_queue_length
    (lam mu : ℝ)
    (hlam_nonneg : 0 ≤ lam)
    (hmu_pos : 0 < mu)
    (hlam_lt_mu : lam < mu) :
    ∫ n : ℕ, (n : ℝ) ∂
        (mm1StationaryPMF (lam / mu)
          (show 0 ≤ lam / mu by positivity)
          (show lam / mu < 1 by
            exact (div_lt_one hmu_pos).2 hlam_lt_mu)).toMeasure =
      (canonicalMM1Boundary lam mu hlam_nonneg hmu_pos hlam_lt_mu).occupancy := by
  have hρ_nonneg : 0 ≤ lam / mu := by
    positivity
  have hρ_lt_one : lam / mu < 1 := by
    exact (div_lt_one hmu_pos).2 hlam_lt_mu
  have hmu_ne : mu ≠ 0 := ne_of_gt hmu_pos
  have hDiffPos : 0 < mu - lam := by
    linarith
  have hDiffNe : mu - lam ≠ 0 := ne_of_gt hDiffPos
  rw [mm1_stationary_integral_queue_length hρ_nonneg hρ_lt_one]
  simp [canonicalMM1Boundary]
  field_simp [hmu_ne, hDiffNe]

theorem exists_canonicalMM1_beta1_zero_boundary
    (lam mu : ℝ)
    (hlam_nonneg : 0 ≤ lam)
    (hmu_pos : 0 < mu)
    (hlam_lt_mu : lam < mu) :
    ∃ boundary : QueueBoundaryWitness,
      boundary.beta1 = 0 ∧
      boundary.capacity = 1 ∧
      boundary.occupancy = boundary.arrivalRate * boundary.residenceTime := by
  refine ⟨canonicalMM1Boundary lam mu hlam_nonneg hmu_pos hlam_lt_mu, ?_⟩
  constructor
  · exact canonicalMM1Boundary_beta1_zero lam mu hlam_nonneg hmu_pos hlam_lt_mu
  constructor
  · exact canonicalMM1Boundary_capacity_eq_one lam mu hlam_nonneg hmu_pos hlam_lt_mu
  · exact canonicalMM1Boundary_little_law lam mu hlam_nonneg hmu_pos hlam_lt_mu

end ForkRaceFoldTheorems
