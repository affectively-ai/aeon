import Mathlib
import ForkRaceFoldTheorems.QueueStability

open Filter MeasureTheory ProbabilityTheory
open scoped BigOperators ENNReal Topology

namespace ForkRaceFoldTheorems

theorem mm1_stationary_lintegral_queue_length
    {ρ : ℝ}
    (hρ_nonneg : 0 ≤ ρ)
    (hρ_lt_one : ρ < 1) :
    ∫⁻ n : ℕ, (n : ℝ≥0∞) ∂ (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure =
      ENNReal.ofReal (ρ / (1 - ρ)) := by
  have hNorm : ‖ρ‖ < 1 := by
    rwa [Real.norm_of_nonneg hρ_nonneg]
  have hSummable : Summable (fun n : ℕ => (n : ℝ) * ρ ^ n) := by
    simpa [pow_one] using
      (summable_pow_mul_geometric_of_norm_lt_one 1 hNorm : Summable (fun n : ℕ => (n : ℝ) ^ 1 * ρ ^ n))
  have hWeightedSummable :
      Summable (fun n : ℕ => (n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal) := by
    simpa [mm1StationaryPMF_toReal hρ_nonneg hρ_lt_one, mul_assoc] using
      hSummable.mul_right (1 - ρ)
  have hWeightedNonneg :
      ∀ n : ℕ, 0 ≤ (n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal := by
    intro n
    rw [mm1StationaryPMF_toReal hρ_nonneg hρ_lt_one n]
    have hOneMinusRhoNonneg : 0 ≤ 1 - ρ := by
      linarith
    exact mul_nonneg (Nat.cast_nonneg n) (mul_nonneg (pow_nonneg hρ_nonneg _) hOneMinusRhoNonneg)
  rw [MeasureTheory.lintegral_countable']
  calc
    (∑' n : ℕ, (n : ℝ≥0∞) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure {n})
      = ∑' n : ℕ, ENNReal.ofReal ((n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal) := by
          apply tsum_congr
          intro n
          calc
            (n : ℝ≥0∞) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure {n}
              = ENNReal.ofReal (n : ℝ) *
                  ENNReal.ofReal ((mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal) := by
                    simp [PMF.toMeasure_apply_singleton, ENNReal.ofReal_natCast,
                      ENNReal.ofReal_toReal ((mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).apply_ne_top n)]
            _ = ENNReal.ofReal ((n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal) := by
                    rw [ENNReal.ofReal_mul (show 0 ≤ (n : ℝ) by positivity)]
    _ = ENNReal.ofReal (∑' n : ℕ, (n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal) := by
          symm
          exact ENNReal.ofReal_tsum_of_nonneg hWeightedNonneg hWeightedSummable
    _ = ENNReal.ofReal (ρ / (1 - ρ)) := by
          rw [mm1_stationary_mean_queue_length hρ_nonneg hρ_lt_one]

theorem mm1_stationary_integrable_queue_length
    {ρ : ℝ}
    (hρ_nonneg : 0 ≤ ρ)
    (hρ_lt_one : ρ < 1) :
    Integrable (fun n : ℕ => (n : ℝ)) (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure := by
  simpa using
    (integrable_toReal_of_lintegral_ne_top
      (measurable_of_countable (fun n : ℕ => (n : ℝ≥0∞))).aemeasurable
      (by
        rw [mm1_stationary_lintegral_queue_length hρ_nonneg hρ_lt_one]
        exact ENNReal.ofReal_ne_top))

theorem mm1_stationary_integral_queue_length
    {ρ : ℝ}
    (hρ_nonneg : 0 ≤ ρ)
    (hρ_lt_one : ρ < 1) :
    ∫ n : ℕ, (n : ℝ) ∂ (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure = ρ / (1 - ρ) := by
  have hIntegrable :
      Integrable (fun n : ℕ => (n : ℝ)) (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure :=
    mm1_stationary_integrable_queue_length hρ_nonneg hρ_lt_one
  have hNonneg :
      0 ≤ᵐ[(mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure] fun n : ℕ => (n : ℝ) :=
    Filter.Eventually.of_forall fun n => Nat.cast_nonneg n
  have hRatioNonneg : 0 ≤ ρ / (1 - ρ) := by
    have hOneMinusPos : 0 < 1 - ρ := by
      linarith
    positivity
  rw [← ENNReal.ofReal_eq_ofReal_iff (integral_nonneg fun n : ℕ => Nat.cast_nonneg n) hRatioNonneg]
  rw [MeasureTheory.ofReal_integral_eq_lintegral_ofReal hIntegrable hNonneg]
  simpa using mm1_stationary_lintegral_queue_length hρ_nonneg hρ_lt_one

section JacksonProduct

variable {ι : Type*} [Fintype ι]

/-- Finite open-network product-form occupancy law with independent stable `M/M/1` marginals. -/
noncomputable def jacksonProductMeasure
    (ρ : ι → ℝ)
    (hρ_nonneg : ∀ i, 0 ≤ ρ i)
    (hρ_lt_one : ∀ i, ρ i < 1) :
    ProbabilityMeasure (ι → ℕ) :=
  ProbabilityMeasure.pi fun i =>
    ⟨(mm1StationaryPMF (ρ i) (hρ_nonneg i) (hρ_lt_one i)).toMeasure, inferInstance⟩

theorem jacksonProductMeasure_apply_singleton
    {ρ : ι → ℝ}
    (hρ_nonneg : ∀ i, 0 ≤ ρ i)
    (hρ_lt_one : ∀ i, ρ i < 1)
    (state : ι → ℕ) :
    jacksonProductMeasure ρ hρ_nonneg hρ_lt_one {state} =
      ∏ i, ENNReal.ofReal ((ρ i) ^ (state i) * (1 - ρ i)) := by
  change (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure {state} =
    ∏ i, ENNReal.ofReal ((ρ i) ^ (state i) * (1 - ρ i))
  simpa [jacksonProductMeasure, mm1StationaryPMF_apply] using
    (Measure.pi_singleton
      (μ := fun i =>
        (((⟨(mm1StationaryPMF (ρ i) (hρ_nonneg i) (hρ_lt_one i)).toMeasure, inferInstance⟩ :
          ProbabilityMeasure ℕ) : Measure ℕ)))
      state)

theorem jackson_product_mean_total_occupancy
    {ρ : ι → ℝ}
    (hρ_nonneg : ∀ i, 0 ≤ ρ i)
    (hρ_lt_one : ∀ i, ρ i < 1) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure =
      ∑ i, ρ i / (1 - ρ i) := by
  rw [show (∑ i, ρ i / (1 - ρ i)) = ∑ i ∈ Finset.univ, ρ i / (1 - ρ i) by simp]
  rw [show (∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure) =
      ∫ state : ι → ℕ, ∑ i ∈ Finset.univ, (state i : ℝ) ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure by
        simp]
  rw [integral_finset_sum Finset.univ]
  · apply Finset.sum_congr rfl
    intro i hi
    calc
      ∫ state : ι → ℕ, (state i : ℝ) ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure
        = ∫ n : ℕ, (n : ℝ) ∂ (mm1StationaryPMF (ρ i) (hρ_nonneg i) (hρ_lt_one i)).toMeasure := by
            simpa [jacksonProductMeasure] using
              (MeasureTheory.integral_comp_eval
                (μ := fun j => (mm1StationaryPMF (ρ j) (hρ_nonneg j) (hρ_lt_one j)).toMeasure)
                (i := i)
                (f := fun n : ℕ => (n : ℝ))
                (mm1_stationary_integrable_queue_length (hρ_nonneg i) (hρ_lt_one i)).aestronglyMeasurable)
      _ = ρ i / (1 - ρ i) := mm1_stationary_integral_queue_length (hρ_nonneg i) (hρ_lt_one i)
  · intro i hi
    simpa [jacksonProductMeasure] using
      (MeasureTheory.integrable_comp_eval
        (μ := fun j => (mm1StationaryPMF (ρ j) (hρ_nonneg j) (hρ_lt_one j)).toMeasure)
        (i := i)
        (f := fun n : ℕ => (n : ℝ))
        (mm1_stationary_integrable_queue_length (hρ_nonneg i) (hρ_lt_one i)))

theorem jackson_product_lintegral_balance
    {ρ : ι → ℝ}
    (hρ_nonneg : ∀ i, 0 ≤ ρ i)
    (hρ_lt_one : ∀ i, ρ i < 1)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure =
      ∫⁻ state, law.sojournTime state ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure +
        ∫⁻ state, law.openAge state ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure := by
  exact measure_queue_lintegral_balance (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure law

end JacksonProduct

end ForkRaceFoldTheorems
