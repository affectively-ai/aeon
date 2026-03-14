import Mathlib
import ForkRaceFoldTheorems.JacksonQueueing
import ForkRaceFoldTheorems.MeasureQueueing

open MeasureTheory
open scoped ENNReal

namespace ForkRaceFoldTheorems

structure C1C4Model where
  c1ConstraintLocality : Prop
  c2BranchIsolation : Prop
  c3DeterministicFold : Prop
  c4BoundedTermination : Prop
  safety : Prop
  liveness : Prop
  safetyFromC1C2C3 :
    c1ConstraintLocality -> c2BranchIsolation -> c3DeterministicFold -> safety
  livenessFromC4 : c4BoundedTermination -> liveness

theorem c1_c4_imply_safety_and_liveness (model : C1C4Model) :
    model.c1ConstraintLocality ->
    model.c2BranchIsolation ->
    model.c3DeterministicFold ->
    model.c4BoundedTermination ->
    model.safety /\ model.liveness := by
  intro hC1 hC2 hC3 hC4
  exact
    And.intro
      (model.safetyFromC1C2C3 hC1 hC2 hC3)
      (model.livenessFromC4 hC4)

structure QueueContainmentAssumptions where
  beta1 : Nat
  occupancy : Nat
  arrivalRate : Nat
  residenceTime : Nat
  littleLawAtBetaZero : beta1 = 0 -> occupancy = arrivalRate * residenceTime
  topologyControlAtPositiveBeta : 0 < beta1 -> Exists fun controlWidth => 0 < controlWidth

theorem queueing_containment_at_beta1_zero (assumptions : QueueContainmentAssumptions) :
    assumptions.beta1 = 0 ->
    assumptions.occupancy = assumptions.arrivalRate * assumptions.residenceTime := by
  intro hBeta0
  exact assumptions.littleLawAtBetaZero hBeta0

theorem queueing_strict_extension_at_positive_beta (assumptions : QueueContainmentAssumptions) :
    0 < assumptions.beta1 -> Exists fun controlWidth => 0 < controlWidth := by
  intro hPositive
  exact assumptions.topologyControlAtPositiveBeta hPositive

structure QueueLimitAssumptions where
  finiteTruncationsBalanced : Nat -> Prop
  truncationsExhaustSupport : Prop
  monotoneSupportApproximation : Prop
  measurableCustomerTime : Prop
  measurableSojournTime : Prop
  integrableDominatingEnvelope : Prop
  limitBalance : Prop
  limitFromBalancedTruncations :
    truncationsExhaustSupport ->
    monotoneSupportApproximation ->
    measurableCustomerTime ->
    measurableSojournTime ->
    integrableDominatingEnvelope ->
    (∀ n, finiteTruncationsBalanced n) ->
    limitBalance

theorem queue_limit_schema (assumptions : QueueLimitAssumptions) :
    assumptions.truncationsExhaustSupport ->
    assumptions.monotoneSupportApproximation ->
    assumptions.measurableCustomerTime ->
    assumptions.measurableSojournTime ->
    assumptions.integrableDominatingEnvelope ->
    (∀ n, assumptions.finiteTruncationsBalanced n) ->
    assumptions.limitBalance := by
  intro hExhaust hMonotone hCustomer hSojourn hEnvelope hBalanced
  exact assumptions.limitFromBalancedTruncations
    hExhaust
    hMonotone
    hCustomer
    hSojourn
    hEnvelope
    hBalanced

def KernelBridgeWitness {Ω : Type*}
    (routingKernel : Ω → Ω → ℝ)
    (bridge : Ω) : Prop :=
  (∀ state, 0 < routingKernel state bridge) ∧
    ∀ state, 0 < routingKernel bridge state

def KernelIrreducible {Ω : Type*}
    (routingKernel : Ω → Ω → ℝ) : Prop :=
  ∃ bridge, KernelBridgeWitness routingKernel bridge

theorem kernelIrreducible_of_bridge
    {Ω : Type*}
    (routingKernel : Ω → Ω → ℝ)
    (bridge : Ω)
    (hToBridge : ∀ state, 0 < routingKernel state bridge)
    (hFromBridge : ∀ state, 0 < routingKernel bridge state) :
    KernelIrreducible routingKernel := by
  exact ⟨bridge, hToBridge, hFromBridge⟩

def KernelFosterLyapunovDrift {Ω : Type*}
    (expectedLyapunov lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ) : Prop :=
  ∀ state ∉ smallSet, expectedLyapunov state ≤ lyapunov state - driftGap

abbrev KernelPetiteSet {Ω : Type*}
    (smallSet : Set Ω) : Prop :=
  smallSet.Finite

def KernelPositiveRecurrent {Ω : Type*}
    (routingKernel : Ω → Ω → ℝ)
    (expectedLyapunov lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ) : Prop :=
  KernelIrreducible routingKernel ∧
    KernelFosterLyapunovDrift expectedLyapunov lyapunov smallSet driftGap ∧
    0 < driftGap

abbrev KernelStationaryLawExists {Ω : Type*}
    (routingKernel : Ω → Ω → ℝ)
    (expectedLyapunov lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ) : Prop :=
  KernelPositiveRecurrent routingKernel expectedLyapunov lyapunov smallSet driftGap

theorem kernelPositiveRecurrent_of_drift
    {Ω : Type*}
    {routingKernel : Ω → Ω → ℝ}
    {expectedLyapunov lyapunov : Ω → ℝ}
    {smallSet : Set Ω}
    {driftGap : ℝ}
    (hIrreducible : KernelIrreducible routingKernel)
    (hDrift : KernelFosterLyapunovDrift expectedLyapunov lyapunov smallSet driftGap)
    (hGap : 0 < driftGap) :
    KernelPositiveRecurrent routingKernel expectedLyapunov lyapunov smallSet driftGap := by
  exact ⟨hIrreducible, hDrift, hGap⟩

theorem kernelStationaryLawExists_of_positiveRecurrence
    {Ω : Type*}
    {routingKernel : Ω → Ω → ℝ}
    {expectedLyapunov lyapunov : Ω → ℝ}
    {smallSet : Set Ω}
    {driftGap : ℝ}
    (hPositive :
      KernelPositiveRecurrent routingKernel expectedLyapunov lyapunov smallSet driftGap) :
    KernelStationaryLawExists routingKernel expectedLyapunov lyapunov smallSet driftGap :=
  hPositive

theorem kernelFosterLyapunovDrift_of_expectedLyapunov_bound
    {Ω : Type*}
    {expectedLyapunov ceilingExpectedLyapunov lyapunov : Ω → ℝ}
    {smallSet : Set Ω}
    {driftGap : ℝ}
    (hCompare : ∀ state, expectedLyapunov state ≤ ceilingExpectedLyapunov state)
    (hCeilingDrift :
      ∀ state ∉ smallSet, ceilingExpectedLyapunov state ≤ lyapunov state - driftGap) :
    KernelFosterLyapunovDrift expectedLyapunov lyapunov smallSet driftGap := by
  intro state hState
  exact le_trans (hCompare state) (hCeilingDrift state hState)

section AdaptiveExpectedLyapunov

variable {ι Ω : Type*} [Fintype ι] [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω]

/--
Build the adaptive expected-Lyapunov ceiling from raw adaptive Jackson domination data and a
monotone lift from nodewise throughput bounds into the state-space Lyapunov observable.
-/
structure AdaptiveExpectedLyapunovSynthesis
    (expectedLyapunov : Ω → ℝ) where
  adaptiveTrafficData : AdaptiveJacksonTrafficData (ι := ι) (σ := Ω)
  ceilingTrafficData : JacksonTrafficData (ι := ι)
  arrivalLe : ∀ i, adaptiveTrafficData.externalArrival i ≤ ceilingTrafficData.externalArrival i
  routingLe : ∀ state i j, adaptiveTrafficData.routing state i j ≤ ceilingTrafficData.routing i j
  ceilingCandidate : ι → ℝ
  candidateNonneg : ∀ i, 0 ≤ ceilingCandidate i
  candidatePostfixed :
    ∀ i,
      ceilingTrafficData.externalArrival i +
          ∑ j, ceilingCandidate j * ceilingTrafficData.routing j i ≤
        ceilingCandidate i
  expectedLift : Ω → (ι → ℝ) → ℝ
  expectedLyapunovLeLift :
    ∀ schedule state,
      expectedLyapunov state ≤
        expectedLift state
          (fun i => (adaptiveTrafficData.constructiveThroughput schedule i).toReal)
  liftMonotone :
    ∀ state {lhs rhs : ι → ℝ},
      (∀ i, lhs i ≤ rhs i) ->
        expectedLift state lhs ≤ expectedLift state rhs

noncomputable def AdaptiveExpectedLyapunovSynthesis.ceilingExpectedLyapunov
    (synthesis : AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov) :
    Ω → ℝ :=
  fun state => synthesis.expectedLift state synthesis.ceilingCandidate

omit [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω] in
theorem AdaptiveExpectedLyapunovSynthesis.constructiveThroughput_toReal_le_ceilingCandidate
    (synthesis : AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (schedule : ℕ → Ω)
    (i : ι) :
    (synthesis.adaptiveTrafficData.constructiveThroughput schedule i).toReal ≤
      synthesis.ceilingCandidate i := by
  have hLe :
      synthesis.adaptiveTrafficData.constructiveThroughput schedule i ≤
        ENNReal.ofReal (synthesis.ceilingCandidate i) :=
    synthesis.adaptiveTrafficData.constructiveThroughput_le_of_dominating_real_postfixed
      schedule
      synthesis.ceilingTrafficData
      synthesis.arrivalLe
      synthesis.routingLe
      synthesis.ceilingCandidate
      synthesis.candidateNonneg
      synthesis.candidatePostfixed
      i
  exact ENNReal.toReal_le_of_le_ofReal (synthesis.candidateNonneg i) hLe

omit [Fintype Ω] [MeasurableSpace Ω] in
theorem AdaptiveExpectedLyapunovSynthesis.expectedLyapunov_le_ceilingExpectedLyapunov
    (synthesis : AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov) :
    ∀ state,
      expectedLyapunov state ≤ synthesis.ceilingExpectedLyapunov state := by
  classical
  let schedule : ℕ → Ω := fun _ => Classical.choice inferInstance
  intro state
  refine le_trans (synthesis.expectedLyapunovLeLift schedule state) ?_
  exact synthesis.liftMonotone state (fun i =>
    synthesis.constructiveThroughput_toReal_le_ceilingCandidate schedule i)

structure AdaptiveCeilingDriftSynthesis
    (expectedLyapunov : Ω → ℝ)
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ) where
  driftWeights : Ω → ι → ℝ
  driftWeightsNonneg : ∀ state i, 0 ≤ driftWeights state i
  driftReserve : Ω → ℝ
  ceilingExpectedEq :
    ∀ state,
      expectedLyapunovSynthesis.ceilingExpectedLyapunov state =
        lyapunov state - driftReserve state
  reserveEqWeightedSlack :
    ∀ state,
      driftReserve state =
        ∑ i, driftWeights state i *
          (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
            expectedLyapunovSynthesis.ceilingCandidate i)
  reserveCoversDriftGap :
    ∀ state ∉ smallSet, driftGap ≤ driftReserve state

noncomputable def AdaptiveCeilingDriftSynthesis.ofWeightedSlack
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ)
    (driftWeights : Ω → ι → ℝ)
    (driftWeightsNonneg : ∀ state i, 0 ≤ driftWeights state i)
    (ceilingExpectedEqWeightedSlack :
      ∀ state,
        expectedLyapunovSynthesis.ceilingExpectedLyapunov state =
          lyapunov state -
            ∑ i, driftWeights state i *
              (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
                expectedLyapunovSynthesis.ceilingCandidate i))
    (reserveCoversWeightedSlack :
      ∀ state ∉ smallSet,
        driftGap ≤
          ∑ i, driftWeights state i *
            (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
              expectedLyapunovSynthesis.ceilingCandidate i)) :
    AdaptiveCeilingDriftSynthesis
      (ι := ι)
      (Ω := Ω)
      expectedLyapunov
      expectedLyapunovSynthesis
      lyapunov
      smallSet
      driftGap where
  driftWeights := driftWeights
  driftWeightsNonneg := driftWeightsNonneg
  driftReserve := fun state =>
    ∑ i, driftWeights state i *
      (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
        expectedLyapunovSynthesis.ceilingCandidate i)
  ceilingExpectedEq := by
    intro state
    simpa using ceilingExpectedEqWeightedSlack state
  reserveEqWeightedSlack := by
    intro state
    rfl
  reserveCoversDriftGap := reserveCoversWeightedSlack

omit [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω] in
theorem reserveCoversWeightedSlack_of_normalizedWeights
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (smallSet : Set Ω)
    (driftGap : ℝ)
    (driftWeights : Ω → ι → ℝ)
    (driftWeightsNonneg : ∀ state i, 0 ≤ driftWeights state i)
    (weightsSumEqOne :
      ∀ state ∉ smallSet, ∑ i, driftWeights state i = 1)
    (slackLowerBound :
      ∀ state ∉ smallSet,
        ∀ i,
          driftGap ≤
            expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
              expectedLyapunovSynthesis.ceilingCandidate i) :
    ∀ state ∉ smallSet,
      driftGap ≤
        ∑ i, driftWeights state i *
          (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
            expectedLyapunovSynthesis.ceilingCandidate i) := by
  intro state hState
  have hWeighted :
      ∑ i, driftWeights state i * driftGap ≤
        ∑ i, driftWeights state i *
          (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
            expectedLyapunovSynthesis.ceilingCandidate i) := by
    exact Finset.sum_le_sum (fun i _ =>
      mul_le_mul_of_nonneg_left
        (slackLowerBound state hState i)
        (driftWeightsNonneg state i))
  have hConst :
      ∑ i, driftWeights state i * driftGap = driftGap := by
    rw [← Finset.sum_mul, weightsSumEqOne state hState]
    simp
  calc
    driftGap = ∑ i, driftWeights state i * driftGap := hConst.symm
    _ ≤
      ∑ i, driftWeights state i *
        (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
          expectedLyapunovSynthesis.ceilingCandidate i) := hWeighted

noncomputable def AdaptiveCeilingDriftSynthesis.ofNormalizedWeightedSlack
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ)
    (driftWeights : Ω → ι → ℝ)
    (driftWeightsNonneg : ∀ state i, 0 ≤ driftWeights state i)
    (weightsSumEqOne :
      ∀ state ∉ smallSet, ∑ i, driftWeights state i = 1)
    (slackLowerBound :
      ∀ state ∉ smallSet,
        ∀ i,
          driftGap ≤
            expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
              expectedLyapunovSynthesis.ceilingCandidate i)
    (ceilingExpectedEqWeightedSlack :
      ∀ state,
        expectedLyapunovSynthesis.ceilingExpectedLyapunov state =
          lyapunov state -
            ∑ i, driftWeights state i *
              (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
                expectedLyapunovSynthesis.ceilingCandidate i)) :
    AdaptiveCeilingDriftSynthesis
      (ι := ι)
      (Ω := Ω)
      expectedLyapunov
      expectedLyapunovSynthesis
      lyapunov
      smallSet
      driftGap :=
  AdaptiveCeilingDriftSynthesis.ofWeightedSlack
    (ι := ι)
    (Ω := Ω)
    (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
    (lyapunov := lyapunov)
    (smallSet := smallSet)
    (driftGap := driftGap)
    (driftWeights := driftWeights)
    (driftWeightsNonneg := driftWeightsNonneg)
    ceilingExpectedEqWeightedSlack
    (reserveCoversWeightedSlack_of_normalizedWeights
      (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
      (smallSet := smallSet)
      (driftGap := driftGap)
      (driftWeights := driftWeights)
      driftWeightsNonneg
      weightsSumEqOne
      slackLowerBound)

noncomputable def normalizedSlackWeights
    (smallSet : Set Ω)
    (weightScores : Ω → ι → ℝ) :
    Ω → ι → ℝ := by
  classical
  exact fun state i =>
    if state ∈ smallSet then
      0
    else
      weightScores state i / ∑ j, weightScores state j

omit [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω] in
theorem normalizedSlackWeights_nonneg
    (smallSet : Set Ω)
    (weightScores : Ω → ι → ℝ)
    (scoresNonneg : ∀ state i, 0 ≤ weightScores state i)
    (scoresTotalPos :
      ∀ state ∉ smallSet, 0 < ∑ j, weightScores state j) :
    ∀ state i, 0 ≤ normalizedSlackWeights (Ω := Ω) smallSet weightScores state i := by
  intro state i
  classical
  by_cases hState : state ∈ smallSet
  · simp [normalizedSlackWeights, hState]
  · simp [normalizedSlackWeights, hState]
    exact div_nonneg (scoresNonneg state i) (scoresTotalPos state hState).le

omit [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω] in
theorem normalizedSlackWeights_sum_eq_one
    (smallSet : Set Ω)
    (weightScores : Ω → ι → ℝ)
    (scoresTotalPos :
      ∀ state ∉ smallSet, 0 < ∑ j, weightScores state j) :
    ∀ state ∉ smallSet,
      ∑ i, normalizedSlackWeights (Ω := Ω) smallSet weightScores state i = 1 := by
  intro state hState
  classical
  have hDenPos : 0 < ∑ j, weightScores state j := scoresTotalPos state hState
  simp [normalizedSlackWeights, hState]
  calc
    ∑ i, weightScores state i / ∑ j, weightScores state j
      = ∑ i, weightScores state i * (∑ j, weightScores state j)⁻¹ := by
          apply Finset.sum_congr rfl
          intro i hi
          rw [div_eq_mul_inv]
    _ = (∑ i, weightScores state i) * (∑ j, weightScores state j)⁻¹ := by
          rw [Finset.sum_mul]
    _ = 1 := by
          exact mul_inv_cancel₀ hDenPos.ne'

noncomputable def AdaptiveCeilingDriftSynthesis.ofNormalizedScoreSlack
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ)
    (weightScores : Ω → ι → ℝ)
    (scoresNonneg : ∀ state i, 0 ≤ weightScores state i)
    (scoresTotalPos :
      ∀ state ∉ smallSet, 0 < ∑ j, weightScores state j)
    (slackLowerBound :
      ∀ state ∉ smallSet,
        ∀ i,
          driftGap ≤
            expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
              expectedLyapunovSynthesis.ceilingCandidate i)
    (ceilingExpectedEqWeightedSlack :
      ∀ state,
        expectedLyapunovSynthesis.ceilingExpectedLyapunov state =
          lyapunov state -
            ∑ i,
              normalizedSlackWeights (Ω := Ω) smallSet weightScores state i *
                (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
                  expectedLyapunovSynthesis.ceilingCandidate i)) :
    AdaptiveCeilingDriftSynthesis
      (ι := ι)
      (Ω := Ω)
      expectedLyapunov
      expectedLyapunovSynthesis
      lyapunov
      smallSet
      driftGap :=
  AdaptiveCeilingDriftSynthesis.ofNormalizedWeightedSlack
    (ι := ι)
    (Ω := Ω)
    (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
    (lyapunov := lyapunov)
    (smallSet := smallSet)
    (driftGap := driftGap)
    (driftWeights := normalizedSlackWeights (Ω := Ω) smallSet weightScores)
    (driftWeightsNonneg :=
      normalizedSlackWeights_nonneg (Ω := Ω) smallSet weightScores scoresNonneg scoresTotalPos)
    (weightsSumEqOne :=
      normalizedSlackWeights_sum_eq_one (Ω := Ω) smallSet weightScores scoresTotalPos)
    slackLowerBound
    ceilingExpectedEqWeightedSlack

def positivePartSlackScores
    (weightScores : Ω → ι → ℝ) :
    Ω → ι → ℝ :=
  fun state i => max (weightScores state i) 0

omit [Fintype ι] [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω] in
theorem positivePartSlackScores_nonneg
    (weightScores : Ω → ι → ℝ) :
    ∀ state i, 0 ≤ positivePartSlackScores (Ω := Ω) weightScores state i := by
  intro state i
  exact le_max_right _ _

noncomputable def AdaptiveCeilingDriftSynthesis.ofPositivePartScoreSlack
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ)
    (weightScores : Ω → ι → ℝ)
    (scoresTotalPos :
      ∀ state ∉ smallSet,
        0 < ∑ j, positivePartSlackScores (Ω := Ω) weightScores state j)
    (slackLowerBound :
      ∀ state ∉ smallSet,
        ∀ i,
          driftGap ≤
            expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
              expectedLyapunovSynthesis.ceilingCandidate i)
    (ceilingExpectedEqWeightedSlack :
      ∀ state,
        expectedLyapunovSynthesis.ceilingExpectedLyapunov state =
          lyapunov state -
            ∑ i,
              normalizedSlackWeights
                (Ω := Ω)
                smallSet
                (positivePartSlackScores (Ω := Ω) weightScores)
                state
                i *
                (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
                  expectedLyapunovSynthesis.ceilingCandidate i)) :
    AdaptiveCeilingDriftSynthesis
      (ι := ι)
      (Ω := Ω)
      expectedLyapunov
      expectedLyapunovSynthesis
      lyapunov
      smallSet
      driftGap :=
  AdaptiveCeilingDriftSynthesis.ofNormalizedScoreSlack
    (ι := ι)
    (Ω := Ω)
    (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
    (lyapunov := lyapunov)
    (smallSet := smallSet)
    (driftGap := driftGap)
    (weightScores := positivePartSlackScores (Ω := Ω) weightScores)
    (scoresNonneg := positivePartSlackScores_nonneg (Ω := Ω) weightScores)
    (scoresTotalPos := scoresTotalPos)
    slackLowerBound
    ceilingExpectedEqWeightedSlack

noncomputable def serviceSlackScores
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov) :
    Ω → ι → ℝ :=
  fun _ i =>
    expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
      expectedLyapunovSynthesis.ceilingCandidate i

omit [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω] in
theorem positivePartServiceSlackScores_totalPos_of_slackLowerBound
    [Nonempty ι]
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (smallSet : Set Ω)
    (driftGap : ℝ)
    (hGapPos : 0 < driftGap)
    (slackLowerBound :
      ∀ state ∉ smallSet,
        ∀ i,
          driftGap ≤
            expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
              expectedLyapunovSynthesis.ceilingCandidate i) :
    ∀ state ∉ smallSet,
      0 <
        ∑ j,
          positivePartSlackScores
            (Ω := Ω)
            (serviceSlackScores expectedLyapunovSynthesis)
            state
            j := by
  intro state hState
  classical
  let witness : ι := Classical.choice inferInstance
  have hSlackGe :
      driftGap ≤
        expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate witness -
          expectedLyapunovSynthesis.ceilingCandidate witness :=
    slackLowerBound state hState witness
  have hSlackPos :
      0 <
        expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate witness -
          expectedLyapunovSynthesis.ceilingCandidate witness :=
    lt_of_lt_of_le hGapPos hSlackGe
  have hWitnessPos :
      0 <
        positivePartSlackScores
          (Ω := Ω)
          (serviceSlackScores expectedLyapunovSynthesis)
          state
          witness := by
    dsimp [positivePartSlackScores, serviceSlackScores]
    rw [max_eq_left hSlackPos.le]
    exact hSlackPos
  have hWitnessLe :
      positivePartSlackScores
          (Ω := Ω)
          (serviceSlackScores expectedLyapunovSynthesis)
          state
          witness ≤
        ∑ j,
          positivePartSlackScores
            (Ω := Ω)
            (serviceSlackScores expectedLyapunovSynthesis)
            state
            j := by
    exact Finset.single_le_sum
      (fun j _ =>
        positivePartSlackScores_nonneg
          (Ω := Ω)
          (serviceSlackScores expectedLyapunovSynthesis)
          state
          j)
      (Finset.mem_univ witness)
  exact lt_of_lt_of_le hWitnessPos hWitnessLe

noncomputable def AdaptiveCeilingDriftSynthesis.ofPositivePartServiceSlack
    [Nonempty ι]
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ)
    (hGapPos : 0 < driftGap)
    (slackLowerBound :
      ∀ state ∉ smallSet,
        ∀ i,
          driftGap ≤
            expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
              expectedLyapunovSynthesis.ceilingCandidate i)
    (ceilingExpectedEqWeightedSlack :
      ∀ state,
        expectedLyapunovSynthesis.ceilingExpectedLyapunov state =
          lyapunov state -
            ∑ i,
              normalizedSlackWeights
                (Ω := Ω)
                smallSet
                (positivePartSlackScores
                  (Ω := Ω)
                  (serviceSlackScores expectedLyapunovSynthesis))
                state
                i *
                (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
                  expectedLyapunovSynthesis.ceilingCandidate i)) :
    AdaptiveCeilingDriftSynthesis
      (ι := ι)
      (Ω := Ω)
      expectedLyapunov
      expectedLyapunovSynthesis
      lyapunov
      smallSet
      driftGap :=
  AdaptiveCeilingDriftSynthesis.ofPositivePartScoreSlack
    (ι := ι)
    (Ω := Ω)
    (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
    (lyapunov := lyapunov)
    (smallSet := smallSet)
    (driftGap := driftGap)
    (weightScores := serviceSlackScores expectedLyapunovSynthesis)
    (scoresTotalPos :=
      positivePartServiceSlackScores_totalPos_of_slackLowerBound
        (Ω := Ω)
        (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
        (smallSet := smallSet)
        (driftGap := driftGap)
        hGapPos
        slackLowerBound)
    slackLowerBound
    ceilingExpectedEqWeightedSlack

noncomputable def routingPressureScores
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov) :
    Ω → ι → ℝ :=
  fun state i => ∑ j, expectedLyapunovSynthesis.adaptiveTrafficData.routing state j i

omit [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω] in
theorem routingPressureScores_nonneg
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov) :
    ∀ state i, 0 ≤ routingPressureScores expectedLyapunovSynthesis state i := by
  intro state i
  unfold routingPressureScores
  exact Finset.sum_nonneg (fun j _ => expectedLyapunovSynthesis.adaptiveTrafficData.routingNonneg state j i)

noncomputable def AdaptiveCeilingDriftSynthesis.ofRoutingPressureScoreSlack
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ)
    (scoresTotalPos :
      ∀ state ∉ smallSet, 0 < ∑ j, routingPressureScores expectedLyapunovSynthesis state j)
    (slackLowerBound :
      ∀ state ∉ smallSet,
        ∀ i,
          driftGap ≤
            expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
              expectedLyapunovSynthesis.ceilingCandidate i)
    (ceilingExpectedEqWeightedSlack :
      ∀ state,
        expectedLyapunovSynthesis.ceilingExpectedLyapunov state =
          lyapunov state -
            ∑ i,
              normalizedSlackWeights
                (Ω := Ω)
                smallSet
                (routingPressureScores expectedLyapunovSynthesis)
                state
                i *
                (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
                  expectedLyapunovSynthesis.ceilingCandidate i)) :
    AdaptiveCeilingDriftSynthesis
      (ι := ι)
      (Ω := Ω)
      expectedLyapunov
      expectedLyapunovSynthesis
      lyapunov
      smallSet
      driftGap :=
  AdaptiveCeilingDriftSynthesis.ofNormalizedScoreSlack
    (ι := ι)
    (Ω := Ω)
    (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
    (lyapunov := lyapunov)
    (smallSet := smallSet)
    (driftGap := driftGap)
    (weightScores := routingPressureScores expectedLyapunovSynthesis)
    (scoresNonneg := routingPressureScores_nonneg (Ω := Ω) expectedLyapunovSynthesis)
    (scoresTotalPos := scoresTotalPos)
    slackLowerBound
    ceilingExpectedEqWeightedSlack

noncomputable def selectedDriftWeights
    (smallSet : Set Ω)
    (selector : Ω → ι) :
    Ω → ι → ℝ := by
  classical
  exact fun state i =>
    if state ∈ smallSet then 0 else if i = selector state then 1 else 0

noncomputable def selectedSlackReserve
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (smallSet : Set Ω)
    (selector : Ω → ι) :
    Ω → ℝ := by
  classical
  exact fun state =>
    if state ∈ smallSet then
      0
    else
      expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate (selector state) -
        expectedLyapunovSynthesis.ceilingCandidate (selector state)

noncomputable def minimumSlackNode
    [Nonempty ι]
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov) :
    ι :=
  Classical.choose <|
    Finite.exists_min fun i =>
      expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
        expectedLyapunovSynthesis.ceilingCandidate i

noncomputable def minimumSlackSelector
    [Nonempty ι]
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov) :
    Ω → ι :=
  fun _ => minimumSlackNode expectedLyapunovSynthesis

omit [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω] in
theorem minimumSlackNode_le
    [Nonempty ι]
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (i : ι) :
    expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate
        (minimumSlackNode expectedLyapunovSynthesis) -
      expectedLyapunovSynthesis.ceilingCandidate
        (minimumSlackNode expectedLyapunovSynthesis) ≤
    expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
      expectedLyapunovSynthesis.ceilingCandidate i := by
  classical
  exact
    Classical.choose_spec
      (Finite.exists_min fun j =>
        expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate j -
          expectedLyapunovSynthesis.ceilingCandidate j) i

omit [Fintype ι] [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω] in
theorem selectedDriftWeights_nonneg
    (smallSet : Set Ω)
    (selector : Ω → ι) :
    ∀ state i, 0 ≤ selectedDriftWeights (Ω := Ω) smallSet selector state i := by
  intro state i
  classical
  by_cases hState : state ∈ smallSet
  · simp [selectedDriftWeights, hState]
  · by_cases hSelect : i = selector state
    · simp [selectedDriftWeights, hState, hSelect]
    · simp [selectedDriftWeights, hState, hSelect]

omit [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω] in
theorem selectedDriftWeights_weightedSlack_eq
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (smallSet : Set Ω)
    (selector : Ω → ι) :
    ∀ state,
      ∑ i, selectedDriftWeights (Ω := Ω) smallSet selector state i *
          (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
            expectedLyapunovSynthesis.ceilingCandidate i) =
        selectedSlackReserve
          (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
          smallSet
          selector
          state := by
  intro state
  classical
  by_cases hState : state ∈ smallSet
  · simp [selectedDriftWeights, selectedSlackReserve, hState]
  · have hRewrite :
        ∑ i, selectedDriftWeights (Ω := Ω) smallSet selector state i *
            (expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
              expectedLyapunovSynthesis.ceilingCandidate i) =
          ∑ i, if i = selector state then
            expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
              expectedLyapunovSynthesis.ceilingCandidate i
          else 0 := by
        refine Finset.sum_congr rfl ?_
        intro i _
        by_cases hSelect : i = selector state
        · simp [selectedDriftWeights, hState, hSelect]
        · simp [selectedDriftWeights, hState, hSelect]
    rw [hRewrite]
    rw [Finset.sum_eq_single_of_mem (selector state) (Finset.mem_univ _)]
    · simp [selectedSlackReserve, hState]
    · intro j _ hNe
      simp [hNe]

noncomputable def AdaptiveCeilingDriftSynthesis.ofSelectedSlack
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ)
    (selector : Ω → ι)
    (ceilingExpectedEqSelectedSlack :
      ∀ state,
        expectedLyapunovSynthesis.ceilingExpectedLyapunov state =
          lyapunov state -
            selectedSlackReserve
              (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
              smallSet
              selector
              state)
    (selectedSlackCoversDriftGap :
      ∀ state ∉ smallSet,
        driftGap ≤
          expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate (selector state) -
            expectedLyapunovSynthesis.ceilingCandidate (selector state)) :
    AdaptiveCeilingDriftSynthesis
      (ι := ι)
      (Ω := Ω)
      expectedLyapunov
      expectedLyapunovSynthesis
      lyapunov
      smallSet
      driftGap :=
  AdaptiveCeilingDriftSynthesis.ofWeightedSlack
    (ι := ι)
    (Ω := Ω)
    (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
    (lyapunov := lyapunov)
    (smallSet := smallSet)
    (driftGap := driftGap)
    (driftWeights := selectedDriftWeights (Ω := Ω) smallSet selector)
    (driftWeightsNonneg := selectedDriftWeights_nonneg (Ω := Ω) smallSet selector)
    (by
      intro state
      rw [selectedDriftWeights_weightedSlack_eq
        (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
        (smallSet := smallSet)
        (selector := selector)
        state]
      exact ceilingExpectedEqSelectedSlack state)
    (by
      intro state hState
      rw [selectedDriftWeights_weightedSlack_eq
        (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
        (smallSet := smallSet)
        (selector := selector)
        state]
      simp [selectedSlackReserve, hState]
      exact selectedSlackCoversDriftGap state hState)

noncomputable def AdaptiveCeilingDriftSynthesis.ofMinimumSlack
    [Nonempty ι]
    (expectedLyapunovSynthesis :
      AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) expectedLyapunov)
    (lyapunov : Ω → ℝ)
    (smallSet : Set Ω)
    (driftGap : ℝ)
    (ceilingExpectedEqMinimumSlack :
      ∀ state,
        expectedLyapunovSynthesis.ceilingExpectedLyapunov state =
          lyapunov state -
            selectedSlackReserve
              (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
              smallSet
              (minimumSlackSelector expectedLyapunovSynthesis)
              state)
    (slackLowerBound :
      ∀ state ∉ smallSet,
        ∀ i,
          driftGap ≤
            expectedLyapunovSynthesis.adaptiveTrafficData.serviceRate i -
              expectedLyapunovSynthesis.ceilingCandidate i) :
    AdaptiveCeilingDriftSynthesis
      (ι := ι)
      (Ω := Ω)
      expectedLyapunov
      expectedLyapunovSynthesis
      lyapunov
      smallSet
      driftGap :=
  AdaptiveCeilingDriftSynthesis.ofSelectedSlack
    (ι := ι)
    (Ω := Ω)
    (expectedLyapunovSynthesis := expectedLyapunovSynthesis)
    (lyapunov := lyapunov)
    (smallSet := smallSet)
    (driftGap := driftGap)
    (selector := minimumSlackSelector expectedLyapunovSynthesis)
    ceilingExpectedEqMinimumSlack
    (by
      intro state hState
      simpa [minimumSlackSelector] using
        slackLowerBound state hState (minimumSlackNode expectedLyapunovSynthesis))

omit [Fintype Ω] [Nonempty Ω] [MeasurableSpace Ω] in
theorem AdaptiveCeilingDriftSynthesis.ceilingDriftBound
    (synthesis : AdaptiveCeilingDriftSynthesis
      (ι := ι)
      (Ω := Ω)
      expectedLyapunov
      expectedLyapunovSynthesis
      lyapunov
      smallSet
      driftGap) :
    ∀ state ∉ smallSet,
      expectedLyapunovSynthesis.ceilingExpectedLyapunov state ≤
        lyapunov state - driftGap := by
  intro state hState
  rw [synthesis.ceilingExpectedEq state]
  exact sub_le_sub_left (synthesis.reserveCoversDriftGap state hState) (lyapunov state)

end AdaptiveExpectedLyapunov

structure StateDependentQueueStabilityAssumptions (Ω : Type*) [MeasurableSpace Ω] where
  law : MeasureQueueLaw Ω
  stationaryMeasure : Measure Ω
  routingKernel : Ω → Ω → ℝ
  lyapunov : Ω → ℝ
  expectedLyapunov : Ω → ℝ
  smallSet : Set Ω
  driftGap : ℝ
  stateDependentService : Prop
  stateDependentRouting : Prop
  bridgeState : Ω
  toBridgePositive : ∀ state, 0 < routingKernel state bridgeState
  fromBridgePositive : ∀ state, 0 < routingKernel bridgeState state
  driftBound :
    ∀ state ∉ smallSet, expectedLyapunov state ≤ lyapunov state - driftGap
  driftGapPositive : 0 < driftGap
  smallSetFinite : smallSet.Finite

def StateDependentQueueStabilityAssumptions.irreducible
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) : Prop :=
  KernelIrreducible assumptions.routingKernel

theorem StateDependentQueueStabilityAssumptions.irreducible_holds
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) :
    assumptions.irreducible := by
  exact kernelIrreducible_of_bridge
    assumptions.routingKernel
    assumptions.bridgeState
    assumptions.toBridgePositive
    assumptions.fromBridgePositive

def StateDependentQueueStabilityAssumptions.fosterLyapunovDrift
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) : Prop :=
  KernelFosterLyapunovDrift
    assumptions.expectedLyapunov
    assumptions.lyapunov
    assumptions.smallSet
    assumptions.driftGap

theorem StateDependentQueueStabilityAssumptions.fosterLyapunovDrift_holds
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) :
    assumptions.fosterLyapunovDrift :=
  assumptions.driftBound

abbrev StateDependentQueueStabilityAssumptions.petiteSet
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) : Prop :=
  KernelPetiteSet assumptions.smallSet

theorem StateDependentQueueStabilityAssumptions.petiteSet_holds
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) :
    assumptions.petiteSet :=
  assumptions.smallSetFinite

def StateDependentQueueStabilityAssumptions.positiveRecurrent
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) : Prop :=
  KernelPositiveRecurrent
    assumptions.routingKernel
    assumptions.expectedLyapunov
    assumptions.lyapunov
    assumptions.smallSet
    assumptions.driftGap

abbrev StateDependentQueueStabilityAssumptions.stationaryLawExists
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) : Prop :=
  KernelStationaryLawExists
    assumptions.routingKernel
    assumptions.expectedLyapunov
    assumptions.lyapunov
    assumptions.smallSet
    assumptions.driftGap

theorem StateDependentQueueStabilityAssumptions.positiveRecurrent_holds
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) :
    assumptions.stateDependentService ->
    assumptions.stateDependentRouting ->
    assumptions.irreducible ->
    assumptions.fosterLyapunovDrift ->
    assumptions.petiteSet ->
    assumptions.positiveRecurrent := by
  intro _ _ hIrreducible hDrift _
  exact kernelPositiveRecurrent_of_drift
    hIrreducible
    hDrift
    assumptions.driftGapPositive

theorem StateDependentQueueStabilityAssumptions.stationaryLawExists_holds
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) :
    assumptions.stateDependentService ->
    assumptions.stateDependentRouting ->
    assumptions.irreducible ->
    assumptions.fosterLyapunovDrift ->
    assumptions.petiteSet ->
    assumptions.stationaryLawExists := by
  intro hService hRouting hIrreducible hDrift hPetite
  exact kernelStationaryLawExists_of_positiveRecurrence
    (assumptions.positiveRecurrent_holds
      hService
      hRouting
      hIrreducible
      hDrift
      hPetite)

theorem state_dependent_queue_balance_from_drift_schema
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) :
    assumptions.stateDependentService ->
    assumptions.stateDependentRouting ->
    assumptions.irreducible ->
    assumptions.fosterLyapunovDrift ->
    assumptions.petiteSet ->
    (∫⁻ ω, assumptions.law.customerTime ω ∂ assumptions.stationaryMeasure =
      ∫⁻ ω, assumptions.law.sojournTime ω ∂ assumptions.stationaryMeasure +
        ∫⁻ ω, assumptions.law.openAge ω ∂ assumptions.stationaryMeasure) := by
  intro _ _ _ _ _
  exact measure_queue_lintegral_balance assumptions.stationaryMeasure assumptions.law

theorem state_dependent_queue_terminal_balance_from_drift_schema
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω)
    (hOpenAgeZero : assumptions.law.openAge =ᵐ[assumptions.stationaryMeasure] 0) :
    assumptions.stateDependentService ->
    assumptions.stateDependentRouting ->
    assumptions.irreducible ->
    assumptions.fosterLyapunovDrift ->
    assumptions.petiteSet ->
    (∫⁻ ω, assumptions.law.customerTime ω ∂ assumptions.stationaryMeasure =
      ∫⁻ ω, assumptions.law.sojournTime ω ∂ assumptions.stationaryMeasure) := by
  intro _ _ _ _ _
  exact measure_queue_terminal_lintegral_balance
    assumptions.stationaryMeasure assumptions.law hOpenAgeZero

theorem state_dependent_queue_stability_schema
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω) :
    assumptions.stateDependentService ->
    assumptions.stateDependentRouting ->
    assumptions.irreducible ->
    assumptions.fosterLyapunovDrift ->
    assumptions.petiteSet ->
    assumptions.positiveRecurrent /\
      assumptions.stationaryLawExists /\
      (∫⁻ ω, assumptions.law.customerTime ω ∂ assumptions.stationaryMeasure =
        ∫⁻ ω, assumptions.law.sojournTime ω ∂ assumptions.stationaryMeasure +
          ∫⁻ ω, assumptions.law.openAge ω ∂ assumptions.stationaryMeasure) := by
  intro hService hRouting hIrreducible hDrift hPetite
  refine And.intro
    (assumptions.positiveRecurrent_holds hService hRouting hIrreducible hDrift hPetite) ?_
  refine And.intro
    (assumptions.stationaryLawExists_holds hService hRouting hIrreducible hDrift hPetite) ?_
  exact state_dependent_queue_balance_from_drift_schema
    assumptions
    hService
    hRouting
    hIrreducible
    hDrift
    hPetite

theorem state_dependent_queue_terminal_balance_schema
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : StateDependentQueueStabilityAssumptions Ω)
    (hOpenAgeZero : assumptions.law.openAge =ᵐ[assumptions.stationaryMeasure] 0) :
    assumptions.stateDependentService ->
    assumptions.stateDependentRouting ->
    assumptions.irreducible ->
    assumptions.fosterLyapunovDrift ->
    assumptions.petiteSet ->
    assumptions.positiveRecurrent /\
      assumptions.stationaryLawExists /\
      (∫⁻ ω, assumptions.law.customerTime ω ∂ assumptions.stationaryMeasure =
        ∫⁻ ω, assumptions.law.sojournTime ω ∂ assumptions.stationaryMeasure) := by
  intro hService hRouting hIrreducible hDrift hPetite
  refine And.intro
    (assumptions.positiveRecurrent_holds hService hRouting hIrreducible hDrift hPetite) ?_
  refine And.intro
    (assumptions.stationaryLawExists_holds hService hRouting hIrreducible hDrift hPetite) ?_
  exact state_dependent_queue_terminal_balance_from_drift_schema
    assumptions
    hOpenAgeZero
    hService
    hRouting
    hIrreducible
    hDrift
    hPetite

structure AdaptiveSupremumStabilityAssumptions
    (ι Ω : Type*)
    [Fintype ι]
    [Fintype Ω]
    [Nonempty Ω]
    [MeasurableSpace Ω] where
  base : StateDependentQueueStabilityAssumptions Ω
  comparison : AdaptiveExpectedLyapunovSynthesis (ι := ι) (Ω := Ω) base.expectedLyapunov
  drift :
    AdaptiveCeilingDriftSynthesis
      (ι := ι)
      (Ω := Ω)
      base.expectedLyapunov
      comparison
      base.lyapunov
      base.smallSet
      base.driftGap

theorem AdaptiveSupremumStabilityAssumptions.fosterLyapunovDrift_holds
    {ι Ω : Type*}
    [Fintype ι]
    [Fintype Ω]
    [Nonempty Ω]
    [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions ι Ω) :
    assumptions.base.fosterLyapunovDrift := by
  exact kernelFosterLyapunovDrift_of_expectedLyapunov_bound
    assumptions.comparison.expectedLyapunov_le_ceilingExpectedLyapunov
    assumptions.drift.ceilingDriftBound

theorem AdaptiveSupremumStabilityAssumptions.positiveRecurrent_holds
    {ι Ω : Type*}
    [Fintype ι]
    [Fintype Ω]
    [Nonempty Ω]
    [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions ι Ω) :
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    assumptions.base.positiveRecurrent := by
  intro hService hRouting hIrreducible hPetite
  exact assumptions.base.positiveRecurrent_holds
    hService
    hRouting
    hIrreducible
    assumptions.fosterLyapunovDrift_holds
    hPetite

theorem AdaptiveSupremumStabilityAssumptions.stationaryLawExists_holds
    {ι Ω : Type*}
    [Fintype ι]
    [Fintype Ω]
    [Nonempty Ω]
    [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions ι Ω) :
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    assumptions.base.stationaryLawExists := by
  intro hService hRouting hIrreducible hPetite
  exact assumptions.base.stationaryLawExists_holds
    hService
    hRouting
    hIrreducible
    assumptions.fosterLyapunovDrift_holds
    hPetite

theorem adaptive_queue_balance_from_supremum_schema
    {ι Ω : Type*}
    [Fintype ι]
    [Fintype Ω]
    [Nonempty Ω]
    [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions ι Ω) :
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    (∫⁻ ω, assumptions.base.law.customerTime ω ∂ assumptions.base.stationaryMeasure =
      ∫⁻ ω, assumptions.base.law.sojournTime ω ∂ assumptions.base.stationaryMeasure +
        ∫⁻ ω, assumptions.base.law.openAge ω ∂ assumptions.base.stationaryMeasure) := by
  intro hService hRouting hIrreducible hPetite
  exact state_dependent_queue_balance_from_drift_schema
    assumptions.base
    hService
    hRouting
    hIrreducible
    assumptions.fosterLyapunovDrift_holds
    hPetite

theorem adaptive_queue_terminal_balance_from_supremum_balance_schema
    {ι Ω : Type*}
    [Fintype ι]
    [Fintype Ω]
    [Nonempty Ω]
    [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions ι Ω)
    (hOpenAgeZero : assumptions.base.law.openAge =ᵐ[assumptions.base.stationaryMeasure] 0) :
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    (∫⁻ ω, assumptions.base.law.customerTime ω ∂ assumptions.base.stationaryMeasure =
      ∫⁻ ω, assumptions.base.law.sojournTime ω ∂ assumptions.base.stationaryMeasure) := by
  intro hService hRouting hIrreducible hPetite
  exact state_dependent_queue_terminal_balance_from_drift_schema
    assumptions.base
    hOpenAgeZero
    hService
    hRouting
    hIrreducible
    assumptions.fosterLyapunovDrift_holds
    hPetite

theorem adaptive_queue_stability_from_supremum_schema
    {ι Ω : Type*}
    [Fintype ι]
    [Fintype Ω]
    [Nonempty Ω]
    [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions ι Ω) :
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    assumptions.base.positiveRecurrent /\
      assumptions.base.stationaryLawExists /\
      (∫⁻ ω, assumptions.base.law.customerTime ω ∂ assumptions.base.stationaryMeasure =
        ∫⁻ ω, assumptions.base.law.sojournTime ω ∂ assumptions.base.stationaryMeasure +
          ∫⁻ ω, assumptions.base.law.openAge ω ∂ assumptions.base.stationaryMeasure) := by
  intro hService hRouting hIrreducible hPetite
  refine And.intro
    (assumptions.positiveRecurrent_holds hService hRouting hIrreducible hPetite) ?_
  refine And.intro
    (assumptions.stationaryLawExists_holds hService hRouting hIrreducible hPetite) ?_
  exact adaptive_queue_balance_from_supremum_schema
    assumptions
    hService
    hRouting
    hIrreducible
    hPetite

theorem adaptive_queue_terminal_balance_from_supremum_schema
    {ι Ω : Type*}
    [Fintype ι]
    [Fintype Ω]
    [Nonempty Ω]
    [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions ι Ω)
    (hOpenAgeZero : assumptions.base.law.openAge =ᵐ[assumptions.base.stationaryMeasure] 0) :
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    assumptions.base.positiveRecurrent /\
      assumptions.base.stationaryLawExists /\
      (∫⁻ ω, assumptions.base.law.customerTime ω ∂ assumptions.base.stationaryMeasure =
        ∫⁻ ω, assumptions.base.law.sojournTime ω ∂ assumptions.base.stationaryMeasure) := by
  intro hService hRouting hIrreducible hPetite
  refine And.intro
    (assumptions.positiveRecurrent_holds hService hRouting hIrreducible hPetite) ?_
  refine And.intro
    (assumptions.stationaryLawExists_holds hService hRouting hIrreducible hPetite) ?_
  exact adaptive_queue_terminal_balance_from_supremum_balance_schema
    assumptions
    hOpenAgeZero
    hService
    hRouting
    hIrreducible
    hPetite

structure DagExpressibilityAssumptions where
  finiteDag : Prop
  decompositionExists : Prop
  decompositionSound : Prop
  decompositionComplete : Prop
  encodingFunctionExists : Prop

def DagExpressibleByForkRaceFold (assumptions : DagExpressibilityAssumptions) : Prop :=
  assumptions.decompositionExists /\
  assumptions.decompositionSound /\
  assumptions.decompositionComplete /\
  assumptions.encodingFunctionExists

theorem dag_completeness_schema (assumptions : DagExpressibilityAssumptions) :
    assumptions.finiteDag ->
    assumptions.decompositionExists ->
    assumptions.decompositionSound ->
    assumptions.decompositionComplete ->
    assumptions.encodingFunctionExists ->
    DagExpressibleByForkRaceFold assumptions := by
  intro _ hExists hSound hComplete hEncoding
  exact And.intro hExists (And.intro hSound (And.intro hComplete hEncoding))

structure ParserClosureAssumptions where
  grammarWellFormed : Prop
  tlaCfgPairsComplete : Prop
  parserTotalOnGrammar : Prop
  roundTripStable : Prop

def ParserClosure (assumptions : ParserClosureAssumptions) : Prop :=
  assumptions.grammarWellFormed /\
  assumptions.tlaCfgPairsComplete /\
  assumptions.parserTotalOnGrammar /\
  assumptions.roundTripStable

theorem parser_closure_theorem (assumptions : ParserClosureAssumptions) :
    assumptions.grammarWellFormed ->
    assumptions.tlaCfgPairsComplete ->
    assumptions.parserTotalOnGrammar ->
    assumptions.roundTripStable ->
    ParserClosure assumptions := by
  intro hGrammar hPairs hTotal hRoundTrip
  exact And.intro hGrammar (And.intro hPairs (And.intro hTotal hRoundTrip))

structure ConvergenceAssumptions where
  conservesEnergy : Prop
  irreversibleTime : Prop
  nonzeroGroundOverhead : Prop
  finiteStateModel : Prop
  throughputSelectionPressure : Prop
  forkRaceFoldAttractor : Prop
  noAlternativeInModelClass : Prop

def ConvergenceInModeledClass (assumptions : ConvergenceAssumptions) : Prop :=
  assumptions.forkRaceFoldAttractor /\ assumptions.noAlternativeInModelClass

theorem convergence_schema (assumptions : ConvergenceAssumptions) :
    assumptions.conservesEnergy ->
    assumptions.irreversibleTime ->
    assumptions.nonzeroGroundOverhead ->
    assumptions.finiteStateModel ->
    assumptions.throughputSelectionPressure ->
    assumptions.forkRaceFoldAttractor ->
    assumptions.noAlternativeInModelClass ->
    ConvergenceInModeledClass assumptions := by
  intro _ _ _ _ _ hAttractor hNoAlternative
  exact And.intro hAttractor hNoAlternative

structure InterferenceCoarseningAssumptions where
  fineInitialLive : Nat
  coarseInitialLive : Nat
  coarseTerminalLive : Nat
  coarseTotalVented : Nat
  coarseTotalRepairDebt : Nat
  fineContagious : Prop
  coarseDeterministicCollapse : Prop
  supportPreservingQuotient : 1 < fineInitialLive -> 1 < coarseInitialLive
  survivorFaithfulQuotient : coarseDeterministicCollapse -> coarseTerminalLive = 1
  contagionReflectingQuotient :
    coarseTotalVented = 0 ->
    fineContagious ->
    1 < coarseInitialLive ->
    0 < coarseTotalRepairDebt \/ 1 < coarseTerminalLive

theorem interference_coarsening_zero_vent_requires_repair
    (assumptions : InterferenceCoarseningAssumptions) :
    1 < assumptions.fineInitialLive ->
    assumptions.coarseTotalVented = 0 ->
    assumptions.fineContagious ->
    assumptions.coarseDeterministicCollapse ->
    0 < assumptions.coarseTotalRepairDebt := by
  intro hFineForked hZeroVent hContagious hCollapse
  have hCoarseForked := assumptions.supportPreservingQuotient hFineForked
  have hReflected :=
    assumptions.contagionReflectingQuotient hZeroVent hContagious hCoarseForked
  rcases hReflected with hDebt | hMultiplicity
  · exact hDebt
  · have hSingle := assumptions.survivorFaithfulQuotient hCollapse
    rw [hSingle] at hMultiplicity
    omega

theorem interference_coarsening_schema
    (assumptions : InterferenceCoarseningAssumptions) :
    1 < assumptions.fineInitialLive ->
    assumptions.fineContagious ->
    assumptions.coarseDeterministicCollapse ->
    0 < assumptions.coarseTotalVented \/ 0 < assumptions.coarseTotalRepairDebt := by
  intro hFineForked hContagious hCollapse
  by_cases hZeroVent : assumptions.coarseTotalVented = 0
  · right
    exact
      interference_coarsening_zero_vent_requires_repair
        assumptions
        hFineForked
        hZeroVent
        hContagious
        hCollapse
  · left
    exact Nat.pos_of_ne_zero hZeroVent

abbrev Bu := Nat

structure BeautyDefinitionAssumptions where
  intrinsicBu : Bu
  implementationBuA : Bu
  implementationBuB : Bu
  deficitBuA : Bu
  deficitBuB : Bu
  beautyBuA : Bu
  beautyBuB : Bu
  deficitDefA : deficitBuA = intrinsicBu - implementationBuA
  deficitDefB : deficitBuB = intrinsicBu - implementationBuB
  beautyDefA : beautyBuA = intrinsicBu - deficitBuA
  beautyDefB : beautyBuB = intrinsicBu - deficitBuB

theorem beauty_definition_schema (assumptions : BeautyDefinitionAssumptions) :
    assumptions.deficitBuA = assumptions.intrinsicBu - assumptions.implementationBuA /\
    assumptions.deficitBuB = assumptions.intrinsicBu - assumptions.implementationBuB /\
    assumptions.beautyBuA = assumptions.intrinsicBu - assumptions.deficitBuA /\
    assumptions.beautyBuB = assumptions.intrinsicBu - assumptions.deficitBuB := by
  exact And.intro assumptions.deficitDefA (And.intro assumptions.deficitDefB
    (And.intro assumptions.beautyDefA assumptions.beautyDefB))

structure BeautyLatencyMonotonicityAssumptions where
  deficitBuA : Bu
  deficitBuB : Bu
  latencyA : Nat
  latencyB : Nat
  deficitOrder : deficitBuA <= deficitBuB
  latencyMonotoneFromDeficit : deficitBuA <= deficitBuB -> latencyA <= latencyB

theorem beauty_latency_monotone_schema (assumptions : BeautyLatencyMonotonicityAssumptions) :
    assumptions.latencyA <= assumptions.latencyB := by
  exact assumptions.latencyMonotoneFromDeficit assumptions.deficitOrder

structure BeautyWasteMonotonicityAssumptions where
  deficitBuA : Bu
  deficitBuB : Bu
  wasteA : Nat
  wasteB : Nat
  deficitOrder : deficitBuA <= deficitBuB
  wasteMonotoneFromDeficit : deficitBuA <= deficitBuB -> wasteA <= wasteB

theorem beauty_waste_monotone_schema (assumptions : BeautyWasteMonotonicityAssumptions) :
    assumptions.wasteA <= assumptions.wasteB := by
  exact assumptions.wasteMonotoneFromDeficit assumptions.deficitOrder

structure BeautyParetoAssumptions where
  deficitBuA : Bu
  deficitBuB : Bu
  latencyA : Nat
  latencyB : Nat
  wasteA : Nat
  wasteB : Nat
  zeroDeficitA : deficitBuA = 0
  deficitOrder : deficitBuA <= deficitBuB
  latencyMonotoneFromDeficit : deficitBuA <= deficitBuB -> latencyA <= latencyB
  wasteMonotoneFromDeficit : deficitBuA <= deficitBuB -> wasteA <= wasteB

theorem beauty_pareto_optimality_schema (assumptions : BeautyParetoAssumptions) :
    assumptions.latencyA <= assumptions.latencyB /\
    assumptions.wasteA <= assumptions.wasteB := by
  constructor
  · exact assumptions.latencyMonotoneFromDeficit assumptions.deficitOrder
  · exact assumptions.wasteMonotoneFromDeficit assumptions.deficitOrder

structure BeautyCompositionAssumptions where
  pipelineBu : Bu
  protocolBu : Bu
  compressionBu : Bu
  globalBu : Bu
  additiveComposition : globalBu = pipelineBu + protocolBu + compressionBu

theorem beauty_composition_schema (assumptions : BeautyCompositionAssumptions) :
    assumptions.globalBu =
      assumptions.pipelineBu + assumptions.protocolBu + assumptions.compressionBu := by
  exact assumptions.additiveComposition

structure BeautyOptimalityAssumptions where
  definition : BeautyDefinitionAssumptions
  latency : BeautyLatencyMonotonicityAssumptions
  waste : BeautyWasteMonotonicityAssumptions
  pareto : BeautyParetoAssumptions
  composition : BeautyCompositionAssumptions
  beautyMonotoneFromDeficit :
    latency.deficitBuA <= latency.deficitBuB ->
      definition.beautyBuB <= definition.beautyBuA

theorem beauty_optimality_schema (assumptions : BeautyOptimalityAssumptions) :
    (assumptions.definition.deficitBuA =
      assumptions.definition.intrinsicBu - assumptions.definition.implementationBuA /\
     assumptions.definition.deficitBuB =
      assumptions.definition.intrinsicBu - assumptions.definition.implementationBuB /\
     assumptions.definition.beautyBuA =
      assumptions.definition.intrinsicBu - assumptions.definition.deficitBuA /\
     assumptions.definition.beautyBuB =
      assumptions.definition.intrinsicBu - assumptions.definition.deficitBuB) /\
    assumptions.latency.latencyA <= assumptions.latency.latencyB /\
    assumptions.waste.wasteA <= assumptions.waste.wasteB /\
    assumptions.pareto.latencyA <= assumptions.pareto.latencyB /\
    assumptions.pareto.wasteA <= assumptions.pareto.wasteB /\
    assumptions.definition.beautyBuB <= assumptions.definition.beautyBuA /\
    assumptions.composition.globalBu =
      assumptions.composition.pipelineBu + assumptions.composition.protocolBu +
      assumptions.composition.compressionBu := by
  refine And.intro (beauty_definition_schema assumptions.definition) ?_
  refine And.intro (beauty_latency_monotone_schema assumptions.latency) ?_
  refine And.intro (beauty_waste_monotone_schema assumptions.waste) ?_
  refine And.intro (beauty_pareto_optimality_schema assumptions.pareto).1 ?_
  refine And.intro (beauty_pareto_optimality_schema assumptions.pareto).2 ?_
  refine And.intro
    (assumptions.beautyMonotoneFromDeficit assumptions.latency.deficitOrder)
    (beauty_composition_schema assumptions.composition)

end ForkRaceFoldTheorems
