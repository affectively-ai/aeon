import Mathlib
import ForkRaceFoldTheorems.FailureUniversality

open scoped BigOperators ENNReal

namespace ForkRaceFoldTheorems

/--
The Landauer bridge now spans finite, countable-support, observable-pushforward, and
effective-support layers. An equiprobable `n`-way live frontier carries `log₂ n` bits, every
finite branch law on `n` live branches carries at most that entropy budget, and deterministic
collapse still pays the existing `n - 1` failure-tax floor. Every achievable deterministic
collapse of the same finite frontier cardinality therefore pays at least the corresponding
finite Landauer heat budget. On the binary surface the Bernoulli entropy/heat law is also
closed: the failure-tax floor bounds every binary Shannon erasure budget and matches it exactly
at the fair fork witness.

The measurable side has four layers:
1. A countable-support entropy shell (arbitrary PMFs carry an `ENNReal` Shannon entropy written
   as a `tsum`, recovered as a supremum of finite truncations and, on countable measurable
   types, as a counting-measure `lintegral`; on finite supports this shell reduces to the
   earlier real-valued finite entropy).
2. A parallel countable-support heat shell obtained by direct `ENNReal` scaling of the
   entropy-in-nats surface.
3. An observable pushforward shell letting arbitrary source branch laws talk to
   finite/countable measurable observables through coarse-grained PMFs on the observable
   codomain.
4. Effective-support theorems: for any PMF on any type whose support is contained in a finite
   `Finset s`, the `ENNReal` entropy is bounded by the frontier entropy `log₂(s.card)` and by
   the failure tax `s.card - 1`, the Landauer heat is bounded by the failure-tax heat budget,
   and the Landauer heat is bounded by the Landauer heat of any achievable collapse cost. This
   closes the measurable erasure gap for arbitrary branch laws with finite effective support,
   without requiring the ambient type to be a `Fintype`.

The sharp finite heat equality story is also closed and lifts through the `ENNReal` shell.
-/
noncomputable def equiprobableFrontierEntropyBits (liveBranches : Nat) : ℝ :=
  Real.logb 2 liveBranches

def deterministicCollapseFailureTax (liveBranches : Nat) : Nat :=
  liveBranches - 1

noncomputable def uniformBranchMass (liveBranches : Nat) : ℝ :=
  (liveBranches : ℝ)⁻¹

noncomputable def uniformVentedBranchSelfInformationBits (liveBranches : Nat) : ℝ :=
  -Real.logb 2 (uniformBranchMass liveBranches)

noncomputable def binaryBranchEntropyBits (branchProbability : ℝ) : ℝ :=
  Real.binEntropy branchProbability / Real.log 2

noncomputable def finiteBranchEntropyNats
    {α : Type*} [Fintype α]
    (branchLaw : PMF α) : ℝ :=
  ∑ a, Real.negMulLog (branchLaw a).toReal

noncomputable def finiteBranchEntropyBits
    {α : Type*} [Fintype α]
    (branchLaw : PMF α) : ℝ :=
  finiteBranchEntropyNats branchLaw / Real.log 2

noncomputable def truncatedBranchEntropyNatsENN
    {α : Type*}
    (branchLaw : PMF α)
    (support : Finset α) : ℝ≥0∞ :=
  Finset.sum support fun a => ENNReal.ofReal (Real.negMulLog (branchLaw a).toReal)

noncomputable def countableBranchEntropyNatsENN
    {α : Type*}
    (branchLaw : PMF α) : ℝ≥0∞ :=
  ∑' a, ENNReal.ofReal (Real.negMulLog (branchLaw a).toReal)

noncomputable def countableBranchEntropyBitsENN
    {α : Type*}
    (branchLaw : PMF α) : ℝ≥0∞ :=
  countableBranchEntropyNatsENN branchLaw / ENNReal.ofReal (Real.log 2)

noncomputable def landauerHeatLowerBound
    (boltzmannConstant temperature erasedBits : ℝ) : ℝ :=
  boltzmannConstant * temperature * Real.log 2 * erasedBits

noncomputable def failureTaxHeatBudget
    (boltzmannConstant temperature : ℝ)
    (liveBranches : Nat) : ℝ :=
  landauerHeatLowerBound boltzmannConstant temperature
    (deterministicCollapseFailureTax liveBranches)

noncomputable def truncatedLandauerHeatLowerBoundENN
    (boltzmannConstant temperature : ℝ)
    {α : Type*}
    (branchLaw : PMF α)
    (support : Finset α) : ℝ≥0∞ :=
  ENNReal.ofReal (boltzmannConstant * temperature) *
    truncatedBranchEntropyNatsENN branchLaw support

noncomputable def countableLandauerHeatLowerBoundENN
    (boltzmannConstant temperature : ℝ)
    {α : Type*}
    (branchLaw : PMF α) : ℝ≥0∞ :=
  ENNReal.ofReal (boltzmannConstant * temperature) *
    countableBranchEntropyNatsENN branchLaw

noncomputable def observedTruncatedBranchEntropyNatsENN
    {α β : Type*}
    (branchLaw : PMF α)
    (observable : α → β)
    (support : Finset β) : ℝ≥0∞ :=
  truncatedBranchEntropyNatsENN (branchLaw.map observable) support

noncomputable def observedBranchEntropyNatsENN
    {α β : Type*}
    (branchLaw : PMF α)
    (observable : α → β) : ℝ≥0∞ :=
  countableBranchEntropyNatsENN (branchLaw.map observable)

noncomputable def observedBranchEntropyBitsENN
    {α β : Type*}
    (branchLaw : PMF α)
    (observable : α → β) : ℝ≥0∞ :=
  countableBranchEntropyBitsENN (branchLaw.map observable)

noncomputable def observedTruncatedLandauerHeatLowerBoundENN
    (boltzmannConstant temperature : ℝ)
    {α β : Type*}
    (branchLaw : PMF α)
    (observable : α → β)
    (support : Finset β) : ℝ≥0∞ :=
  truncatedLandauerHeatLowerBoundENN boltzmannConstant temperature
    (branchLaw.map observable) support

noncomputable def observedLandauerHeatLowerBoundENN
    (boltzmannConstant temperature : ℝ)
    {α β : Type*}
    (branchLaw : PMF α)
    (observable : α → β) : ℝ≥0∞ :=
  countableLandauerHeatLowerBoundENN boltzmannConstant temperature
    (branchLaw.map observable)

theorem uniform_branch_self_information_bits_eq_frontier_entropy_bits
    {liveBranches : Nat}
    (_hLive : 0 < liveBranches) :
    uniformVentedBranchSelfInformationBits liveBranches =
      equiprobableFrontierEntropyBits liveBranches := by
  unfold uniformVentedBranchSelfInformationBits uniformBranchMass equiprobableFrontierEntropyBits
  rw [Real.logb_inv]
  ring

theorem frontier_entropy_bits_two :
    equiprobableFrontierEntropyBits 2 = 1 := by
  unfold equiprobableFrontierEntropyBits
  exact Real.logb_self_eq_one (show (1 : ℝ) < 2 by norm_num)

theorem binary_failure_tax_matches_entropy_bits :
    equiprobableFrontierEntropyBits 2 = deterministicCollapseFailureTax 2 := by
  rw [frontier_entropy_bits_two, deterministicCollapseFailureTax]
  norm_num

theorem binary_branch_entropy_bits_le_one
    {branchProbability : ℝ}
    (_hProbabilityNonneg : 0 ≤ branchProbability)
    (_hProbabilityLeOne : branchProbability ≤ 1) :
    binaryBranchEntropyBits branchProbability ≤ 1 := by
  have hLogTwoPos : 0 < Real.log 2 := by
    exact Real.log_pos (by norm_num)
  unfold binaryBranchEntropyBits
  refine (div_le_iff₀ hLogTwoPos).2 ?_
  simpa using Real.binEntropy_le_log_two (p := branchProbability)

theorem binary_branch_entropy_bits_eq_one_iff
    {branchProbability : ℝ} :
    binaryBranchEntropyBits branchProbability = 1 ↔ branchProbability = (2 : ℝ)⁻¹ := by
  have hLogTwoNe : Real.log 2 ≠ 0 := by
    exact ne_of_gt (Real.log_pos (by norm_num))
  unfold binaryBranchEntropyBits
  rw [div_eq_iff hLogTwoNe, one_mul, Real.binEntropy_eq_log_two]

theorem binary_branch_entropy_bits_le_failure_tax
    {branchProbability : ℝ}
    (hProbabilityNonneg : 0 ≤ branchProbability)
    (hProbabilityLeOne : branchProbability ≤ 1) :
    binaryBranchEntropyBits branchProbability ≤ deterministicCollapseFailureTax 2 := by
  simpa [deterministicCollapseFailureTax] using
    binary_branch_entropy_bits_le_one
      hProbabilityNonneg
      hProbabilityLeOne

theorem binary_branch_entropy_bits_eq_failure_tax_iff
    {branchProbability : ℝ} :
    binaryBranchEntropyBits branchProbability = deterministicCollapseFailureTax 2 ↔
      branchProbability = (2 : ℝ)⁻¹ := by
  simpa [deterministicCollapseFailureTax] using
    (binary_branch_entropy_bits_eq_one_iff (branchProbability := branchProbability))

private theorem finite_branch_mass_toReal_sum_one
    {α : Type*} [Fintype α]
    (branchLaw : PMF α) :
    ∑ a, (branchLaw a).toReal = 1 := by
  have htsum := branchLaw.tsum_coe
  have hsum :
      (Finset.univ.sum fun a => branchLaw a) = (1 : ENNReal) := by
    simpa [tsum_fintype] using htsum
  have hsumReal := congrArg ENNReal.toReal hsum
  rw [ENNReal.toReal_sum (s := Finset.univ) (fun a _ => branchLaw.apply_ne_top a),
    ENNReal.toReal_one] at hsumReal
  exact hsumReal

private theorem finite_uniform_weight_sum_one
    {α : Type*} [Fintype α] [Nonempty α] :
    (∑ _ : α, ((Fintype.card α : ℝ)⁻¹)) = 1 := by
  have hCardNe : (Fintype.card α : ℝ) ≠ 0 := by
    exact_mod_cast Fintype.card_ne_zero
  rw [Finset.sum_const, nsmul_eq_mul]
  exact mul_inv_cancel₀ hCardNe

private theorem negMulLog_inv_card
    {α : Type*} [Fintype α] [Nonempty α] :
    Real.negMulLog ((Fintype.card α : ℝ)⁻¹) =
      Real.log (Fintype.card α) / Fintype.card α := by
  unfold Real.negMulLog
  rw [Real.log_inv]
  ring_nf

private theorem finite_branch_average_eq_inv_card
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    ∑ a : α, ((Fintype.card α : ℝ)⁻¹) * (branchLaw a).toReal =
      ((Fintype.card α : ℝ)⁻¹) := by
  rw [← Finset.mul_sum, finite_branch_mass_toReal_sum_one]
  ring

private theorem finite_branch_entropy_jensen_eq_iff_uniform
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    Real.negMulLog (∑ a : α, ((Fintype.card α : ℝ)⁻¹) * (branchLaw a).toReal) =
      ∑ a : α, ((Fintype.card α : ℝ)⁻¹) * Real.negMulLog ((branchLaw a).toReal) ↔
        ∀ a : α, (branchLaw a).toReal = ((Fintype.card α : ℝ)⁻¹) := by
  simpa [Finset.mem_univ, smul_eq_mul, finite_branch_average_eq_inv_card (branchLaw := branchLaw)]
    using
      (Real.strictConcaveOn_negMulLog.map_sum_eq_iff
        (t := Finset.univ)
        (w := fun _ : α => ((Fintype.card α : ℝ)⁻¹))
        (p := fun a : α => (branchLaw a).toReal)
        (h₀ := by
          intro _ _
          positivity)
        (h₁ := by
          exact finite_uniform_weight_sum_one (α := α))
        (hmem := by
          intro _ _
          exact ENNReal.toReal_nonneg))

theorem finite_branch_entropy_nats_le_log_card
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    finiteBranchEntropyNats branchLaw ≤ Real.log (Fintype.card α) := by
  have hJensen :
      ∑ a : α, ((Fintype.card α : ℝ)⁻¹) * Real.negMulLog ((branchLaw a).toReal) ≤
        Real.negMulLog (∑ a : α, ((Fintype.card α : ℝ)⁻¹) * (branchLaw a).toReal) := by
    simpa [smul_eq_mul] using
      (Real.concaveOn_negMulLog.le_map_sum
        (t := Finset.univ)
        (w := fun _ : α => ((Fintype.card α : ℝ)⁻¹))
        (p := fun a : α => (branchLaw a).toReal)
        (h₀ := by
          intro _ _
          positivity)
        (h₁ := by
          exact finite_uniform_weight_sum_one (α := α))
        (hmem := by
          intro _ _
          exact ENNReal.toReal_nonneg))
  have hScaled :
      ((Fintype.card α : ℝ)⁻¹) * finiteBranchEntropyNats branchLaw ≤
        Real.log (Fintype.card α) / Fintype.card α := by
    rw [← Finset.mul_sum] at hJensen
    have hAvg :
        ∑ a : α, ((Fintype.card α : ℝ)⁻¹) * (branchLaw a).toReal =
          ((Fintype.card α : ℝ)⁻¹) := by
      rw [← Finset.mul_sum, finite_branch_mass_toReal_sum_one]
      ring
    simpa [finiteBranchEntropyNats, hAvg, negMulLog_inv_card (α := α)] using hJensen
  have hCardPosNat : 0 < Fintype.card α :=
    Fintype.card_pos_iff.mpr inferInstance
  have hCardPos : 0 < (Fintype.card α : ℝ) := by
    exact_mod_cast hCardPosNat
  have hMul :=
    mul_le_mul_of_nonneg_left hScaled (le_of_lt hCardPos)
  have hCardNe : (Fintype.card α : ℝ) ≠ 0 := ne_of_gt hCardPos
  simpa [finiteBranchEntropyNats, hCardNe, div_eq_mul_inv, mul_assoc, mul_left_comm, mul_comm]
    using hMul

theorem finite_branch_entropy_nats_eq_log_card_iff
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    finiteBranchEntropyNats branchLaw = Real.log (Fintype.card α) ↔
      branchLaw = PMF.uniformOfFintype α := by
  constructor
  · intro hEq
    have hScaledEq :
        ((Fintype.card α : ℝ)⁻¹) * finiteBranchEntropyNats branchLaw =
          Real.negMulLog ((Fintype.card α : ℝ)⁻¹) := by
      rw [hEq, negMulLog_inv_card]
      ring
    have hJensenEq :
        Real.negMulLog (∑ a : α, ((Fintype.card α : ℝ)⁻¹) * (branchLaw a).toReal) =
          ∑ a : α, ((Fintype.card α : ℝ)⁻¹) * Real.negMulLog ((branchLaw a).toReal) := by
      rw [finite_branch_average_eq_inv_card (branchLaw := branchLaw), ← Finset.mul_sum]
      exact hScaledEq.symm
    have hUniformMass :
        ∀ a : α, (branchLaw a).toReal = ((Fintype.card α : ℝ)⁻¹) :=
      (finite_branch_entropy_jensen_eq_iff_uniform branchLaw).1 hJensenEq
    apply PMF.ext
    intro a
    exact
      (ENNReal.toReal_eq_toReal_iff'
        (branchLaw.apply_ne_top a)
        ((PMF.uniformOfFintype α).apply_ne_top a)).1
        (by simpa [PMF.uniformOfFintype_apply] using hUniformMass a)
  · intro hUniform
    rw [hUniform]
    unfold finiteBranchEntropyNats
    have hCardNe : (Fintype.card α : ℝ) ≠ 0 := by
      exact_mod_cast Fintype.card_ne_zero
    calc
      ∑ a : α, Real.negMulLog (((PMF.uniformOfFintype α) a).toReal) =
          ∑ _ : α, Real.log (Fintype.card α) / Fintype.card α := by
            refine Finset.sum_congr rfl ?_
            intro a _
            simpa [PMF.uniformOfFintype_apply] using negMulLog_inv_card (α := α)
      _ = (Fintype.card α : ℝ) * (Real.log (Fintype.card α) / Fintype.card α) := by
            simp [Finset.sum_const, nsmul_eq_mul]
      _ = Real.log (Fintype.card α) := by
            field_simp [hCardNe]

theorem finite_branch_entropy_bits_le_frontier_entropy_bits
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    finiteBranchEntropyBits branchLaw ≤ equiprobableFrontierEntropyBits (Fintype.card α) := by
  have hLogTwoPos : 0 < Real.log 2 := by
    exact Real.log_pos (by norm_num)
  unfold finiteBranchEntropyBits equiprobableFrontierEntropyBits
  rw [Real.logb]
  rw [div_le_div_iff_of_pos_right hLogTwoPos]
  exact finite_branch_entropy_nats_le_log_card branchLaw

theorem finite_branch_entropy_bits_eq_frontier_entropy_bits_iff
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    finiteBranchEntropyBits branchLaw =
        equiprobableFrontierEntropyBits (Fintype.card α) ↔
      branchLaw = PMF.uniformOfFintype α := by
  have hLogTwoNe : Real.log 2 ≠ 0 := by
    exact ne_of_gt (Real.log_pos (by norm_num))
  constructor
  · intro hEq
    have hMul :
        finiteBranchEntropyNats branchLaw = Real.log (Fintype.card α) := by
      have := congrArg (fun x : ℝ => x * Real.log 2) hEq
      simpa [finiteBranchEntropyBits, equiprobableFrontierEntropyBits, Real.logb,
        hLogTwoNe, mul_assoc, mul_left_comm, mul_comm] using this
    exact (finite_branch_entropy_nats_eq_log_card_iff branchLaw).1 hMul
  · intro hUniform
    have hMul :=
      (finite_branch_entropy_nats_eq_log_card_iff branchLaw).2 hUniform
    have : finiteBranchEntropyNats branchLaw / Real.log 2 =
        Real.log (Fintype.card α) / Real.log 2 := by
      rw [hMul]
    simpa [finiteBranchEntropyBits, equiprobableFrontierEntropyBits, Real.logb] using this

private theorem branch_entropy_term_nonneg
    {α : Type*}
    (branchLaw : PMF α)
    (a : α) :
    0 ≤ Real.negMulLog (branchLaw a).toReal := by
  have hLeOne : (branchLaw a).toReal ≤ 1 := by
    exact ENNReal.toReal_mono ENNReal.one_ne_top (branchLaw.coe_le_one a)
  exact Real.negMulLog_nonneg ENNReal.toReal_nonneg hLeOne

theorem finite_branch_entropy_nats_nonneg
    {α : Type*} [Fintype α]
    (branchLaw : PMF α) :
    0 ≤ finiteBranchEntropyNats branchLaw := by
  unfold finiteBranchEntropyNats
  exact Finset.sum_nonneg fun a _ => branch_entropy_term_nonneg branchLaw a

theorem finite_branch_entropy_bits_nonneg
    {α : Type*} [Fintype α]
    (branchLaw : PMF α) :
    0 ≤ finiteBranchEntropyBits branchLaw := by
  have hLogTwoPos : 0 < Real.log 2 := by
    exact Real.log_pos (by norm_num)
  unfold finiteBranchEntropyBits
  exact div_nonneg (finite_branch_entropy_nats_nonneg branchLaw) (le_of_lt hLogTwoPos)

theorem truncated_branch_entropy_natsENN_le_countable
    {α : Type*}
    (branchLaw : PMF α)
    (support : Finset α) :
    truncatedBranchEntropyNatsENN branchLaw support ≤ countableBranchEntropyNatsENN branchLaw := by
  unfold truncatedBranchEntropyNatsENN countableBranchEntropyNatsENN
  exact ENNReal.sum_le_tsum support

theorem countable_branch_entropy_natsENN_eq_iSup_truncated
    {α : Type*}
    (branchLaw : PMF α) :
    countableBranchEntropyNatsENN branchLaw =
      ⨆ support : Finset α, truncatedBranchEntropyNatsENN branchLaw support := by
  unfold countableBranchEntropyNatsENN truncatedBranchEntropyNatsENN
  simpa using
    (ENNReal.tsum_eq_iSup_sum
      (f := fun a : α => ENNReal.ofReal (Real.negMulLog (branchLaw a).toReal)))

theorem countable_branch_entropy_natsENN_eq_count_lintegral
    {α : Type*} [MeasurableSpace α] [Countable α] [MeasurableSingletonClass α]
    (branchLaw : PMF α) :
    countableBranchEntropyNatsENN branchLaw =
      ∫⁻ a, ENNReal.ofReal (Real.negMulLog (branchLaw a).toReal) ∂
        (MeasureTheory.Measure.count : MeasureTheory.Measure α) := by
  simpa [countableBranchEntropyNatsENN] using
    (MeasureTheory.lintegral_countable'
      (μ := (MeasureTheory.Measure.count : MeasureTheory.Measure α))
      (f := fun a : α => ENNReal.ofReal (Real.negMulLog (branchLaw a).toReal))).symm

theorem countable_branch_entropy_natsENN_eq_finite
    {α : Type*} [Fintype α]
    (branchLaw : PMF α) :
    countableBranchEntropyNatsENN branchLaw =
      ENNReal.ofReal (finiteBranchEntropyNats branchLaw) := by
  unfold countableBranchEntropyNatsENN finiteBranchEntropyNats
  rw [tsum_fintype]
  symm
  exact ENNReal.ofReal_sum_of_nonneg
    (fun a _ => branch_entropy_term_nonneg branchLaw a)

theorem countable_branch_entropy_bitsENN_eq_finite
    {α : Type*} [Fintype α]
    (branchLaw : PMF α) :
    countableBranchEntropyBitsENN branchLaw =
      ENNReal.ofReal (finiteBranchEntropyBits branchLaw) := by
  have hLogTwoPos : 0 < Real.log 2 := by
    exact Real.log_pos (by norm_num)
  unfold countableBranchEntropyBitsENN finiteBranchEntropyBits
  rw [countable_branch_entropy_natsENN_eq_finite, ENNReal.ofReal_div_of_pos hLogTwoPos]

theorem countable_branch_entropy_bitsENN_eq_frontier_entropy_bits_iff
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    countableBranchEntropyBitsENN branchLaw =
        ENNReal.ofReal (equiprobableFrontierEntropyBits (Fintype.card α)) ↔
      branchLaw = PMF.uniformOfFintype α := by
  have hFrontierNonneg : 0 ≤ equiprobableFrontierEntropyBits (Fintype.card α) := by
    rw [← (finite_branch_entropy_bits_eq_frontier_entropy_bits_iff
      (branchLaw := PMF.uniformOfFintype α)).2 rfl]
    exact finite_branch_entropy_bits_nonneg (PMF.uniformOfFintype α)
  rw [countable_branch_entropy_bitsENN_eq_finite,
    ENNReal.ofReal_eq_ofReal_iff
      (finite_branch_entropy_bits_nonneg branchLaw)
      hFrontierNonneg]
  exact finite_branch_entropy_bits_eq_frontier_entropy_bits_iff branchLaw

theorem truncated_landauer_heat_lower_boundENN_le_countable
    {α : Type*}
    (boltzmannConstant temperature : ℝ)
    (branchLaw : PMF α)
    (support : Finset α) :
    truncatedLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw support ≤
      countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw := by
  unfold truncatedLandauerHeatLowerBoundENN countableLandauerHeatLowerBoundENN
  gcongr
  exact truncated_branch_entropy_natsENN_le_countable branchLaw support

theorem countable_landauer_heat_lower_boundENN_eq_iSup_truncated
    {α : Type*}
    (boltzmannConstant temperature : ℝ)
    (branchLaw : PMF α) :
    countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw =
      ⨆ support : Finset α,
        truncatedLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw support := by
  unfold countableLandauerHeatLowerBoundENN truncatedLandauerHeatLowerBoundENN
  rw [countable_branch_entropy_natsENN_eq_iSup_truncated, ENNReal.mul_iSup]

theorem countable_landauer_heat_lower_boundENN_eq_count_lintegral
    {α : Type*} [MeasurableSpace α] [Countable α] [MeasurableSingletonClass α]
    (boltzmannConstant temperature : ℝ)
    (branchLaw : PMF α) :
    countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw =
      ∫⁻ a, ENNReal.ofReal (boltzmannConstant * temperature) *
        ENNReal.ofReal (Real.negMulLog (branchLaw a).toReal) ∂
          (MeasureTheory.Measure.count : MeasureTheory.Measure α) := by
  unfold countableLandauerHeatLowerBoundENN
  rw [countable_branch_entropy_natsENN_eq_count_lintegral]
  symm
  exact MeasureTheory.lintegral_const_mul'
    (μ := (MeasureTheory.Measure.count : MeasureTheory.Measure α))
    (r := ENNReal.ofReal (boltzmannConstant * temperature))
    (f := fun a : α => ENNReal.ofReal (Real.negMulLog (branchLaw a).toReal))
    ENNReal.ofReal_ne_top

theorem countable_landauer_heat_lower_boundENN_eq_count_lintegral_of_nonneg
    {α : Type*} [MeasurableSpace α] [Countable α] [MeasurableSingletonClass α]
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (branchLaw : PMF α) :
    countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw =
      ∫⁻ a, ENNReal.ofReal
        ((boltzmannConstant * temperature) * Real.negMulLog (branchLaw a).toReal) ∂
          (MeasureTheory.Measure.count : MeasureTheory.Measure α) := by
  have hCoeff : 0 ≤ boltzmannConstant * temperature := by
    positivity
  calc
    countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw =
      ∫⁻ a, ENNReal.ofReal (boltzmannConstant * temperature) *
        ENNReal.ofReal (Real.negMulLog (branchLaw a).toReal) ∂
          (MeasureTheory.Measure.count : MeasureTheory.Measure α) :=
        countable_landauer_heat_lower_boundENN_eq_count_lintegral
          boltzmannConstant temperature branchLaw
    _ =
      ∫⁻ a, ENNReal.ofReal
        ((boltzmannConstant * temperature) * Real.negMulLog (branchLaw a).toReal) ∂
          (MeasureTheory.Measure.count : MeasureTheory.Measure α) := by
        refine MeasureTheory.lintegral_congr_ae ?_
        filter_upwards with a
        rw [← ENNReal.ofReal_mul hCoeff]

theorem observed_branch_mass_eq_fiber_measure
    {α β : Type*} [MeasurableSpace α] [MeasurableSpace β] [MeasurableSingletonClass β]
    (branchLaw : PMF α)
    (observable : α → β)
    (hObservable : Measurable observable)
    (b : β) :
    (branchLaw.map observable) b =
      branchLaw.toMeasure (observable ⁻¹' ({b} : Set β)) := by
  rw [← PMF.toMeasure_apply_singleton
    (branchLaw.map observable) b (MeasurableSet.singleton b)]
  exact PMF.toMeasure_map_apply observable branchLaw ({b} : Set β)
    hObservable (MeasurableSet.singleton b)

theorem observed_branch_entropy_natsENN_eq_iSup_truncated
    {α β : Type*}
    (branchLaw : PMF α)
    (observable : α → β) :
    observedBranchEntropyNatsENN branchLaw observable =
      ⨆ support : Finset β,
        observedTruncatedBranchEntropyNatsENN branchLaw observable support := by
  unfold observedBranchEntropyNatsENN observedTruncatedBranchEntropyNatsENN
  exact countable_branch_entropy_natsENN_eq_iSup_truncated
    (branchLaw := branchLaw.map observable)

theorem observed_branch_entropy_natsENN_eq_count_lintegral
    {α β : Type*} [MeasurableSpace β] [Countable β] [MeasurableSingletonClass β]
    (branchLaw : PMF α)
    (observable : α → β) :
    observedBranchEntropyNatsENN branchLaw observable =
      ∫⁻ b, ENNReal.ofReal (Real.negMulLog ((branchLaw.map observable) b).toReal) ∂
        (MeasureTheory.Measure.count : MeasureTheory.Measure β) := by
  unfold observedBranchEntropyNatsENN
  exact countable_branch_entropy_natsENN_eq_count_lintegral
    (branchLaw := branchLaw.map observable)

theorem observed_landauer_heat_lower_boundENN_eq_iSup_truncated
    {α β : Type*}
    (boltzmannConstant temperature : ℝ)
    (branchLaw : PMF α)
    (observable : α → β) :
    observedLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw observable =
      ⨆ support : Finset β,
        observedTruncatedLandauerHeatLowerBoundENN boltzmannConstant temperature
          branchLaw observable support := by
  unfold observedLandauerHeatLowerBoundENN observedTruncatedLandauerHeatLowerBoundENN
  exact countable_landauer_heat_lower_boundENN_eq_iSup_truncated
    boltzmannConstant temperature (branchLaw := branchLaw.map observable)

theorem observed_landauer_heat_lower_boundENN_eq_count_lintegral
    {α β : Type*} [MeasurableSpace β] [Countable β] [MeasurableSingletonClass β]
    (boltzmannConstant temperature : ℝ)
    (branchLaw : PMF α)
    (observable : α → β) :
    observedLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw observable =
      ∫⁻ b, ENNReal.ofReal (boltzmannConstant * temperature) *
        ENNReal.ofReal (Real.negMulLog ((branchLaw.map observable) b).toReal) ∂
          (MeasureTheory.Measure.count : MeasureTheory.Measure β) := by
  unfold observedLandauerHeatLowerBoundENN
  exact countable_landauer_heat_lower_boundENN_eq_count_lintegral
    boltzmannConstant temperature (branchLaw := branchLaw.map observable)

private theorem nat_le_two_pow_pred {liveBranches : Nat}
    (hLive : 0 < liveBranches) :
    liveBranches ≤ 2 ^ (liveBranches - 1) := by
  cases liveBranches with
  | zero =>
      cases Nat.not_lt_zero _ hLive
  | succ n =>
      simpa using Nat.succ_le_of_lt n.lt_two_pow_self

theorem frontier_entropy_bits_le_failure_tax
    {liveBranches : Nat}
    (hLive : 0 < liveBranches) :
    equiprobableFrontierEntropyBits liveBranches ≤ deterministicCollapseFailureTax liveBranches := by
  unfold equiprobableFrontierEntropyBits deterministicCollapseFailureTax
  refine
    (Real.logb_le_iff_le_rpow
      (b := (2 : ℝ))
      (x := (liveBranches : ℝ))
      (y := ((liveBranches - 1 : Nat) : ℝ))
      (by norm_num)
      (by exact_mod_cast hLive)).2 ?_
  have hNat : liveBranches ≤ 2 ^ (liveBranches - 1) :=
    nat_le_two_pow_pred hLive
  have hRealNat : (liveBranches : ℝ) ≤ (2 : ℝ) ^ (liveBranches - 1) := by
    exact_mod_cast hNat
  simpa [Real.rpow_natCast] using hRealNat

private theorem succ_lt_two_pow_of_two_le {n : Nat}
    (hTwo : 2 ≤ n) :
    n + 1 < 2 ^ n := by
  have hStep : n + 1 < 2 * n := by
    omega
  have hPos : 0 < n := by
    omega
  have hCore : n ≤ 2 ^ (n - 1) := nat_le_two_pow_pred hPos
  have hTwice : 2 * n ≤ 2 * 2 ^ (n - 1) := by
    exact Nat.mul_le_mul_left 2 hCore
  calc
    n + 1 < 2 * n := hStep
    _ ≤ 2 * 2 ^ (n - 1) := hTwice
    _ = 2 ^ n := by
      calc
        2 * 2 ^ (n - 1) = 2 ^ (n - 1) * 2 := by rw [Nat.mul_comm]
        _ = 2 ^ ((n - 1) + 1) := by rw [Nat.pow_succ]
        _ = 2 ^ n := by rw [Nat.sub_add_cancel hPos]

private theorem frontier_entropy_bits_lt_failure_tax_of_three_le
    {liveBranches : Nat}
    (hThree : 3 ≤ liveBranches) :
    equiprobableFrontierEntropyBits liveBranches <
      deterministicCollapseFailureTax liveBranches := by
  have hLive : 0 < liveBranches := by
    omega
  have hNat :
      liveBranches < 2 ^ (liveBranches - 1) := by
    have hPredTwo : 2 ≤ liveBranches - 1 := by
      omega
    have hSucc :
        (liveBranches - 1) + 1 < 2 ^ (liveBranches - 1) :=
      succ_lt_two_pow_of_two_le hPredTwo
    calc
      liveBranches = (liveBranches - 1) + 1 := by omega
      _ < 2 ^ (liveBranches - 1) := hSucc
  unfold equiprobableFrontierEntropyBits deterministicCollapseFailureTax
  refine
    (Real.logb_lt_iff_lt_rpow
      (b := (2 : ℝ))
      (x := (liveBranches : ℝ))
      (y := ((liveBranches - 1 : Nat) : ℝ))
      (by norm_num)
      (by exact_mod_cast hLive)).2 ?_
  exact_mod_cast hNat

theorem frontier_entropy_bits_eq_failure_tax_iff
    {liveBranches : Nat}
    (hLive : 0 < liveBranches) :
    equiprobableFrontierEntropyBits liveBranches = deterministicCollapseFailureTax liveBranches ↔
      liveBranches = 1 ∨ liveBranches = 2 := by
  constructor
  · intro hEq
    by_cases hOne : liveBranches = 1
    · exact Or.inl hOne
    by_cases hTwo : liveBranches = 2
    · exact Or.inr hTwo
    have hThree : 3 ≤ liveBranches := by
      omega
    exact (False.elim <| (ne_of_lt (frontier_entropy_bits_lt_failure_tax_of_three_le hThree)) hEq)
  · rintro (rfl | rfl)
    · simp [equiprobableFrontierEntropyBits, deterministicCollapseFailureTax]
    · exact binary_failure_tax_matches_entropy_bits

theorem finite_branch_entropy_bits_le_failure_tax
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    finiteBranchEntropyBits branchLaw ≤ deterministicCollapseFailureTax (Fintype.card α) := by
  exact
    (finite_branch_entropy_bits_le_frontier_entropy_bits branchLaw).trans
      (frontier_entropy_bits_le_failure_tax
        (liveBranches := Fintype.card α)
        (Fintype.card_pos_iff.mpr inferInstance))

theorem finite_branch_entropy_bits_eq_failure_tax_iff
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    finiteBranchEntropyBits branchLaw = deterministicCollapseFailureTax (Fintype.card α) ↔
      branchLaw = PMF.uniformOfFintype α ∧
        (Fintype.card α = 1 ∨ Fintype.card α = 2) := by
  constructor
  · intro hEq
    have hFrontierLe :
        equiprobableFrontierEntropyBits (Fintype.card α) ≤ finiteBranchEntropyBits branchLaw := by
      rw [hEq]
      exact frontier_entropy_bits_le_failure_tax
        (liveBranches := Fintype.card α)
        (Fintype.card_pos_iff.mpr inferInstance)
    have hFrontierEq :
        finiteBranchEntropyBits branchLaw =
          equiprobableFrontierEntropyBits (Fintype.card α) := by
      exact le_antisymm
        (finite_branch_entropy_bits_le_frontier_entropy_bits branchLaw)
        hFrontierLe
    have hUniform :
        branchLaw = PMF.uniformOfFintype α :=
      (finite_branch_entropy_bits_eq_frontier_entropy_bits_iff branchLaw).1 hFrontierEq
    have hCard :
        Fintype.card α = 1 ∨ Fintype.card α = 2 := by
      have hFrontierTax :
          equiprobableFrontierEntropyBits (Fintype.card α) =
            deterministicCollapseFailureTax (Fintype.card α) := by
        rw [← hFrontierEq, hEq]
      exact
        (frontier_entropy_bits_eq_failure_tax_iff
          (liveBranches := Fintype.card α)
          (Fintype.card_pos_iff.mpr inferInstance)).1 hFrontierTax
    exact ⟨hUniform, hCard⟩
  · rintro ⟨hUniform, hCard⟩
    calc
      finiteBranchEntropyBits branchLaw =
          equiprobableFrontierEntropyBits (Fintype.card α) :=
            (finite_branch_entropy_bits_eq_frontier_entropy_bits_iff branchLaw).2 hUniform
      _ = deterministicCollapseFailureTax (Fintype.card α) :=
            (frontier_entropy_bits_eq_failure_tax_iff
              (liveBranches := Fintype.card α)
              (Fintype.card_pos_iff.mpr inferInstance)).2 hCard

theorem countable_branch_entropy_bitsENN_eq_failure_tax_iff
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    countableBranchEntropyBitsENN branchLaw =
        ENNReal.ofReal (deterministicCollapseFailureTax (Fintype.card α)) ↔
      branchLaw = PMF.uniformOfFintype α ∧
        (Fintype.card α = 1 ∨ Fintype.card α = 2) := by
  rw [countable_branch_entropy_bitsENN_eq_finite,
    ENNReal.ofReal_eq_ofReal_iff
      (finite_branch_entropy_bits_nonneg branchLaw)
      (by positivity)]
  exact finite_branch_entropy_bits_eq_failure_tax_iff branchLaw

theorem achievable_collapse_entropy_bits_le_total_cost
    {start : List BranchSnapshot}
    {cost : Nat}
    (hLive : 0 < liveBranchCount start)
    (hAchievable : CollapseCostAchievableFrom start cost) :
    equiprobableFrontierEntropyBits (liveBranchCount start) ≤ cost := by
  exact
    (frontier_entropy_bits_le_failure_tax hLive).trans
      (by exact_mod_cast (collapse_cost_achievable_lower_bound hAchievable))

theorem achievable_collapse_finite_entropy_bits_le_total_cost
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α)
    {start : List BranchSnapshot}
    {cost : Nat}
    (hCard : Fintype.card α = liveBranchCount start)
    (hAchievable : CollapseCostAchievableFrom start cost) :
    finiteBranchEntropyBits branchLaw ≤ cost := by
  calc
    finiteBranchEntropyBits branchLaw ≤ deterministicCollapseFailureTax (Fintype.card α) :=
      finite_branch_entropy_bits_le_failure_tax branchLaw
    _ = deterministicCollapseFailureTax (liveBranchCount start) := by rw [hCard]
    _ ≤ cost := by
      exact_mod_cast (collapse_cost_achievable_lower_bound hAchievable)

theorem landauer_heat_le_failure_tax_heat_budget
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    {liveBranches : Nat}
    (hLive : 0 < liveBranches) :
    landauerHeatLowerBound boltzmannConstant temperature
        (equiprobableFrontierEntropyBits liveBranches) ≤
      failureTaxHeatBudget boltzmannConstant temperature liveBranches := by
  let coeff : ℝ := boltzmannConstant * temperature * Real.log 2
  have hCoeff : 0 ≤ coeff := by
    unfold coeff
    positivity
  have hBits :=
    mul_le_mul_of_nonneg_left (frontier_entropy_bits_le_failure_tax hLive) hCoeff
  simpa [landauerHeatLowerBound, failureTaxHeatBudget, coeff, mul_assoc, mul_left_comm, mul_comm]
    using hBits

theorem binary_landauer_heat_matches_failure_tax_budget
    (boltzmannConstant temperature : ℝ) :
    landauerHeatLowerBound boltzmannConstant temperature
        (equiprobableFrontierEntropyBits 2) =
      failureTaxHeatBudget boltzmannConstant temperature 2 := by
  rw [binary_failure_tax_matches_entropy_bits]
  unfold failureTaxHeatBudget
  rfl

theorem binary_landauer_heat_le_failure_tax_budget
    {boltzmannConstant temperature branchProbability : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (hProbabilityNonneg : 0 ≤ branchProbability)
    (hProbabilityLeOne : branchProbability ≤ 1) :
    landauerHeatLowerBound boltzmannConstant temperature
        (binaryBranchEntropyBits branchProbability) ≤
      failureTaxHeatBudget boltzmannConstant temperature 2 := by
  let coeff : ℝ := boltzmannConstant * temperature * Real.log 2
  have hCoeff : 0 ≤ coeff := by
    unfold coeff
    positivity
  have hBits :=
    mul_le_mul_of_nonneg_left
      (binary_branch_entropy_bits_le_failure_tax hProbabilityNonneg hProbabilityLeOne)
      hCoeff
  simpa [landauerHeatLowerBound, failureTaxHeatBudget, coeff, deterministicCollapseFailureTax,
    mul_assoc, mul_left_comm, mul_comm] using hBits

theorem finite_landauer_heat_le_failure_tax_budget
    {α : Type*} [Fintype α] [Nonempty α]
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (branchLaw : PMF α) :
    landauerHeatLowerBound boltzmannConstant temperature
        (finiteBranchEntropyBits branchLaw) ≤
      failureTaxHeatBudget boltzmannConstant temperature (Fintype.card α) := by
  let coeff : ℝ := boltzmannConstant * temperature * Real.log 2
  have hCoeff : 0 ≤ coeff := by
    unfold coeff
    positivity
  have hBits :=
    mul_le_mul_of_nonneg_left
      (finite_branch_entropy_bits_le_failure_tax branchLaw)
      hCoeff
  simpa [landauerHeatLowerBound, failureTaxHeatBudget, coeff, mul_assoc, mul_left_comm, mul_comm]
    using hBits

theorem finite_landauer_heat_eq_failure_tax_budget_iff
    {α : Type*} [Fintype α] [Nonempty α]
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannPos : 0 < boltzmannConstant)
    (hTemperaturePos : 0 < temperature)
    (branchLaw : PMF α) :
    landauerHeatLowerBound boltzmannConstant temperature
        (finiteBranchEntropyBits branchLaw) =
      failureTaxHeatBudget boltzmannConstant temperature (Fintype.card α) ↔
        branchLaw = PMF.uniformOfFintype α ∧
          (Fintype.card α = 1 ∨ Fintype.card α = 2) := by
  let coeff : ℝ := boltzmannConstant * temperature * Real.log 2
  have hCoeffPos : 0 < coeff := by
    unfold coeff
    positivity
  have hCoeffNe : coeff ≠ 0 := ne_of_gt hCoeffPos
  constructor
  · intro h
    have hBits :
        finiteBranchEntropyBits branchLaw =
          deterministicCollapseFailureTax (Fintype.card α) := by
      have hHeat :
          coeff * finiteBranchEntropyBits branchLaw =
            coeff * deterministicCollapseFailureTax (Fintype.card α) := by
        simpa [coeff, landauerHeatLowerBound, failureTaxHeatBudget,
          mul_assoc, mul_left_comm, mul_comm] using h
      have hInv :
          (coeff * finiteBranchEntropyBits branchLaw) * coeff⁻¹ =
            (coeff * deterministicCollapseFailureTax (Fintype.card α)) * coeff⁻¹ := by
        exact congrArg (fun x : ℝ => x * coeff⁻¹) hHeat
      simpa [hCoeffNe, mul_assoc, mul_left_comm, mul_comm] using hInv
    exact (finite_branch_entropy_bits_eq_failure_tax_iff branchLaw).1 hBits
  · intro h
    have hBits :
        finiteBranchEntropyBits branchLaw =
          deterministicCollapseFailureTax (Fintype.card α) :=
      (finite_branch_entropy_bits_eq_failure_tax_iff branchLaw).2 h
    have hMul :
        finiteBranchEntropyBits branchLaw * coeff =
          deterministicCollapseFailureTax (Fintype.card α) * coeff := by
      exact congrArg (fun x : ℝ => x * coeff) hBits
    simpa [coeff, landauerHeatLowerBound, failureTaxHeatBudget,
      mul_assoc, mul_left_comm, mul_comm] using hMul

theorem binary_landauer_heat_eq_failure_tax_budget_iff
    {boltzmannConstant temperature branchProbability : ℝ}
    (hBoltzmannPos : 0 < boltzmannConstant)
    (hTemperaturePos : 0 < temperature) :
    landauerHeatLowerBound boltzmannConstant temperature
        (binaryBranchEntropyBits branchProbability) =
      failureTaxHeatBudget boltzmannConstant temperature 2 ↔
        branchProbability = (2 : ℝ)⁻¹ := by
  let coeff : ℝ := boltzmannConstant * temperature * Real.log 2
  have hCoeffPos : 0 < coeff := by
    positivity
  have hCoeffNe : coeff ≠ 0 := ne_of_gt hCoeffPos
  constructor
  · intro h
    have hBits :
        binaryBranchEntropyBits branchProbability * coeff =
          (deterministicCollapseFailureTax 2 : ℝ) * coeff := by
      simpa [coeff, landauerHeatLowerBound, failureTaxHeatBudget,
        mul_assoc, mul_left_comm, mul_comm] using h
    exact
      (binary_branch_entropy_bits_eq_failure_tax_iff (branchProbability := branchProbability)).1
        ((mul_left_inj' hCoeffNe).1 hBits)
  · intro h
    have hBits :
        binaryBranchEntropyBits branchProbability = deterministicCollapseFailureTax 2 :=
      (binary_branch_entropy_bits_eq_failure_tax_iff (branchProbability := branchProbability)).2 h
    have hMul :
        binaryBranchEntropyBits branchProbability * coeff =
          (deterministicCollapseFailureTax 2 : ℝ) * coeff := by
      exact congrArg (fun x : ℝ => x * coeff) hBits
    simpa [coeff, landauerHeatLowerBound, failureTaxHeatBudget,
      mul_assoc, mul_left_comm, mul_comm] using hMul

theorem achievable_collapse_landauer_heat_le_total_cost
    {start : List BranchSnapshot}
    {cost : Nat}
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (hLive : 0 < liveBranchCount start)
    (hAchievable : CollapseCostAchievableFrom start cost) :
    landauerHeatLowerBound boltzmannConstant temperature
        (equiprobableFrontierEntropyBits (liveBranchCount start)) ≤
      landauerHeatLowerBound boltzmannConstant temperature cost := by
  let coeff : ℝ := boltzmannConstant * temperature * Real.log 2
  have hCoeff : 0 ≤ coeff := by
    unfold coeff
    positivity
  have hCost :=
    mul_le_mul_of_nonneg_left
      (achievable_collapse_entropy_bits_le_total_cost hLive hAchievable)
      hCoeff
  simpa [landauerHeatLowerBound, coeff, mul_assoc, mul_left_comm, mul_comm] using hCost

theorem achievable_collapse_finite_entropy_landauer_heat_le_total_cost
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α)
    {start : List BranchSnapshot}
    {cost : Nat}
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (hCard : Fintype.card α = liveBranchCount start)
    (hAchievable : CollapseCostAchievableFrom start cost) :
    landauerHeatLowerBound boltzmannConstant temperature
        (finiteBranchEntropyBits branchLaw) ≤
      landauerHeatLowerBound boltzmannConstant temperature cost := by
  let coeff : ℝ := boltzmannConstant * temperature * Real.log 2
  have hCoeff : 0 ≤ coeff := by
    unfold coeff
    positivity
  have hCost :=
    mul_le_mul_of_nonneg_left
      (achievable_collapse_finite_entropy_bits_le_total_cost branchLaw hCard hAchievable)
      hCoeff
  simpa [landauerHeatLowerBound, coeff, mul_assoc, mul_left_comm, mul_comm] using hCost

/--
Measurable erasure inequality: the countable-support Shannon entropy (in bits, as ENNReal)
of any finite-type PMF is bounded above by the equiprobable frontier entropy.
This lifts `finite_branch_entropy_bits_le_frontier_entropy_bits` through the
`countable_branch_entropy_bitsENN_eq_finite` collapse.
-/
theorem countable_branch_entropy_bitsENN_le_frontier_entropy_bits
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    countableBranchEntropyBitsENN branchLaw ≤
      ENNReal.ofReal (equiprobableFrontierEntropyBits (Fintype.card α)) := by
  rw [countable_branch_entropy_bitsENN_eq_finite]
  exact ENNReal.ofReal_le_ofReal
    (finite_branch_entropy_bits_le_frontier_entropy_bits branchLaw)

/--
Measurable erasure inequality: the countable-support Shannon entropy (in bits, as ENNReal)
of any finite-type PMF is bounded above by the deterministic-collapse failure tax.
This composes `countable_branch_entropy_bitsENN_le_frontier_entropy_bits` with
`frontier_entropy_bits_le_failure_tax`.
-/
theorem countable_branch_entropy_bitsENN_le_failure_tax
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α) :
    countableBranchEntropyBitsENN branchLaw ≤
      ENNReal.ofReal (deterministicCollapseFailureTax (Fintype.card α)) := by
  rw [countable_branch_entropy_bitsENN_eq_finite]
  exact ENNReal.ofReal_le_ofReal
    (finite_branch_entropy_bits_le_failure_tax branchLaw)

/--
Measurable Landauer heat inequality: for any finite-type PMF, the Landauer heat of
the countable-support Shannon entropy is bounded above by the failure-tax heat budget.
This is expressed directly through `countableLandauerHeatLowerBoundENN`, which reduces
on finite types to the earlier real-valued finite heat and then lifts
`finite_landauer_heat_le_failure_tax_budget`.
-/
theorem countable_landauer_heat_lower_boundENN_eq_finite
    {α : Type*} [Fintype α]
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (branchLaw : PMF α) :
    countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw =
      ENNReal.ofReal (landauerHeatLowerBound boltzmannConstant temperature
        (finiteBranchEntropyBits branchLaw)) := by
  have hCoeff : 0 ≤ boltzmannConstant * temperature := by
    positivity
  have hLogTwoNe : Real.log 2 ≠ 0 := by
    exact ne_of_gt (Real.log_pos (by norm_num))
  unfold countableLandauerHeatLowerBoundENN
  rw [countable_branch_entropy_natsENN_eq_finite]
  calc
    ENNReal.ofReal (boltzmannConstant * temperature) *
        ENNReal.ofReal (finiteBranchEntropyNats branchLaw) =
      ENNReal.ofReal
        ((boltzmannConstant * temperature) *
          finiteBranchEntropyNats branchLaw) := by
        rw [← ENNReal.ofReal_mul hCoeff]
    _ =
      ENNReal.ofReal (landauerHeatLowerBound boltzmannConstant temperature
        (finiteBranchEntropyBits branchLaw)) := by
        congr 1
        unfold landauerHeatLowerBound finiteBranchEntropyBits
        field_simp [hLogTwoNe]

theorem countable_landauer_heat_le_failure_tax_budget
    {α : Type*} [Fintype α] [Nonempty α]
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (branchLaw : PMF α) :
    countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw ≤
      ENNReal.ofReal (failureTaxHeatBudget boltzmannConstant temperature (Fintype.card α)) :=
by
  rw [countable_landauer_heat_lower_boundENN_eq_finite hBoltzmannNonneg hTemperatureNonneg]
  exact ENNReal.ofReal_le_ofReal
    (finite_landauer_heat_le_failure_tax_budget hBoltzmannNonneg hTemperatureNonneg branchLaw)

theorem countable_landauer_heat_eq_failure_tax_budget_iff
    {α : Type*} [Fintype α] [Nonempty α]
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannPos : 0 < boltzmannConstant)
    (hTemperaturePos : 0 < temperature)
    (branchLaw : PMF α) :
    countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw =
      ENNReal.ofReal (failureTaxHeatBudget boltzmannConstant temperature (Fintype.card α)) ↔
        branchLaw = PMF.uniformOfFintype α ∧
          (Fintype.card α = 1 ∨ Fintype.card α = 2) := by
  rw [countable_landauer_heat_lower_boundENN_eq_finite
    (le_of_lt hBoltzmannPos)
    (le_of_lt hTemperaturePos)]
  have hCoeffNonneg : 0 ≤ boltzmannConstant * temperature * Real.log 2 := by
    positivity
  have hHeatNonneg :
      0 ≤ landauerHeatLowerBound boltzmannConstant temperature
        (finiteBranchEntropyBits branchLaw) := by
    unfold landauerHeatLowerBound
    exact mul_nonneg hCoeffNonneg (finite_branch_entropy_bits_nonneg branchLaw)
  have hBudgetNonneg :
      0 ≤ failureTaxHeatBudget boltzmannConstant temperature (Fintype.card α) := by
    unfold failureTaxHeatBudget landauerHeatLowerBound
    positivity
  rw [ENNReal.ofReal_eq_ofReal_iff hHeatNonneg hBudgetNonneg]
  exact finite_landauer_heat_eq_failure_tax_budget_iff
    hBoltzmannPos hTemperaturePos branchLaw

/--
Measurable collapse-cost comparison: for any finite-type PMF whose support cardinality
matches a live frontier, and any achievable deterministic collapse of that frontier,
the Landauer heat of the PMF's entropy is bounded above by the Landauer heat of
the collapse cost. This is expressed through `countableLandauerHeatLowerBoundENN`,
which reduces to the earlier real-valued finite heat and then lifts
`achievable_collapse_finite_entropy_landauer_heat_le_total_cost`.
-/
theorem countable_collapse_landauer_heat_le_total_cost
    {α : Type*} [Fintype α] [Nonempty α]
    (branchLaw : PMF α)
    {start : List BranchSnapshot}
    {cost : Nat}
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (hCard : Fintype.card α = liveBranchCount start)
    (hAchievable : CollapseCostAchievableFrom start cost) :
    countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw ≤
      ENNReal.ofReal (landauerHeatLowerBound boltzmannConstant temperature cost) :=
by
  rw [countable_landauer_heat_lower_boundENN_eq_finite hBoltzmannNonneg hTemperatureNonneg]
  exact ENNReal.ofReal_le_ofReal
    (achievable_collapse_finite_entropy_landauer_heat_le_total_cost
      branchLaw hBoltzmannNonneg hTemperatureNonneg hCard hAchievable)

theorem observed_branch_entropy_bitsENN_eq_finite
    {α β : Type*} [Fintype β]
    (branchLaw : PMF α)
    (observable : α → β) :
    observedBranchEntropyBitsENN branchLaw observable =
      ENNReal.ofReal (finiteBranchEntropyBits (branchLaw.map observable)) := by
  unfold observedBranchEntropyBitsENN
  exact countable_branch_entropy_bitsENN_eq_finite
    (branchLaw := branchLaw.map observable)

theorem observed_branch_entropy_bitsENN_le_frontier_entropy_bits
    {α β : Type*} [Fintype β] [Nonempty β]
    (branchLaw : PMF α)
    (observable : α → β) :
    observedBranchEntropyBitsENN branchLaw observable ≤
      ENNReal.ofReal (equiprobableFrontierEntropyBits (Fintype.card β)) := by
  unfold observedBranchEntropyBitsENN
  exact countable_branch_entropy_bitsENN_le_frontier_entropy_bits
    (branchLaw := branchLaw.map observable)

theorem observed_branch_entropy_bitsENN_le_failure_tax
    {α β : Type*} [Fintype β] [Nonempty β]
    (branchLaw : PMF α)
    (observable : α → β) :
    observedBranchEntropyBitsENN branchLaw observable ≤
      ENNReal.ofReal (deterministicCollapseFailureTax (Fintype.card β)) := by
  unfold observedBranchEntropyBitsENN
  exact countable_branch_entropy_bitsENN_le_failure_tax
    (branchLaw := branchLaw.map observable)

theorem observed_branch_entropy_bitsENN_eq_failure_tax_iff
    {α β : Type*} [Fintype β] [Nonempty β]
    (branchLaw : PMF α)
    (observable : α → β) :
    observedBranchEntropyBitsENN branchLaw observable =
        ENNReal.ofReal (deterministicCollapseFailureTax (Fintype.card β)) ↔
      branchLaw.map observable = PMF.uniformOfFintype β ∧
        (Fintype.card β = 1 ∨ Fintype.card β = 2) := by
  unfold observedBranchEntropyBitsENN
  exact countable_branch_entropy_bitsENN_eq_failure_tax_iff
    (branchLaw := branchLaw.map observable)

theorem observed_landauer_heat_lower_boundENN_eq_finite
    {α β : Type*} [Fintype β]
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (branchLaw : PMF α)
    (observable : α → β) :
    observedLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw observable =
      ENNReal.ofReal (landauerHeatLowerBound boltzmannConstant temperature
        (finiteBranchEntropyBits (branchLaw.map observable))) := by
  unfold observedLandauerHeatLowerBoundENN
  exact countable_landauer_heat_lower_boundENN_eq_finite
    hBoltzmannNonneg hTemperatureNonneg (branchLaw := branchLaw.map observable)

theorem observed_landauer_heat_le_failure_tax_budget
    {α β : Type*} [Fintype β] [Nonempty β]
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (branchLaw : PMF α)
    (observable : α → β) :
    observedLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw observable ≤
      ENNReal.ofReal (failureTaxHeatBudget boltzmannConstant temperature (Fintype.card β)) := by
  unfold observedLandauerHeatLowerBoundENN
  exact countable_landauer_heat_le_failure_tax_budget
    hBoltzmannNonneg hTemperatureNonneg (branchLaw := branchLaw.map observable)

theorem observed_landauer_heat_eq_failure_tax_budget_iff
    {α β : Type*} [Fintype β] [Nonempty β]
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannPos : 0 < boltzmannConstant)
    (hTemperaturePos : 0 < temperature)
    (branchLaw : PMF α)
    (observable : α → β) :
    observedLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw observable =
      ENNReal.ofReal (failureTaxHeatBudget boltzmannConstant temperature (Fintype.card β)) ↔
        branchLaw.map observable = PMF.uniformOfFintype β ∧
          (Fintype.card β = 1 ∨ Fintype.card β = 2) := by
  unfold observedLandauerHeatLowerBoundENN
  exact countable_landauer_heat_eq_failure_tax_budget_iff
    hBoltzmannPos hTemperaturePos (branchLaw := branchLaw.map observable)

theorem observed_collapse_landauer_heat_le_total_cost
    {α β : Type*} [Fintype β] [Nonempty β]
    (branchLaw : PMF α)
    (observable : α → β)
    {start : List BranchSnapshot}
    {cost : Nat}
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (hCard : Fintype.card β = liveBranchCount start)
    (hAchievable : CollapseCostAchievableFrom start cost) :
    observedLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw observable ≤
      ENNReal.ofReal (landauerHeatLowerBound boltzmannConstant temperature cost) := by
  unfold observedLandauerHeatLowerBoundENN
  exact countable_collapse_landauer_heat_le_total_cost
    (branchLaw := branchLaw.map observable)
    hBoltzmannNonneg hTemperatureNonneg hCard hAchievable

/--
Frontier entropy equals failure tax if and only if liveBranches ≤ 2.
For n = 1: both are 0. For n = 2: both are 1 (by `frontier_entropy_bits_two`).
For n ≥ 3: entropy < tax (strict inequality from `frontier_entropy_bits_lt_failure_tax_of_three_le`).
-/
theorem frontier_entropy_bits_eq_failure_tax_iff_le_two
    {liveBranches : Nat}
    (hLive : 0 < liveBranches) :
    equiprobableFrontierEntropyBits liveBranches = deterministicCollapseFailureTax liveBranches ↔
      liveBranches ≤ 2 := by
  constructor
  · intro hEq
    have hOr := (frontier_entropy_bits_eq_failure_tax_iff hLive).1 hEq
    cases hOr with
    | inl h => omega
    | inr h => omega
  · intro hLe
    have hOr : liveBranches = 1 ∨ liveBranches = 2 := by omega
    exact (frontier_entropy_bits_eq_failure_tax_iff hLive).2 hOr

/--
For n ≥ 3, frontier entropy is strictly less than the failure tax.
This sharpens the paper: the failure-tax floor strictly dominates entropy
for all non-binary forks, so the "tax exceeds information cost" story
holds beyond the calibration point.
-/
theorem frontier_entropy_bits_lt_failure_tax_of_three_or_more
    {liveBranches : Nat}
    (hLive : 3 ≤ liveBranches) :
    equiprobableFrontierEntropyBits liveBranches <
      deterministicCollapseFailureTax liveBranches :=
  frontier_entropy_bits_lt_failure_tax_of_three_le hLive

/--
Restrict a PMF to a Finset that covers its support. If `branchLaw a = 0` for all `a ∉ s`,
the resulting PMF on `↥s` has the same mass distribution and the same entropy.
-/
private noncomputable def restrictPMFToSupportFinset
    {α : Type*}
    (branchLaw : PMF α)
    (s : Finset α)
    (hSupport : ∀ a, a ∉ s → branchLaw a = 0) : PMF ↥s where
  val := fun ⟨a, _⟩ => branchLaw a
  property := by
    have hSum : ∑ x : ↥s, branchLaw ↑x = 1 := by
      calc ∑ x : ↥s, branchLaw ↑x
          = ∑ a ∈ s, branchLaw a := by rw [← Finset.sum_coe_sort s]
        _ = ∑' a, branchLaw a := (tsum_eq_sum (fun a ha => hSupport a ha)).symm
        _ = 1 := branchLaw.tsum_coe
    exact hSum ▸ hasSum_fintype _

private theorem negMulLog_zero_of_pmf_zero
    {α : Type*}
    (branchLaw : PMF α)
    {a : α}
    (ha : branchLaw a = 0) :
    ENNReal.ofReal (Real.negMulLog (branchLaw a).toReal) = 0 := by
  simp [ha]

/--
When the PMF vanishes outside a Finset, the countable-support entropy tsum reduces to
the finite entropy of the restricted PMF on that Finset.
-/
private theorem countable_entropy_natsENN_eq_restricted
    {α : Type*}
    (branchLaw : PMF α)
    (s : Finset α)
    (hSupport : ∀ a, a ∉ s → branchLaw a = 0) :
    countableBranchEntropyNatsENN branchLaw =
      ENNReal.ofReal (finiteBranchEntropyNats
        (restrictPMFToSupportFinset branchLaw s hSupport)) := by
  unfold countableBranchEntropyNatsENN finiteBranchEntropyNats restrictPMFToSupportFinset
  simp only
  rw [tsum_eq_sum (fun a ha => negMulLog_zero_of_pmf_zero branchLaw (hSupport a ha))]
  rw [← Finset.sum_coe_sort s]
  symm
  exact ENNReal.ofReal_sum_of_nonneg
    (fun x _ => branch_entropy_term_nonneg branchLaw ↑x)

/--
Effective-support entropy bound (nats): for any PMF whose support is contained in a
Finset `s`, the countable-support Shannon entropy in nats is bounded by `log(s.card)`.
This closes the measurable erasure gap for arbitrary branch laws with finite effective support.
-/
theorem effective_support_entropy_natsENN_le_log_card
    {α : Type*}
    (branchLaw : PMF α)
    (s : Finset α)
    (hSupport : ∀ a, a ∉ s → branchLaw a = 0)
    (hNonempty : s.Nonempty) :
    countableBranchEntropyNatsENN branchLaw ≤
      ENNReal.ofReal (Real.log s.card) := by
  rw [countable_entropy_natsENN_eq_restricted branchLaw s hSupport]
  have : Nonempty ↥s := hNonempty.coe_sort
  exact ENNReal.ofReal_le_ofReal (by
    have hBound := finite_branch_entropy_nats_le_log_card
      (restrictPMFToSupportFinset branchLaw s hSupport)
    simp only [Fintype.card_coe] at hBound
    exact hBound)

/--
Effective-support entropy bound (bits): for any PMF whose support is contained in a
Finset `s`, the countable-support Shannon entropy in bits is bounded by the
equiprobable frontier entropy `log₂(s.card)`.
-/
theorem effective_support_entropy_bitsENN_le_frontier_entropy_bits
    {α : Type*}
    (branchLaw : PMF α)
    (s : Finset α)
    (hSupport : ∀ a, a ∉ s → branchLaw a = 0)
    (hNonempty : s.Nonempty) :
    countableBranchEntropyBitsENN branchLaw ≤
      ENNReal.ofReal (equiprobableFrontierEntropyBits s.card) := by
  have : Nonempty ↥s := hNonempty.coe_sort
  unfold countableBranchEntropyBitsENN
  rw [countable_entropy_natsENN_eq_restricted branchLaw s hSupport]
  rw [← countable_branch_entropy_natsENN_eq_finite]
  have hBound := countable_branch_entropy_bitsENN_le_frontier_entropy_bits
    (restrictPMFToSupportFinset branchLaw s hSupport)
  simp only [Fintype.card_coe] at hBound
  unfold countableBranchEntropyBitsENN at hBound
  exact hBound

/--
Effective-support entropy bound (failure tax): for any PMF whose support is contained in
a Finset `s`, the countable-support Shannon entropy in bits is bounded by the
deterministic-collapse failure tax `s.card - 1`.
-/
theorem effective_support_entropy_bitsENN_le_failure_tax
    {α : Type*}
    (branchLaw : PMF α)
    (s : Finset α)
    (hSupport : ∀ a, a ∉ s → branchLaw a = 0)
    (hNonempty : s.Nonempty) :
    countableBranchEntropyBitsENN branchLaw ≤
      ENNReal.ofReal (deterministicCollapseFailureTax s.card) := by
  exact le_trans
    (effective_support_entropy_bitsENN_le_frontier_entropy_bits branchLaw s hSupport hNonempty)
    (ENNReal.ofReal_le_ofReal
      (frontier_entropy_bits_le_failure_tax (Finset.Nonempty.card_pos hNonempty)))

/--
When the PMF vanishes outside a Finset, the countable-support Landauer heat equals the
Landauer heat of the restricted PMF's finite entropy. This bridges the ENNReal tsum
product to the real-valued `landauerHeatLowerBound`.
-/
private theorem countable_heat_eq_restricted_landauer_heat
    {α : Type*}
    (branchLaw : PMF α)
    (s : Finset α)
    (hSupport : ∀ a, a ∉ s → branchLaw a = 0)
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature) :
    countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw =
      ENNReal.ofReal (landauerHeatLowerBound boltzmannConstant temperature
        (finiteBranchEntropyBits
          (restrictPMFToSupportFinset branchLaw s hSupport))) := by
  have hCoeff : 0 ≤ boltzmannConstant * temperature := by positivity
  have hLogTwoPos : 0 < Real.log 2 := Real.log_pos (by norm_num)
  have hLogTwoNe : Real.log 2 ≠ 0 := ne_of_gt hLogTwoPos
  unfold countableLandauerHeatLowerBoundENN
  rw [countable_entropy_natsENN_eq_restricted branchLaw s hSupport]
  calc
    ENNReal.ofReal (boltzmannConstant * temperature) *
        ENNReal.ofReal (finiteBranchEntropyNats
          (restrictPMFToSupportFinset branchLaw s hSupport)) =
      ENNReal.ofReal ((boltzmannConstant * temperature) *
        finiteBranchEntropyNats
          (restrictPMFToSupportFinset branchLaw s hSupport)) := by
        rw [← ENNReal.ofReal_mul hCoeff]
    _ = ENNReal.ofReal (landauerHeatLowerBound boltzmannConstant temperature
          (finiteBranchEntropyBits
            (restrictPMFToSupportFinset branchLaw s hSupport))) := by
        congr 1
        unfold landauerHeatLowerBound finiteBranchEntropyBits
        field_simp [hLogTwoNe]

/--
Effective-support Landauer heat bound: for any PMF whose support is contained in a
Finset `s`, the countable-support Landauer heat is bounded by the failure-tax heat budget.
-/
theorem effective_support_landauer_heat_le_failure_tax_budget
    {α : Type*}
    (branchLaw : PMF α)
    (s : Finset α)
    (hSupport : ∀ a, a ∉ s → branchLaw a = 0)
    (hNonempty : s.Nonempty)
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature) :
    countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw ≤
      ENNReal.ofReal (failureTaxHeatBudget boltzmannConstant temperature s.card) := by
  have : Nonempty ↥s := hNonempty.coe_sort
  rw [countable_heat_eq_restricted_landauer_heat branchLaw s hSupport
    hBoltzmannNonneg hTemperatureNonneg]
  have hBound := finite_landauer_heat_le_failure_tax_budget
    hBoltzmannNonneg hTemperatureNonneg
    (restrictPMFToSupportFinset branchLaw s hSupport)
  simp only [Fintype.card_coe] at hBound
  exact ENNReal.ofReal_le_ofReal hBound

/--
Effective-support collapse-cost comparison: for any PMF whose support is contained in
a Finset `s` of size matching a live frontier, and any achievable deterministic collapse
of that frontier, the Landauer heat of the PMF's entropy is bounded by the Landauer heat
of the collapse cost.
-/
theorem effective_support_collapse_landauer_heat_le_total_cost
    {α : Type*}
    (branchLaw : PMF α)
    (s : Finset α)
    (hSupport : ∀ a, a ∉ s → branchLaw a = 0)
    (hNonempty : s.Nonempty)
    {start : List BranchSnapshot}
    {cost : Nat}
    {boltzmannConstant temperature : ℝ}
    (hBoltzmannNonneg : 0 ≤ boltzmannConstant)
    (hTemperatureNonneg : 0 ≤ temperature)
    (hCard : s.card = liveBranchCount start)
    (hAchievable : CollapseCostAchievableFrom start cost) :
    countableLandauerHeatLowerBoundENN boltzmannConstant temperature branchLaw ≤
      ENNReal.ofReal (landauerHeatLowerBound boltzmannConstant temperature cost) := by
  have : Nonempty ↥s := hNonempty.coe_sort
  rw [countable_heat_eq_restricted_landauer_heat branchLaw s hSupport
    hBoltzmannNonneg hTemperatureNonneg]
  have hBound := achievable_collapse_finite_entropy_landauer_heat_le_total_cost
    (restrictPMFToSupportFinset branchLaw s hSupport)
    hBoltzmannNonneg hTemperatureNonneg
    (by simp only [Fintype.card_coe]; exact hCard) hAchievable
  exact ENNReal.ofReal_le_ofReal hBound

end ForkRaceFoldTheorems
