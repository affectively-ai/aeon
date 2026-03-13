import Mathlib
import ForkRaceFoldTheorems.MeasureQueueing

open Filter MeasureTheory ProbabilityTheory
open scoped ENNReal Topology

namespace ForkRaceFoldTheorems

/-- Stable M/M/1 stationary occupancy law with load `ρ ∈ [0, 1)`. -/
noncomputable def mm1StationaryPMF (ρ : ℝ) (hρ_nonneg : 0 ≤ ρ) (hρ_lt_one : ρ < 1) : PMF ℕ :=
  ProbabilityTheory.geometricPMF (p := 1 - ρ) (sub_pos.mpr hρ_lt_one) (by linarith)

theorem mm1StationaryPMF_apply
    {ρ : ℝ}
    (hρ_nonneg : 0 ≤ ρ)
    (hρ_lt_one : ρ < 1)
    (n : ℕ) :
    mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n = ENNReal.ofReal (ρ ^ n * (1 - ρ)) := by
  have hSub : 1 - (1 - ρ) = ρ := by ring
  change ENNReal.ofReal ((1 - (1 - ρ)) ^ n * (1 - ρ)) = ENNReal.ofReal (ρ ^ n * (1 - ρ))
  rw [hSub]

theorem mm1StationaryPMF_toReal
    {ρ : ℝ}
    (hρ_nonneg : 0 ≤ ρ)
    (hρ_lt_one : ρ < 1)
    (n : ℕ) :
    (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal = ρ ^ n * (1 - ρ) := by
  rw [mm1StationaryPMF_apply hρ_nonneg hρ_lt_one n]
  have hOneMinusRhoNonneg : 0 ≤ 1 - ρ := by
    linarith
  have hMassNonneg : 0 ≤ ρ ^ n * (1 - ρ) := by
    exact mul_nonneg (pow_nonneg hρ_nonneg _) hOneMinusRhoNonneg
  simp [hMassNonneg]

theorem mm1_stationary_mean_queue_length
    {ρ : ℝ}
    (hρ_nonneg : 0 ≤ ρ)
    (hρ_lt_one : ρ < 1) :
    (∑' n : ℕ, (n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal) = ρ / (1 - ρ) := by
  have hNorm : ‖ρ‖ < 1 := by
    rwa [Real.norm_of_nonneg hρ_nonneg]
  have hSummable : Summable (fun n : ℕ => (n : ℝ) * ρ ^ n) := by
    simpa [pow_one] using
      (summable_pow_mul_geometric_of_norm_lt_one 1 hNorm : Summable (fun n : ℕ => (n : ℝ) ^ 1 * ρ ^ n))
  calc
    (∑' n : ℕ, (n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal)
      = ∑' n : ℕ, ((n : ℝ) * ρ ^ n) * (1 - ρ) := by
          apply tsum_congr
          intro n
          rw [mm1StationaryPMF_toReal hρ_nonneg hρ_lt_one n]
          ring
    _ = (∑' n : ℕ, (n : ℝ) * ρ ^ n) * (1 - ρ) := by
          simpa [mul_assoc] using hSummable.tsum_mul_right (1 - ρ)
    _ = (ρ / (1 - ρ) ^ 2) * (1 - ρ) := by
          rw [tsum_coe_mul_geometric_of_norm_lt_one hNorm]
    _ = ρ / (1 - ρ) := by
          field_simp [sub_ne_zero.mpr (ne_of_lt hρ_lt_one)]

theorem mm1_stationary_lintegral_balance
    {ρ : ℝ}
    (hρ_nonneg : 0 ≤ ρ)
    (hρ_lt_one : ρ < 1)
    (law : MeasureQueueLaw ℕ) :
    ∫⁻ n, law.customerTime n ∂ (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure =
      ∫⁻ n, law.sojournTime n ∂ (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure +
        ∫⁻ n, law.openAge n ∂ (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure := by
  exact pmf_queue_lintegral_balance (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one) law

/-
The linear-reneging stationary-weight development was an unused duplicate of the
active reneging-family machinery in `StateDependentQueueFamilies.lean`. Keeping
the partial copy here made the queue-stability gate brittle under current
mathlib/Lean, so the live formal surface keeps the constructive occupancy and
Cesaro witnesses here and leaves reneging mechanics to the dedicated file.
-/

structure OpenNetworkCesaroWitness where
  customerArea : ℕ → ℝ
  departedSojourn : ℕ → ℝ
  openAge : ℕ → ℝ
  customerLimit : ℝ
  sojournLimit : ℝ
  openAgeLimit : ℝ
  samplePathBalance : ∀ n, customerArea n = departedSojourn n + openAge n
  customerCesaroConverges :
    Tendsto (fun n => customerArea n / (n + 1 : ℝ)) atTop (nhds customerLimit)
  sojournCesaroConverges :
    Tendsto (fun n => departedSojourn n / (n + 1 : ℝ)) atTop (nhds sojournLimit)
  openAgeCesaroConverges :
    Tendsto (fun n => openAge n / (n + 1 : ℝ)) atTop (nhds openAgeLimit)

theorem open_network_cesaro_balance
    (witness : OpenNetworkCesaroWitness) :
    witness.customerLimit = witness.sojournLimit + witness.openAgeLimit := by
  have hEventually :
      (fun n => witness.customerArea n / (n + 1 : ℝ)) =ᶠ[atTop]
        fun n => witness.departedSojourn n / (n + 1 : ℝ) + witness.openAge n / (n + 1 : ℝ) := by
    filter_upwards with n
    rw [witness.samplePathBalance n, add_div]
  have hBalanced :
      Tendsto (fun n => witness.customerArea n / (n + 1 : ℝ)) atTop
        (nhds (witness.sojournLimit + witness.openAgeLimit)) := by
    exact (witness.sojournCesaroConverges.add witness.openAgeCesaroConverges).congr' hEventually.symm
  exact tendsto_nhds_unique witness.customerCesaroConverges hBalanced

theorem open_network_terminal_cesaro_balance
    (witness : OpenNetworkCesaroWitness)
    (hOpenAgeLimitZero : witness.openAgeLimit = 0) :
    witness.customerLimit = witness.sojournLimit := by
  rw [open_network_cesaro_balance witness, hOpenAgeLimitZero, add_zero]

end ForkRaceFoldTheorems
