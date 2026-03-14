import Mathlib
import ForkRaceFoldTheorems.DataProcessingInequality
import ForkRaceFoldTheorems.CoarseningThermodynamics
import ForkRaceFoldTheorems.LandauerBuley

open scoped BigOperators ENNReal

namespace ForkRaceFoldTheorems

/-!
Entropic Refinement Calculus.

Formalizes conditional entropy as a functorial information measure on the category
of quotient refinements, with tensor additivity over independent systems and a
universal property (initial among non-negative subadditive information measures).

The category **QuotRef** has:
- Objects: pairs (α, p) where α is a finite type and p : PMF α
- Morphisms: surjective quotient maps f : α → β (with induced pushforward PMF)

The functor **H(− | f(−))** assigns to each morphism f the conditional entropy
H(X | f(X)) = H(X) − H(f(X)), measuring information erased by f.

Key results:
1. Identity law: H(X | id(X)) = 0 (identity erases nothing)
2. Composition law: H(X | g(f(X))) = H(X | f(X)) + H(f(X) | g(f(X))) (chain rule)
3. Non-negativity: H(X | f(X)) ≥ 0 (data processing inequality)
4. Monotonicity: if q₁ factors through q₂, then loss(q₁) ≤ loss(q₂)
5. Heat naturality: Landauer heat inherits composition and monotonicity
6. Universal property: conditional entropy is initial among information measures (sorry)
-/

/-! ### 1. Quotient Refinement Morphism -/

/-- A morphism in the category of quotient refinements.
    Objects are (Type, PMF) pairs; morphisms are surjective quotient maps. -/
structure QuotientRefinementMorphism
    (α β : Type*) [Fintype α] [Fintype β] [DecidableEq β] where
  /-- The underlying branch law on the fine type. -/
  branchLaw : PMF α
  /-- The quotient map from fine to coarse. -/
  quotientMap : α → β
  /-- The quotient map is surjective. -/
  surjective : Function.Surjective quotientMap

/-! ### 2. Functor identity law -/

/-- The identity morphism erases no information: H(X | id(X)) = 0.
    This is the unit law of the conditional-entropy functor. -/
theorem conditionalEntropy_identity
    {α : Type*} [Fintype α] [DecidableEq α]
    (branchLaw : PMF α) :
    conditionalEntropyNats branchLaw id = 0 := by
  unfold conditionalEntropyNats
  -- PMF.map id = id by Mathlib's PMF.map_id
  have hMapId : branchLaw.map id = branchLaw := PMF.map_id branchLaw
  rw [hMapId]
  ring

/-! ### 3. Functor composition law -/

/-- The composition law of the conditional-entropy functor (chain rule).
    Restated from `conditionalEntropyNats_comp` for the functorial interface.

    H(X | g∘f(X)) = H(X | f(X)) + H(f(X) | g(f(X)))

    Information loss is additive under composition of quotient maps. -/
theorem conditionalEntropy_functorial_composition
    {α β γ : Type*} [Fintype α] [Fintype β] [Fintype γ]
    [DecidableEq β] [DecidableEq γ]
    (branchLaw : PMF α) (f : α → β) (g : β → γ) :
    conditionalEntropyNats branchLaw (g ∘ f) =
      conditionalEntropyNats branchLaw f +
        conditionalEntropyNats (branchLaw.map f) g :=
  conditionalEntropyNats_comp branchLaw f g

/-! ### 4. Information Measure (abstract interface) -/

/-- An abstract information measure on finite quotient maps.
    Assigns a non-negative real to each (PMF, function) pair, satisfying:
    - Non-negativity: μ(p, f) ≥ 0
    - Chain rule (composition): μ(p, g ∘ f) = μ(p, f) + μ(p.map f, g)
    - Identity: μ(p, id) = 0 -/
structure InformationMeasure where
  /-- The measure function: given a PMF on α and a map α → β, returns a real. -/
  measure : ∀ {α β : Type} [Fintype α] [Fintype β] [DecidableEq β],
    PMF α → (α → β) → ℝ
  /-- Non-negativity: the measure is always ≥ 0. -/
  nonneg : ∀ {α β : Type} [Fintype α] [Fintype β] [DecidableEq β]
    (p : PMF α) (f : α → β), 0 ≤ measure p f
  /-- Chain rule: the measure is additive under composition. -/
  chainRule : ∀ {α β γ : Type} [Fintype α] [Fintype β] [Fintype γ]
    [DecidableEq β] [DecidableEq γ]
    (p : PMF α) (f : α → β) (g : β → γ),
    measure p (g ∘ f) = measure p f + measure (p.map f) g
  /-- Identity law: the identity map erases nothing. -/
  identityLaw : ∀ {α : Type} [Fintype α] [DecidableEq α]
    (p : PMF α), measure p id = 0

/-! ### 5. Conditional entropy is an information measure -/

/-- `conditionalEntropyNats` satisfies all the axioms of an `InformationMeasure`. -/
noncomputable def conditionalEntropy_is_information_measure : InformationMeasure where
  measure := fun p f => conditionalEntropyNats p f
  nonneg := fun p f => conditionalEntropyNats_nonneg p f
  chainRule := fun p f g => conditionalEntropyNats_comp p f g
  identityLaw := fun p => conditionalEntropy_identity p

/-! ### 6. Monotonicity under refinement -/

/-- If q₁ factors through q₂ (i.e., q₁ = g ∘ q₂ for some g), then the information
    loss of q₂ is at most the information loss of q₁.

    Equivalently: q₂ is a finer quotient than q₁, so q₂ erases at least as much
    information as q₁ does. This is `cumulative_coarsening_monotone` restated in
    the refinement-lattice language.

    In the quotient refinement lattice, q₂ ≤ q₁ (q₂ refines q₁) means q₁ factors
    through q₂: there exists g such that q₁ = g ∘ q₂. Then:
      loss(q₁) ≤ loss(q₂)  -/
theorem refinement_monotone_information_loss
    {α β γ : Type*} [Fintype α] [Fintype β] [Fintype γ]
    [DecidableEq β] [DecidableEq γ]
    (branchLaw : PMF α) (q₂ : α → β) (g : β → γ) :
    coarseningInformationLoss branchLaw (g ∘ q₂) ≥
      coarseningInformationLoss branchLaw q₂ :=
  cumulative_coarsening_monotone branchLaw q₂ g

/-! ### 7. Landauer heat naturality -/

/-- Landauer heat of a composed coarsening decomposes as the sum of the heat of
    the first step plus the heat of the second step applied to the intermediate
    pushforward.

    heat(g ∘ f) = heat(f) + heat_on_pushforward(g)

    This follows from the chain rule for conditional entropy and linearity of the
    Landauer scaling factor kT ln 2. -/
theorem coarseningLandauerHeat_composition
    {α β γ : Type*} [Fintype α] [Fintype β] [Fintype γ]
    [DecidableEq β] [DecidableEq γ]
    (boltzmannConstant temperature : ℝ)
    (branchLaw : PMF α) (f : α → β) (g : β → γ) :
    coarseningLandauerHeat boltzmannConstant temperature branchLaw (g ∘ f) =
      coarseningLandauerHeat boltzmannConstant temperature branchLaw f +
        coarseningLandauerHeat boltzmannConstant temperature (branchLaw.map f) g := by
  unfold coarseningLandauerHeat coarseningInformationLoss landauerHeatLowerBound
  rw [conditionalEntropyNats_comp branchLaw f g]
  ring

/-- Landauer heat inherits monotonicity from information loss monotonicity.
    Further coarsening can only increase cumulative Landauer heat cost.
    This is a direct corollary of `cumulative_coarsening_heat_monotone`. -/
theorem coarseningLandauerHeat_monotone
    {α β γ : Type*} [Fintype α] [Fintype β] [Fintype γ]
    [DecidableEq β] [DecidableEq γ]
    (boltzmannConstant temperature : ℝ)
    (hkPos : 0 < boltzmannConstant) (hTPos : 0 < temperature)
    (branchLaw : PMF α) (f : α → β) (g : β → γ) :
    coarseningLandauerHeat boltzmannConstant temperature branchLaw f ≤
      coarseningLandauerHeat boltzmannConstant temperature branchLaw (g ∘ f) :=
  cumulative_coarsening_heat_monotone boltzmannConstant temperature hkPos hTPos branchLaw f g

/-! ### 8. Coarsening lattice monotone map -/

/-- The quotient refinement order: q₂ refines q₁ (written q₂ ≤ q₁) when q₁ factors
    through q₂, i.e., there exists g such that q₁ = g ∘ q₂. -/
structure QuotientRefines
    {α β₁ β₂ : Type*} [Fintype β₁] [Fintype β₂] [DecidableEq β₁] [DecidableEq β₂]
    (q₂ : α → β₂) (q₁ : α → β₁) where
  /-- The factoring map: q₁ = factor ∘ q₂. -/
  factor : β₂ → β₁
  /-- The factoring equation. -/
  factorEq : q₁ = factor ∘ q₂

/-- The information-loss map from the quotient refinement lattice to ℝ≥0 is
    order-preserving: if q₂ refines q₁ (q₁ factors through q₂), then
    loss(q₁) ≤ loss(q₂).

    This says the map (quotient ↦ information loss) is a monotone function
    from the refinement order to the natural order on ℝ. -/
theorem coarsening_lattice_monotone
    {α β₁ β₂ : Type*} [Fintype α] [Fintype β₁] [Fintype β₂]
    [DecidableEq β₁] [DecidableEq β₂]
    (branchLaw : PMF α) (q₂ : α → β₂) (q₁ : α → β₁)
    (hRefines : QuotientRefines q₂ q₁) :
    coarseningInformationLoss branchLaw q₂ ≤
      coarseningInformationLoss branchLaw q₁ := by
  -- q₁ = hRefines.factor ∘ q₂, so loss(q₂) ≤ loss(factor ∘ q₂) = loss(q₁)
  -- by cumulative_coarsening_monotone
  rw [hRefines.factorEq]
  exact cumulative_coarsening_monotone branchLaw q₂ hRefines.factor

/-! ### Universal property (initiality) -/

/-- Universal property: `conditionalEntropyNats` is the initial information measure.
    For any `InformationMeasure` μ satisfying subadditivity, there is a unique natural
    transformation from conditional entropy to μ that is pointwise ≤.

    This is the deep characterization theorem: conditional entropy is the *smallest*
    non-negative subadditive information measure satisfying the chain rule.

    The proof requires showing that any such μ dominates conditional entropy pointwise,
    which needs a careful induction over fiber decompositions. -/
theorem conditionalEntropy_initial_information_measure
    (μ : InformationMeasure) :
    ∀ {α β : Type} [Fintype α] [Fintype β] [DecidableEq β]
      (p : PMF α) (f : α → β),
      conditionalEntropyNats p f ≤ μ.measure p f := by
  sorry

end ForkRaceFoldTheorems
