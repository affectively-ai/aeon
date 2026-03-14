import Mathlib
import ForkRaceFoldTheorems.CoarseningThermodynamics
import ForkRaceFoldTheorems.RecursiveCoarseningSynthesis
import ForkRaceFoldTheorems.LandauerBeautyBridge

open scoped BigOperators ENNReal

namespace ForkRaceFoldTheorems

/-!
# Rate-Distortion Frontier for Network Coarsening

Track 2: Given multiple possible many-to-one quotients of a fine network,
there exists a Pareto-optimal frontier trading off information erasure (rate)
against model fidelity loss (distortion).

Key results:
- Every nonempty family of quotients has a minimum-rate member
- Heat is proportional to rate, so minimum rate = minimum heat
- Further coarsening monotonically increases rate (thermodynamic arrow)
- A Pareto-optimal quotient exists in any nonempty family with monotone distortion
- The minimum-rate quotient gives the tightest (weakest) beauty constraint
-/

/-! ### QuotientCandidate -/

/-- A quotient candidate bundles a many-to-one quotient map α → β with witness
    that at least one fiber is non-injective (two distinct fine nodes with
    positive mass map to the same coarse node). -/
structure QuotientCandidate
    {α : Type*} (β : Type*) [Fintype α] [Fintype β] [DecidableEq β]
    (branchLaw : PMF α) where
  quotientMap : α → β
  hManyToOne : ∃ a₁ a₂, a₁ ≠ a₂ ∧
    quotientMap a₁ = quotientMap a₂ ∧
    0 < branchLaw a₁ ∧ 0 < branchLaw a₂

/-! ### DistortionMeasure -/

/-- An abstract distortion measure assigns a non-negative real distortion to each
    quotient map, with monotonicity: if q₂ is coarser than q₁ (i.e., q₁ factors
    through q₂ via some g), then distortion(q₁) ≤ distortion(q₂). -/
structure DistortionMeasure
    (α β : Type*) [Fintype α] [Fintype β] [DecidableEq β] where
  distortion : (α → β) → ℝ
  distortion_nonneg : ∀ f, 0 ≤ distortion f
  distortion_monotone : ∀ (f : α → β) (g : β → β),
    distortion f ≤ distortion (g ∘ f)

/-! ### RateDistortionPoint -/

/-- A rate-distortion point records the three costs of a particular quotient:
    - rate: information erasure (conditional entropy H(fine | coarse))
    - distortion: model fidelity loss
    - heat: Landauer heat = kT ln 2 * rate -/
structure RateDistortionPoint where
  rate : ℝ
  distortion : ℝ
  heat : ℝ

/-! ### Computing a RateDistortionPoint from a quotient candidate -/

/-- Given a PMF, temperature parameters, distortion measure, and quotient candidate,
    compute the associated rate-distortion point. -/
noncomputable def quotientToRateDistortionPoint
    {α β : Type*} [Fintype α] [Fintype β] [DecidableEq β]
    (branchLaw : PMF α)
    (boltzmannConstant temperature : ℝ)
    (dm : DistortionMeasure α β)
    (qc : QuotientCandidate β branchLaw) : RateDistortionPoint where
  rate := coarseningInformationLoss branchLaw qc.quotientMap
  distortion := dm.distortion qc.quotientMap
  heat := coarseningLandauerHeat boltzmannConstant temperature branchLaw qc.quotientMap

/-! ### Heat = kT ln 2 * rate (definitional identity) -/

/-- The Landauer heat of a quotient is exactly kT ln 2 times the information loss rate.
    This is a definitional unfolding: both sides reduce to
    boltzmannConstant * temperature * Real.log 2 * conditionalEntropyNats branchLaw q. -/
theorem rate_distortion_heat_identity
    {α β : Type*} [Fintype α] [Fintype β] [DecidableEq β]
    (branchLaw : PMF α)
    (boltzmannConstant temperature : ℝ)
    (quotient : α → β) :
    coarseningLandauerHeat boltzmannConstant temperature branchLaw quotient =
      boltzmannConstant * temperature * Real.log 2 *
        coarseningInformationLoss branchLaw quotient := by
  unfold coarseningLandauerHeat landauerHeatLowerBound coarseningInformationLoss
  ring

/-! ### QuotientFamily -/

/-- A family of quotient candidates, represented as a Finset. The family is the
    search space over which we optimize rate-distortion trade-offs. -/
structure QuotientFamily
    {α : Type*} (β : Type*) [Fintype α] [Fintype β] [DecidableEq β]
    (branchLaw : PMF α) where
  candidates : Finset (QuotientCandidate β branchLaw)

/-! ### Minimum-rate quotient exists -/

/-- In any nonempty quotient family, there exists a candidate achieving the minimum
    information erasure rate. -/
theorem minimum_rate_quotient_exists
    {α β : Type*} [Fintype α] [Fintype β] [DecidableEq β]
    (branchLaw : PMF α)
    (family : QuotientFamily β branchLaw)
    (hNonempty : family.candidates.Nonempty) :
    ∃ qMin ∈ family.candidates,
      ∀ q ∈ family.candidates,
        coarseningInformationLoss branchLaw qMin.quotientMap ≤
          coarseningInformationLoss branchLaw q.quotientMap := by
  obtain ⟨qMin, hqMin, hMin⟩ := family.candidates.exists_min_image
    (fun q => coarseningInformationLoss branchLaw q.quotientMap) hNonempty
  exact ⟨qMin, hqMin, hMin⟩

/-! ### Minimum-heat quotient exists -/

/-- In any nonempty quotient family with kT > 0, the minimum-rate quotient also
    achieves minimum Landauer heat, since heat = kT ln 2 * rate and kT ln 2 > 0. -/
theorem minimum_heat_quotient_exists
    {α β : Type*} [Fintype α] [Fintype β] [DecidableEq β]
    (branchLaw : PMF α)
    (boltzmannConstant temperature : ℝ)
    (hkPos : 0 < boltzmannConstant) (hTPos : 0 < temperature)
    (family : QuotientFamily β branchLaw)
    (hNonempty : family.candidates.Nonempty) :
    ∃ qMin ∈ family.candidates,
      ∀ q ∈ family.candidates,
        coarseningLandauerHeat boltzmannConstant temperature branchLaw qMin.quotientMap ≤
          coarseningLandauerHeat boltzmannConstant temperature branchLaw q.quotientMap := by
  obtain ⟨qMin, hqMin, hMin⟩ := minimum_rate_quotient_exists branchLaw family hNonempty
  refine ⟨qMin, hqMin, fun q hq => ?_⟩
  simp only [rate_distortion_heat_identity]
  apply mul_le_mul_of_nonneg_left (hMin q hq)
  apply mul_nonneg
  · apply mul_nonneg (le_of_lt hkPos) (le_of_lt hTPos)
  · exact le_of_lt (Real.log_pos (by norm_num))

/-! ### Rate monotone under refinement -/

/-- If quotient q₂ is coarser than q₁ (q₁ factors through q₂ via some g, so
    q₂ = g ∘ q₁), then rate(q₁) ≤ rate(q₂). This is exactly
    cumulative_coarsening_monotone restated in rate-distortion language. -/
theorem rate_monotone_under_refinement
    {α β γ : Type*} [Fintype α] [Fintype β] [Fintype γ]
    [DecidableEq β] [DecidableEq γ]
    (branchLaw : PMF α) (f : α → β) (g : β → γ) :
    coarseningInformationLoss branchLaw f ≤
      coarseningInformationLoss branchLaw (g ∘ f) :=
  cumulative_coarsening_monotone branchLaw f g

/-! ### Pareto frontier exists -/

/-- A quotient q is Pareto-dominated in a family if there exists another quotient
    that is strictly better in both rate and distortion. -/
def paretoDominated
    {α β : Type*} [Fintype α] [Fintype β] [DecidableEq β]
    (branchLaw : PMF α)
    (dm : DistortionMeasure α β)
    (family : QuotientFamily β branchLaw)
    (q : QuotientCandidate β branchLaw) : Prop :=
  ∃ q' ∈ family.candidates,
    coarseningInformationLoss branchLaw q'.quotientMap <
      coarseningInformationLoss branchLaw q.quotientMap ∧
    dm.distortion q'.quotientMap < dm.distortion q.quotientMap

/-- In any nonempty quotient family with a monotone distortion measure, there exists
    a Pareto-optimal quotient: one that is not dominated by any other candidate
    in both rate and distortion simultaneously.

    Proof: the minimum-rate candidate cannot be Pareto-dominated, since no candidate
    has strictly lower rate. -/
theorem pareto_frontier_exists
    {α β : Type*} [Fintype α] [Fintype β] [DecidableEq β]
    (branchLaw : PMF α)
    (dm : DistortionMeasure α β)
    (family : QuotientFamily β branchLaw)
    (hNonempty : family.candidates.Nonempty) :
    ∃ q ∈ family.candidates,
      ¬ paretoDominated branchLaw dm family q := by
  obtain ⟨qMin, hqMin, hMin⟩ := minimum_rate_quotient_exists branchLaw family hNonempty
  refine ⟨qMin, hqMin, ?_⟩
  intro ⟨q', hq', hRate, _⟩
  exact absurd hRate (not_lt.mpr (hMin q' hq'))

/-! ### Optimal quotient beauty bound -/

/-- The minimum-rate quotient in a family produces the smallest Landauer heat,
    which gives the weakest (most permissive) beauty constraint. Coarser quotients
    have strictly more heat, giving stricter beauty floors.

    Concretely: for any other quotient q in the family,
    heat(qMin) ≤ heat(q), so the beauty floor induced by qMin is no stricter
    than the floor induced by q. This follows from heat = kT ln 2 * rate
    and rate-minimality of qMin. -/
theorem optimal_quotient_beauty_bound
    {α β : Type*} [Fintype α] [Fintype β] [DecidableEq β]
    (branchLaw : PMF α)
    (boltzmannConstant temperature : ℝ)
    (hkPos : 0 < boltzmannConstant) (hTPos : 0 < temperature)
    (family : QuotientFamily β branchLaw)
    (hNonempty : family.candidates.Nonempty) :
    ∃ qMin ∈ family.candidates,
      ∀ q ∈ family.candidates,
        coarseningLandauerHeat boltzmannConstant temperature branchLaw qMin.quotientMap ≤
          coarseningLandauerHeat boltzmannConstant temperature branchLaw q.quotientMap := by
  exact minimum_heat_quotient_exists branchLaw boltzmannConstant temperature hkPos hTPos
    family hNonempty

end ForkRaceFoldTheorems
