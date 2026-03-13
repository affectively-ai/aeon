import Mathlib
import ForkRaceFoldTheorems.MeasureQueueing

open MeasureTheory

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

structure AdaptiveSupremumStabilityAssumptions (Ω : Type*) [MeasurableSpace Ω] where
  base : StateDependentQueueStabilityAssumptions Ω
  dominatedBySupremumKernel : Prop
  supremumKernelSubstochastic : Prop
  supremumKernelContractive : Prop
  spectralCandidateStable : Prop
  ceilingExpectedLyapunov : Ω → ℝ
  expectedLyapunovLeCeilingExpected :
    dominatedBySupremumKernel ->
    ∀ state, base.expectedLyapunov state ≤ ceilingExpectedLyapunov state
  ceilingDriftBound :
    supremumKernelSubstochastic ->
    supremumKernelContractive ->
    spectralCandidateStable ->
    ∀ state ∉ base.smallSet, ceilingExpectedLyapunov state ≤ base.lyapunov state - base.driftGap

theorem AdaptiveSupremumStabilityAssumptions.fosterLyapunovDrift_holds
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions Ω) :
    assumptions.dominatedBySupremumKernel ->
    assumptions.supremumKernelSubstochastic ->
    assumptions.supremumKernelContractive ->
    assumptions.spectralCandidateStable ->
    assumptions.base.fosterLyapunovDrift := by
  intro hDominated hSubstochastic hContractive hStable
  exact kernelFosterLyapunovDrift_of_expectedLyapunov_bound
    (assumptions.expectedLyapunovLeCeilingExpected hDominated)
    (assumptions.ceilingDriftBound hSubstochastic hContractive hStable)

theorem AdaptiveSupremumStabilityAssumptions.positiveRecurrent_holds
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions Ω) :
    assumptions.dominatedBySupremumKernel ->
    assumptions.supremumKernelSubstochastic ->
    assumptions.supremumKernelContractive ->
    assumptions.spectralCandidateStable ->
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    assumptions.base.positiveRecurrent := by
  intro hDominated hSubstochastic hContractive hStable hService hRouting hIrreducible hPetite
  exact assumptions.base.positiveRecurrent_holds
    hService
    hRouting
    hIrreducible
    (assumptions.fosterLyapunovDrift_holds hDominated hSubstochastic hContractive hStable)
    hPetite

theorem AdaptiveSupremumStabilityAssumptions.stationaryLawExists_holds
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions Ω) :
    assumptions.dominatedBySupremumKernel ->
    assumptions.supremumKernelSubstochastic ->
    assumptions.supremumKernelContractive ->
    assumptions.spectralCandidateStable ->
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    assumptions.base.stationaryLawExists := by
  intro hDominated hSubstochastic hContractive hStable hService hRouting hIrreducible hPetite
  exact assumptions.base.stationaryLawExists_holds
    hService
    hRouting
    hIrreducible
    (assumptions.fosterLyapunovDrift_holds hDominated hSubstochastic hContractive hStable)
    hPetite

theorem adaptive_queue_balance_from_supremum_schema
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions Ω) :
    assumptions.dominatedBySupremumKernel ->
    assumptions.supremumKernelSubstochastic ->
    assumptions.supremumKernelContractive ->
    assumptions.spectralCandidateStable ->
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    (∫⁻ ω, assumptions.base.law.customerTime ω ∂ assumptions.base.stationaryMeasure =
      ∫⁻ ω, assumptions.base.law.sojournTime ω ∂ assumptions.base.stationaryMeasure +
        ∫⁻ ω, assumptions.base.law.openAge ω ∂ assumptions.base.stationaryMeasure) := by
  intro hDominated hSubstochastic hContractive hStable hService hRouting hIrreducible hPetite
  exact state_dependent_queue_balance_from_drift_schema
    assumptions.base
    hService
    hRouting
    hIrreducible
    (assumptions.fosterLyapunovDrift_holds hDominated hSubstochastic hContractive hStable)
    hPetite

theorem adaptive_queue_terminal_balance_from_supremum_balance_schema
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions Ω)
    (hOpenAgeZero : assumptions.base.law.openAge =ᵐ[assumptions.base.stationaryMeasure] 0) :
    assumptions.dominatedBySupremumKernel ->
    assumptions.supremumKernelSubstochastic ->
    assumptions.supremumKernelContractive ->
    assumptions.spectralCandidateStable ->
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    (∫⁻ ω, assumptions.base.law.customerTime ω ∂ assumptions.base.stationaryMeasure =
      ∫⁻ ω, assumptions.base.law.sojournTime ω ∂ assumptions.base.stationaryMeasure) := by
  intro hDominated hSubstochastic hContractive hStable hService hRouting hIrreducible hPetite
  exact state_dependent_queue_terminal_balance_from_drift_schema
    assumptions.base
    hOpenAgeZero
    hService
    hRouting
    hIrreducible
    (assumptions.fosterLyapunovDrift_holds hDominated hSubstochastic hContractive hStable)
    hPetite

theorem adaptive_queue_stability_from_supremum_schema
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions Ω) :
    assumptions.dominatedBySupremumKernel ->
    assumptions.supremumKernelSubstochastic ->
    assumptions.supremumKernelContractive ->
    assumptions.spectralCandidateStable ->
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    assumptions.base.positiveRecurrent /\
      assumptions.base.stationaryLawExists /\
      (∫⁻ ω, assumptions.base.law.customerTime ω ∂ assumptions.base.stationaryMeasure =
        ∫⁻ ω, assumptions.base.law.sojournTime ω ∂ assumptions.base.stationaryMeasure +
          ∫⁻ ω, assumptions.base.law.openAge ω ∂ assumptions.base.stationaryMeasure) := by
  intro hDominated hSubstochastic hContractive hStable hService hRouting hIrreducible hPetite
  refine And.intro
    (assumptions.positiveRecurrent_holds
      hDominated hSubstochastic hContractive hStable
      hService hRouting hIrreducible hPetite) ?_
  refine And.intro
    (assumptions.stationaryLawExists_holds
      hDominated hSubstochastic hContractive hStable
      hService hRouting hIrreducible hPetite) ?_
  exact adaptive_queue_balance_from_supremum_schema
    assumptions
    hDominated
    hSubstochastic
    hContractive
    hStable
    hService
    hRouting
    hIrreducible
    hPetite

theorem adaptive_queue_terminal_balance_from_supremum_schema
    {Ω : Type*} [MeasurableSpace Ω]
    (assumptions : AdaptiveSupremumStabilityAssumptions Ω)
    (hOpenAgeZero : assumptions.base.law.openAge =ᵐ[assumptions.base.stationaryMeasure] 0) :
    assumptions.dominatedBySupremumKernel ->
    assumptions.supremumKernelSubstochastic ->
    assumptions.supremumKernelContractive ->
    assumptions.spectralCandidateStable ->
    assumptions.base.stateDependentService ->
    assumptions.base.stateDependentRouting ->
    assumptions.base.irreducible ->
    assumptions.base.petiteSet ->
    assumptions.base.positiveRecurrent /\
      assumptions.base.stationaryLawExists /\
      (∫⁻ ω, assumptions.base.law.customerTime ω ∂ assumptions.base.stationaryMeasure =
        ∫⁻ ω, assumptions.base.law.sojournTime ω ∂ assumptions.base.stationaryMeasure) := by
  intro hDominated hSubstochastic hContractive hStable hService hRouting hIrreducible hPetite
  refine And.intro
    (assumptions.positiveRecurrent_holds
      hDominated hSubstochastic hContractive hStable
      hService hRouting hIrreducible hPetite) ?_
  refine And.intro
    (assumptions.stationaryLawExists_holds
      hDominated hSubstochastic hContractive hStable
      hService hRouting hIrreducible hPetite) ?_
  exact adaptive_queue_terminal_balance_from_supremum_balance_schema
    assumptions
    hOpenAgeZero
    hDominated
    hSubstochastic
    hContractive
    hStable
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
