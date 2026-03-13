import Mathlib
import ForkRaceFoldTheorems.Axioms

open Filter MeasureTheory
open scoped ENNReal

namespace ForkRaceFoldTheorems

abbrev VacationQueueState (maxQueue : ℕ) := Fin (maxQueue + 1) × Bool

abbrev RetrialQueueState (maxQueue maxOrbit : ℕ) :=
  Fin (maxQueue + 1) × Fin (maxOrbit + 1)

abbrev RenegingQueueState (maxQueue maxPatience : ℕ) :=
  Fin (maxQueue + 1) × Fin (maxPatience + 1)

abbrev AdaptiveRoutingQueueState (maxLeft maxRight : ℕ) :=
  Fin (maxLeft + 1) × Fin (maxRight + 1) × Bool

noncomputable def boolOpenAge (flag : Bool) : ℝ≥0∞ :=
  if flag then 1 else 0

noncomputable def vacationQueueLength {maxQueue : ℕ} (state : VacationQueueState maxQueue) : ℝ≥0∞ :=
  (state.1 : ℕ)

noncomputable def vacationOpenAge {maxQueue : ℕ} (state : VacationQueueState maxQueue) : ℝ≥0∞ :=
  boolOpenAge state.2

noncomputable def vacationCustomerTime {maxQueue : ℕ} (state : VacationQueueState maxQueue) : ℝ≥0∞ :=
  vacationQueueLength state + vacationOpenAge state

noncomputable def vacationQueueLaw (maxQueue : ℕ) : MeasureQueueLaw (VacationQueueState maxQueue) where
  customerTime := vacationCustomerTime
  sojournTime := vacationQueueLength
  openAge := vacationOpenAge
  measurableCustomerTime := measurable_of_countable vacationCustomerTime
  measurableSojournTime := measurable_of_countable vacationQueueLength
  measurableOpenAge := measurable_of_countable vacationOpenAge
  samplePathBalance := by
    intro state
    rfl

structure VacationQueueFamily (maxQueue : ℕ) where
  stationary : PMF (VacationQueueState maxQueue)
  serviceDependsOnVacation : Prop
  routingDependsOnVacation : Prop
  irreducible : Prop
  fosterLyapunovDrift : Prop
  petiteSet : Prop
  serviceDependsOnVacation_holds : serviceDependsOnVacation
  routingDependsOnVacation_holds : routingDependsOnVacation
  irreducible_holds : irreducible
  fosterLyapunovDrift_holds : fosterLyapunovDrift
  petiteSet_holds : petiteSet
  positiveRecurrent : Prop
  stationaryLawExists : Prop
  positiveRecurrenceFromDrift :
    serviceDependsOnVacation ->
    routingDependsOnVacation ->
    irreducible ->
    fosterLyapunovDrift ->
    petiteSet ->
    positiveRecurrent
  stationaryLawFromPositiveRecurrence :
    positiveRecurrent -> stationaryLawExists

structure VacationQueueKernelFamily (maxQueue : ℕ) where
  stationary : PMF (VacationQueueState maxQueue)
  serviceKernel : VacationQueueState maxQueue → ℝ
  routingKernel : VacationQueueState maxQueue → VacationQueueState maxQueue → ℝ
  lyapunov : VacationQueueState maxQueue → ℝ
  expectedLyapunov : VacationQueueState maxQueue → ℝ
  smallSet : Set (VacationQueueState maxQueue)
  driftGap : ℝ
  serviceDependsWitness :
    ∃ queueLevel : Fin (maxQueue + 1),
      serviceKernel (queueLevel, true) ≠ serviceKernel (queueLevel, false)
  routingDependsWitness :
    ∃ (queueLevel : Fin (maxQueue + 1)) (nextState : VacationQueueState maxQueue),
      routingKernel (queueLevel, true) nextState ≠ routingKernel (queueLevel, false) nextState
  irreducible : Prop
  irreducible_holds : irreducible
  driftBound :
    ∀ state ∉ smallSet, expectedLyapunov state ≤ lyapunov state - driftGap
  driftGapPositive : 0 < driftGap
  positiveRecurrent : Prop
  stationaryLawExists : Prop
  positiveRecurrenceFromDrift :
    irreducible ->
    (∀ state ∉ smallSet, expectedLyapunov state ≤ lyapunov state - driftGap) ->
    0 < driftGap ->
    positiveRecurrent
  stationaryLawFromPositiveRecurrence :
    positiveRecurrent -> stationaryLawExists

def VacationQueueKernelFamily.serviceDependsOnVacation
    {maxQueue : ℕ}
    (kernel : VacationQueueKernelFamily maxQueue) : Prop :=
  ∃ queueLevel : Fin (maxQueue + 1),
    kernel.serviceKernel (queueLevel, true) ≠ kernel.serviceKernel (queueLevel, false)

def VacationQueueKernelFamily.routingDependsOnVacation
    {maxQueue : ℕ}
    (kernel : VacationQueueKernelFamily maxQueue) : Prop :=
  ∃ (queueLevel : Fin (maxQueue + 1)) (nextState : VacationQueueState maxQueue),
    kernel.routingKernel (queueLevel, true) nextState ≠
      kernel.routingKernel (queueLevel, false) nextState

def VacationQueueKernelFamily.fosterLyapunovDrift
    {maxQueue : ℕ}
    (kernel : VacationQueueKernelFamily maxQueue) : Prop :=
  ∀ state ∉ kernel.smallSet, kernel.expectedLyapunov state ≤ kernel.lyapunov state - kernel.driftGap

def VacationQueueKernelFamily.petiteSet
    {maxQueue : ℕ}
    (kernel : VacationQueueKernelFamily maxQueue) : Prop :=
  kernel.smallSet.Finite

theorem VacationQueueKernelFamily.serviceDependsOnVacation_holds
    {maxQueue : ℕ}
    (kernel : VacationQueueKernelFamily maxQueue) :
    kernel.serviceDependsOnVacation :=
  kernel.serviceDependsWitness

theorem VacationQueueKernelFamily.routingDependsOnVacation_holds
    {maxQueue : ℕ}
    (kernel : VacationQueueKernelFamily maxQueue) :
    kernel.routingDependsOnVacation :=
  kernel.routingDependsWitness

theorem VacationQueueKernelFamily.fosterLyapunovDrift_holds
    {maxQueue : ℕ}
    (kernel : VacationQueueKernelFamily maxQueue) :
    kernel.fosterLyapunovDrift :=
  kernel.driftBound

theorem VacationQueueKernelFamily.petiteSet_holds
    {maxQueue : ℕ}
    (kernel : VacationQueueKernelFamily maxQueue) :
    kernel.petiteSet := by
  classical
  exact Set.toFinite kernel.smallSet

noncomputable def VacationQueueKernelFamily.toFamily
    {maxQueue : ℕ}
    (kernel : VacationQueueKernelFamily maxQueue) :
    VacationQueueFamily maxQueue where
  stationary := kernel.stationary
  serviceDependsOnVacation := kernel.serviceDependsOnVacation
  routingDependsOnVacation := kernel.routingDependsOnVacation
  irreducible := kernel.irreducible
  fosterLyapunovDrift := kernel.fosterLyapunovDrift
  petiteSet := kernel.petiteSet
  serviceDependsOnVacation_holds := kernel.serviceDependsOnVacation_holds
  routingDependsOnVacation_holds := kernel.routingDependsOnVacation_holds
  irreducible_holds := kernel.irreducible_holds
  fosterLyapunovDrift_holds := kernel.fosterLyapunovDrift_holds
  petiteSet_holds := kernel.petiteSet_holds
  positiveRecurrent := kernel.positiveRecurrent
  stationaryLawExists := kernel.stationaryLawExists
  positiveRecurrenceFromDrift := by
    intro _ _ hIrreducible hDrift _
    exact kernel.positiveRecurrenceFromDrift hIrreducible hDrift kernel.driftGapPositive
  stationaryLawFromPositiveRecurrence := kernel.stationaryLawFromPositiveRecurrence

noncomputable def VacationQueueFamily.stabilityAssumptions
    {maxQueue : ℕ}
    (family : VacationQueueFamily maxQueue) :
    StateDependentQueueStabilityAssumptions (VacationQueueState maxQueue) where
  law := vacationQueueLaw maxQueue
  stationaryMeasure := family.stationary.toMeasure
  stateDependentService := family.serviceDependsOnVacation
  stateDependentRouting := family.routingDependsOnVacation
  irreducible := family.irreducible
  fosterLyapunovDrift := family.fosterLyapunovDrift
  petiteSet := family.petiteSet
  positiveRecurrent := family.positiveRecurrent
  stationaryLawExists := family.stationaryLawExists
  positiveRecurrenceFromDrift := family.positiveRecurrenceFromDrift
  stationaryLawFromPositiveRecurrence := family.stationaryLawFromPositiveRecurrence

theorem vacation_openAge_zero_of_no_vacation_ae
    {maxQueue : ℕ}
    (family : VacationQueueFamily maxQueue)
    (hNoVacation : ∀ᵐ state ∂ family.stationary.toMeasure, state.2 = false) :
    (vacationQueueLaw maxQueue).openAge =ᵐ[family.stationary.toMeasure] 0 := by
  filter_upwards [hNoVacation] with state hState
  change vacationOpenAge state = 0
  simp [vacationOpenAge, boolOpenAge, hState]

theorem VacationQueueFamily.stationary_balance
    {maxQueue : ℕ}
    (family : VacationQueueFamily maxQueue) :
    family.positiveRecurrent /\
      family.stationaryLawExists /\
      (∫⁻ state, (vacationQueueLaw maxQueue).customerTime state ∂ family.stationary.toMeasure =
        ∫⁻ state, (vacationQueueLaw maxQueue).sojournTime state ∂ family.stationary.toMeasure +
          ∫⁻ state, (vacationQueueLaw maxQueue).openAge state ∂ family.stationary.toMeasure) := by
  exact state_dependent_queue_stability_schema
    family.stabilityAssumptions
    family.serviceDependsOnVacation_holds
    family.routingDependsOnVacation_holds
    family.irreducible_holds
    family.fosterLyapunovDrift_holds
    family.petiteSet_holds

theorem VacationQueueFamily.terminal_balance
    {maxQueue : ℕ}
    (family : VacationQueueFamily maxQueue)
    (hNoVacation : ∀ᵐ state ∂ family.stationary.toMeasure, state.2 = false) :
    family.positiveRecurrent /\
      family.stationaryLawExists /\
      (∫⁻ state, (vacationQueueLaw maxQueue).customerTime state ∂ family.stationary.toMeasure =
        ∫⁻ state, (vacationQueueLaw maxQueue).sojournTime state ∂ family.stationary.toMeasure) := by
  exact state_dependent_queue_terminal_balance_schema
    family.stabilityAssumptions
    (vacation_openAge_zero_of_no_vacation_ae family hNoVacation)
    family.serviceDependsOnVacation_holds
    family.routingDependsOnVacation_holds
    family.irreducible_holds
    family.fosterLyapunovDrift_holds
    family.petiteSet_holds

theorem VacationQueueKernelFamily.stationary_balance
    {maxQueue : ℕ}
    (kernel : VacationQueueKernelFamily maxQueue) :
    kernel.positiveRecurrent /\
      kernel.stationaryLawExists /\
      (∫⁻ state, (vacationQueueLaw maxQueue).customerTime state ∂ kernel.stationary.toMeasure =
        ∫⁻ state, (vacationQueueLaw maxQueue).sojournTime state ∂ kernel.stationary.toMeasure +
          ∫⁻ state, (vacationQueueLaw maxQueue).openAge state ∂ kernel.stationary.toMeasure) := by
  let assumptions : StateDependentQueueStabilityAssumptions (VacationQueueState maxQueue) := {
    law := vacationQueueLaw maxQueue
    stationaryMeasure := kernel.stationary.toMeasure
    stateDependentService := kernel.serviceDependsOnVacation
    stateDependentRouting := kernel.routingDependsOnVacation
    irreducible := kernel.irreducible
    fosterLyapunovDrift := kernel.fosterLyapunovDrift
    petiteSet := kernel.petiteSet
    positiveRecurrent := kernel.positiveRecurrent
    stationaryLawExists := kernel.stationaryLawExists
    positiveRecurrenceFromDrift := by
      intro _ _ hIrreducible hDrift _
      exact kernel.positiveRecurrenceFromDrift hIrreducible hDrift kernel.driftGapPositive
    stationaryLawFromPositiveRecurrence := kernel.stationaryLawFromPositiveRecurrence
  }
  exact state_dependent_queue_stability_schema
    assumptions
    kernel.serviceDependsOnVacation_holds
    kernel.routingDependsOnVacation_holds
    kernel.irreducible_holds
    kernel.fosterLyapunovDrift_holds
    kernel.petiteSet_holds

theorem VacationQueueKernelFamily.terminal_balance
    {maxQueue : ℕ}
    (kernel : VacationQueueKernelFamily maxQueue)
    (hNoVacation : ∀ᵐ state ∂ kernel.stationary.toMeasure, state.2 = false) :
    kernel.positiveRecurrent /\
      kernel.stationaryLawExists /\
      (∫⁻ state, (vacationQueueLaw maxQueue).customerTime state ∂ kernel.stationary.toMeasure =
        ∫⁻ state, (vacationQueueLaw maxQueue).sojournTime state ∂ kernel.stationary.toMeasure) := by
  let assumptions : StateDependentQueueStabilityAssumptions (VacationQueueState maxQueue) := {
    law := vacationQueueLaw maxQueue
    stationaryMeasure := kernel.stationary.toMeasure
    stateDependentService := kernel.serviceDependsOnVacation
    stateDependentRouting := kernel.routingDependsOnVacation
    irreducible := kernel.irreducible
    fosterLyapunovDrift := kernel.fosterLyapunovDrift
    petiteSet := kernel.petiteSet
    positiveRecurrent := kernel.positiveRecurrent
    stationaryLawExists := kernel.stationaryLawExists
    positiveRecurrenceFromDrift := by
      intro _ _ hIrreducible hDrift _
      exact kernel.positiveRecurrenceFromDrift hIrreducible hDrift kernel.driftGapPositive
    stationaryLawFromPositiveRecurrence := kernel.stationaryLawFromPositiveRecurrence
  }
  have hOpenAgeZero :
      (vacationQueueLaw maxQueue).openAge =ᵐ[kernel.stationary.toMeasure] 0 := by
    filter_upwards [hNoVacation] with state hState
    change vacationOpenAge state = 0
    simp [vacationOpenAge, boolOpenAge, hState]
  exact state_dependent_queue_terminal_balance_schema
    assumptions
    hOpenAgeZero
    kernel.serviceDependsOnVacation_holds
    kernel.routingDependsOnVacation_holds
    kernel.irreducible_holds
    kernel.fosterLyapunovDrift_holds
    kernel.petiteSet_holds

noncomputable def retrialQueueLength {maxQueue maxOrbit : ℕ}
    (state : RetrialQueueState maxQueue maxOrbit) : ℝ≥0∞ :=
  (state.1 : ℕ)

noncomputable def retrialOpenAge {maxQueue maxOrbit : ℕ}
    (state : RetrialQueueState maxQueue maxOrbit) : ℝ≥0∞ :=
  (state.2 : ℕ)

noncomputable def retrialCustomerTime {maxQueue maxOrbit : ℕ}
    (state : RetrialQueueState maxQueue maxOrbit) : ℝ≥0∞ :=
  retrialQueueLength state + retrialOpenAge state

noncomputable def retrialQueueLaw (maxQueue maxOrbit : ℕ) :
    MeasureQueueLaw (RetrialQueueState maxQueue maxOrbit) where
  customerTime := retrialCustomerTime
  sojournTime := retrialQueueLength
  openAge := retrialOpenAge
  measurableCustomerTime := measurable_of_countable retrialCustomerTime
  measurableSojournTime := measurable_of_countable retrialQueueLength
  measurableOpenAge := measurable_of_countable retrialOpenAge
  samplePathBalance := by
    intro state
    rfl

structure RetrialQueueFamily (maxQueue maxOrbit : ℕ) where
  stationary : PMF (RetrialQueueState maxQueue maxOrbit)
  serviceDependsOnOrbit : Prop
  routingDependsOnOrbit : Prop
  irreducible : Prop
  fosterLyapunovDrift : Prop
  petiteSet : Prop
  serviceDependsOnOrbit_holds : serviceDependsOnOrbit
  routingDependsOnOrbit_holds : routingDependsOnOrbit
  irreducible_holds : irreducible
  fosterLyapunovDrift_holds : fosterLyapunovDrift
  petiteSet_holds : petiteSet
  positiveRecurrent : Prop
  stationaryLawExists : Prop
  positiveRecurrenceFromDrift :
    serviceDependsOnOrbit ->
    routingDependsOnOrbit ->
    irreducible ->
    fosterLyapunovDrift ->
    petiteSet ->
    positiveRecurrent
  stationaryLawFromPositiveRecurrence :
    positiveRecurrent -> stationaryLawExists

structure RetrialQueueKernelFamily (maxQueue maxOrbit : ℕ) where
  stationary : PMF (RetrialQueueState maxQueue maxOrbit)
  serviceKernel : RetrialQueueState maxQueue maxOrbit → ℝ
  routingKernel :
    RetrialQueueState maxQueue maxOrbit → RetrialQueueState maxQueue maxOrbit → ℝ
  lyapunov : RetrialQueueState maxQueue maxOrbit → ℝ
  expectedLyapunov : RetrialQueueState maxQueue maxOrbit → ℝ
  smallSet : Set (RetrialQueueState maxQueue maxOrbit)
  driftGap : ℝ
  serviceDependsWitness :
    ∃ (queueLevel : Fin (maxQueue + 1)) (orbitA orbitB : Fin (maxOrbit + 1)),
      serviceKernel (queueLevel, orbitA) ≠ serviceKernel (queueLevel, orbitB)
  routingDependsWitness :
    ∃ (queueLevel : Fin (maxQueue + 1))
      (orbitA orbitB : Fin (maxOrbit + 1))
      (nextState : RetrialQueueState maxQueue maxOrbit),
      routingKernel (queueLevel, orbitA) nextState ≠
        routingKernel (queueLevel, orbitB) nextState
  irreducible : Prop
  irreducible_holds : irreducible
  driftBound :
    ∀ state ∉ smallSet, expectedLyapunov state ≤ lyapunov state - driftGap
  driftGapPositive : 0 < driftGap
  positiveRecurrent : Prop
  stationaryLawExists : Prop
  positiveRecurrenceFromDrift :
    irreducible ->
    (∀ state ∉ smallSet, expectedLyapunov state ≤ lyapunov state - driftGap) ->
    0 < driftGap ->
    positiveRecurrent
  stationaryLawFromPositiveRecurrence :
    positiveRecurrent -> stationaryLawExists

def RetrialQueueKernelFamily.serviceDependsOnOrbit
    {maxQueue maxOrbit : ℕ}
    (kernel : RetrialQueueKernelFamily maxQueue maxOrbit) : Prop :=
  ∃ (queueLevel : Fin (maxQueue + 1)) (orbitA orbitB : Fin (maxOrbit + 1)),
    kernel.serviceKernel (queueLevel, orbitA) ≠ kernel.serviceKernel (queueLevel, orbitB)

def RetrialQueueKernelFamily.routingDependsOnOrbit
    {maxQueue maxOrbit : ℕ}
    (kernel : RetrialQueueKernelFamily maxQueue maxOrbit) : Prop :=
  ∃ (queueLevel : Fin (maxQueue + 1))
    (orbitA orbitB : Fin (maxOrbit + 1))
    (nextState : RetrialQueueState maxQueue maxOrbit),
    kernel.routingKernel (queueLevel, orbitA) nextState ≠
      kernel.routingKernel (queueLevel, orbitB) nextState

def RetrialQueueKernelFamily.fosterLyapunovDrift
    {maxQueue maxOrbit : ℕ}
    (kernel : RetrialQueueKernelFamily maxQueue maxOrbit) : Prop :=
  ∀ state ∉ kernel.smallSet, kernel.expectedLyapunov state ≤ kernel.lyapunov state - kernel.driftGap

def RetrialQueueKernelFamily.petiteSet
    {maxQueue maxOrbit : ℕ}
    (kernel : RetrialQueueKernelFamily maxQueue maxOrbit) : Prop :=
  kernel.smallSet.Finite

theorem RetrialQueueKernelFamily.serviceDependsOnOrbit_holds
    {maxQueue maxOrbit : ℕ}
    (kernel : RetrialQueueKernelFamily maxQueue maxOrbit) :
    kernel.serviceDependsOnOrbit :=
  kernel.serviceDependsWitness

theorem RetrialQueueKernelFamily.routingDependsOnOrbit_holds
    {maxQueue maxOrbit : ℕ}
    (kernel : RetrialQueueKernelFamily maxQueue maxOrbit) :
    kernel.routingDependsOnOrbit :=
  kernel.routingDependsWitness

theorem RetrialQueueKernelFamily.fosterLyapunovDrift_holds
    {maxQueue maxOrbit : ℕ}
    (kernel : RetrialQueueKernelFamily maxQueue maxOrbit) :
    kernel.fosterLyapunovDrift :=
  kernel.driftBound

theorem RetrialQueueKernelFamily.petiteSet_holds
    {maxQueue maxOrbit : ℕ}
    (kernel : RetrialQueueKernelFamily maxQueue maxOrbit) :
    kernel.petiteSet := by
  classical
  exact Set.toFinite kernel.smallSet

noncomputable def RetrialQueueKernelFamily.toFamily
    {maxQueue maxOrbit : ℕ}
    (kernel : RetrialQueueKernelFamily maxQueue maxOrbit) :
    RetrialQueueFamily maxQueue maxOrbit where
  stationary := kernel.stationary
  serviceDependsOnOrbit := kernel.serviceDependsOnOrbit
  routingDependsOnOrbit := kernel.routingDependsOnOrbit
  irreducible := kernel.irreducible
  fosterLyapunovDrift := kernel.fosterLyapunovDrift
  petiteSet := kernel.petiteSet
  serviceDependsOnOrbit_holds := kernel.serviceDependsOnOrbit_holds
  routingDependsOnOrbit_holds := kernel.routingDependsOnOrbit_holds
  irreducible_holds := kernel.irreducible_holds
  fosterLyapunovDrift_holds := kernel.fosterLyapunovDrift_holds
  petiteSet_holds := kernel.petiteSet_holds
  positiveRecurrent := kernel.positiveRecurrent
  stationaryLawExists := kernel.stationaryLawExists
  positiveRecurrenceFromDrift := by
    intro _ _ hIrreducible hDrift _
    exact kernel.positiveRecurrenceFromDrift hIrreducible hDrift kernel.driftGapPositive
  stationaryLawFromPositiveRecurrence := kernel.stationaryLawFromPositiveRecurrence

noncomputable def RetrialQueueFamily.stabilityAssumptions
    {maxQueue maxOrbit : ℕ}
    (family : RetrialQueueFamily maxQueue maxOrbit) :
    StateDependentQueueStabilityAssumptions
      (RetrialQueueState maxQueue maxOrbit) where
  law := retrialQueueLaw maxQueue maxOrbit
  stationaryMeasure := family.stationary.toMeasure
  stateDependentService := family.serviceDependsOnOrbit
  stateDependentRouting := family.routingDependsOnOrbit
  irreducible := family.irreducible
  fosterLyapunovDrift := family.fosterLyapunovDrift
  petiteSet := family.petiteSet
  positiveRecurrent := family.positiveRecurrent
  stationaryLawExists := family.stationaryLawExists
  positiveRecurrenceFromDrift := family.positiveRecurrenceFromDrift
  stationaryLawFromPositiveRecurrence := family.stationaryLawFromPositiveRecurrence

theorem retrial_openAge_zero_of_empty_orbit_ae
    {maxQueue maxOrbit : ℕ}
    (family : RetrialQueueFamily maxQueue maxOrbit)
    (hEmptyOrbit : ∀ᵐ state ∂ family.stationary.toMeasure, (state.2 : ℕ) = 0) :
    (retrialQueueLaw maxQueue maxOrbit).openAge =ᵐ[family.stationary.toMeasure] 0 := by
  filter_upwards [hEmptyOrbit] with state hState
  change retrialOpenAge state = 0
  simp [retrialOpenAge, hState]

theorem RetrialQueueFamily.stationary_balance
    {maxQueue maxOrbit : ℕ}
    (family : RetrialQueueFamily maxQueue maxOrbit) :
    family.positiveRecurrent /\
      family.stationaryLawExists /\
      (∫⁻ state, (retrialQueueLaw maxQueue maxOrbit).customerTime state ∂ family.stationary.toMeasure =
        ∫⁻ state, (retrialQueueLaw maxQueue maxOrbit).sojournTime state ∂ family.stationary.toMeasure +
          ∫⁻ state, (retrialQueueLaw maxQueue maxOrbit).openAge state ∂ family.stationary.toMeasure) := by
  exact state_dependent_queue_stability_schema
    family.stabilityAssumptions
    family.serviceDependsOnOrbit_holds
    family.routingDependsOnOrbit_holds
    family.irreducible_holds
    family.fosterLyapunovDrift_holds
    family.petiteSet_holds

theorem RetrialQueueFamily.terminal_balance
    {maxQueue maxOrbit : ℕ}
    (family : RetrialQueueFamily maxQueue maxOrbit)
    (hEmptyOrbit : ∀ᵐ state ∂ family.stationary.toMeasure, (state.2 : ℕ) = 0) :
    family.positiveRecurrent /\
      family.stationaryLawExists /\
      (∫⁻ state, (retrialQueueLaw maxQueue maxOrbit).customerTime state ∂ family.stationary.toMeasure =
        ∫⁻ state, (retrialQueueLaw maxQueue maxOrbit).sojournTime state ∂ family.stationary.toMeasure) := by
  exact state_dependent_queue_terminal_balance_schema
    family.stabilityAssumptions
    (retrial_openAge_zero_of_empty_orbit_ae family hEmptyOrbit)
    family.serviceDependsOnOrbit_holds
    family.routingDependsOnOrbit_holds
    family.irreducible_holds
    family.fosterLyapunovDrift_holds
    family.petiteSet_holds

theorem RetrialQueueKernelFamily.stationary_balance
    {maxQueue maxOrbit : ℕ}
    (kernel : RetrialQueueKernelFamily maxQueue maxOrbit) :
    kernel.positiveRecurrent /\
      kernel.stationaryLawExists /\
      (∫⁻ state, (retrialQueueLaw maxQueue maxOrbit).customerTime state ∂ kernel.stationary.toMeasure =
        ∫⁻ state, (retrialQueueLaw maxQueue maxOrbit).sojournTime state ∂ kernel.stationary.toMeasure +
          ∫⁻ state, (retrialQueueLaw maxQueue maxOrbit).openAge state ∂ kernel.stationary.toMeasure) := by
  simpa using RetrialQueueFamily.stationary_balance kernel.toFamily

theorem RetrialQueueKernelFamily.terminal_balance
    {maxQueue maxOrbit : ℕ}
    (kernel : RetrialQueueKernelFamily maxQueue maxOrbit)
    (hEmptyOrbit : ∀ᵐ state ∂ kernel.stationary.toMeasure, (state.2 : ℕ) = 0) :
    kernel.positiveRecurrent /\
      kernel.stationaryLawExists /\
      (∫⁻ state, (retrialQueueLaw maxQueue maxOrbit).customerTime state ∂ kernel.stationary.toMeasure =
        ∫⁻ state, (retrialQueueLaw maxQueue maxOrbit).sojournTime state ∂ kernel.stationary.toMeasure) := by
  simpa using RetrialQueueFamily.terminal_balance kernel.toFamily hEmptyOrbit

noncomputable def renegingQueueLength {maxQueue maxPatience : ℕ}
    (state : RenegingQueueState maxQueue maxPatience) : ℝ≥0∞ :=
  (state.1 : ℕ)

noncomputable def renegingOpenAge {maxQueue maxPatience : ℕ}
    (state : RenegingQueueState maxQueue maxPatience) : ℝ≥0∞ :=
  (state.2 : ℕ)

noncomputable def renegingCustomerTime {maxQueue maxPatience : ℕ}
    (state : RenegingQueueState maxQueue maxPatience) : ℝ≥0∞ :=
  renegingQueueLength state + renegingOpenAge state

noncomputable def renegingQueueLaw (maxQueue maxPatience : ℕ) :
    MeasureQueueLaw (RenegingQueueState maxQueue maxPatience) where
  customerTime := renegingCustomerTime
  sojournTime := renegingQueueLength
  openAge := renegingOpenAge
  measurableCustomerTime := measurable_of_countable renegingCustomerTime
  measurableSojournTime := measurable_of_countable renegingQueueLength
  measurableOpenAge := measurable_of_countable renegingOpenAge
  samplePathBalance := by
    intro state
    rfl

/-- Unnormalized stationary weights for a queue with linear reneging pressure `γ`. -/
noncomputable def linearRenegingMass (arrival μ γ : ℝ) : ℕ → ℝ
  | 0 => 1
  | n + 1 => linearRenegingMass arrival μ γ n * (arrival / (μ + γ * ((n + 1 : ℕ) : ℝ)))

@[simp]
theorem linearRenegingMass_zero
    {arrival μ γ : ℝ} :
    linearRenegingMass arrival μ γ 0 = 1 :=
  rfl

@[simp]
theorem linearRenegingMass_succ
    {arrival μ γ : ℝ}
    (n : ℕ) :
    linearRenegingMass arrival μ γ (n + 1) =
      linearRenegingMass arrival μ γ n * (arrival / (μ + γ * ((n + 1 : ℕ) : ℝ))) :=
  rfl

theorem linearRenegingMass_nonneg
    {arrival μ γ : ℝ}
    (hArrival_nonneg : 0 ≤ arrival)
    (hμ_nonneg : 0 ≤ μ)
    (hγ_pos : 0 < γ) :
    ∀ n : ℕ, 0 ≤ linearRenegingMass arrival μ γ n
  | 0 => by simp [linearRenegingMass]
  | n + 1 => by
      have hPrev : 0 ≤ linearRenegingMass arrival μ γ n :=
        linearRenegingMass_nonneg hArrival_nonneg hμ_nonneg hγ_pos n
      have hDenPos : 0 < μ + γ * ((n + 1 : ℕ) : ℝ) := by
        have hGammaPart : 0 < γ * ((n + 1 : ℕ) : ℝ) := by positivity
        linarith
      rw [linearRenegingMass_succ]
      exact mul_nonneg hPrev (div_nonneg hArrival_nonneg hDenPos.le)

theorem linearRenegingMass_ratio_le_half_eventually
    {arrival μ γ : ℝ}
    (hArrival_nonneg : 0 ≤ arrival)
    (hμ_nonneg : 0 ≤ μ)
    (hγ_pos : 0 < γ) :
    ∀ᶠ n in atTop,
      ‖linearRenegingMass arrival μ γ (n + 1)‖ ≤
        (1 / 2 : ℝ) * ‖linearRenegingMass arrival μ γ n‖ := by
  let cutoff := Nat.ceil (2 * arrival / γ)
  refine Filter.eventually_atTop.2 ⟨cutoff, ?_⟩
  intro n hn
  have hMassNonneg : 0 ≤ linearRenegingMass arrival μ γ n :=
    linearRenegingMass_nonneg hArrival_nonneg hμ_nonneg hγ_pos n
  have hDenPos : 0 < μ + γ * ((n + 1 : ℕ) : ℝ) := by
    have hGammaPart : 0 < γ * ((n + 1 : ℕ) : ℝ) := by positivity
    linarith
  have hCutoffLe : 2 * arrival / γ ≤ (cutoff : ℝ) := by
    exact Nat.le_ceil (2 * arrival / γ)
  have hCutoffBound : 2 * arrival ≤ (n : ℝ) * γ := by
    have hNatLe : (cutoff : ℝ) ≤ n := by exact_mod_cast hn
    have hFracLe : 2 * arrival / γ ≤ (n : ℝ) := hCutoffLe.trans hNatLe
    exact (div_le_iff₀ hγ_pos).mp hFracLe
  have hGammaSucc : 2 * arrival ≤ γ * ((n + 1 : ℕ) : ℝ) := by
    have hNatLeSucc : (n : ℝ) ≤ ((n + 1 : ℕ) : ℝ) := by
      exact_mod_cast Nat.le_succ n
    have hGammaMono : (n : ℝ) * γ ≤ ((n + 1 : ℕ) : ℝ) * γ :=
      mul_le_mul_of_nonneg_right hNatLeSucc (le_of_lt hγ_pos)
    calc
      2 * arrival ≤ (n : ℝ) * γ := hCutoffBound
      _ ≤ ((n + 1 : ℕ) : ℝ) * γ := hGammaMono
      _ = γ * ((n + 1 : ℕ) : ℝ) := by ring
  have hDenLarge : 2 * arrival ≤ μ + γ * ((n + 1 : ℕ) : ℝ) := by
    nlinarith
  have hRatioHalf : arrival / (μ + γ * ((n + 1 : ℕ) : ℝ)) ≤ (1 / 2 : ℝ) := by
    apply (div_le_iff₀ hDenPos).2
    nlinarith
  have hStep :
      linearRenegingMass arrival μ γ n * (arrival / (μ + γ * ((n + 1 : ℕ) : ℝ))) ≤
        linearRenegingMass arrival μ γ n * (1 / 2 : ℝ) :=
    mul_le_mul_of_nonneg_left hRatioHalf hMassNonneg
  calc
    ‖linearRenegingMass arrival μ γ (n + 1)‖
      = linearRenegingMass arrival μ γ n * (arrival / (μ + γ * ((n + 1 : ℕ) : ℝ))) := by
          rw [linearRenegingMass_succ, Real.norm_of_nonneg]
          exact mul_nonneg hMassNonneg (div_nonneg hArrival_nonneg hDenPos.le)
    _ ≤ linearRenegingMass arrival μ γ n * (1 / 2 : ℝ) := hStep
    _ = (1 / 2 : ℝ) * ‖linearRenegingMass arrival μ γ n‖ := by
          rw [Real.norm_of_nonneg hMassNonneg]
          ring

theorem linearRenegingMass_summable
    {arrival μ γ : ℝ}
    (hArrival_nonneg : 0 ≤ arrival)
    (hμ_nonneg : 0 ≤ μ)
    (hγ_pos : 0 < γ) :
    Summable (linearRenegingMass arrival μ γ) := by
  refine summable_of_ratio_norm_eventually_le (α := ℝ) (r := 1 / 2) ?_ ?_
  · norm_num
  · exact linearRenegingMass_ratio_le_half_eventually hArrival_nonneg hμ_nonneg hγ_pos

/-- Shifted first-moment terms for the linear reneging mass sequence. -/
noncomputable def linearRenegingFirstMomentTerm (arrival μ γ : ℝ) (n : ℕ) : ℝ :=
  (((n + 1 : ℕ) : ℝ)) * linearRenegingMass arrival μ γ (n + 1)

theorem linearRenegingFirstMomentTerm_nonneg
    {arrival μ γ : ℝ}
    (hArrival_nonneg : 0 ≤ arrival)
    (hμ_nonneg : 0 ≤ μ)
    (hγ_pos : 0 < γ)
    (n : ℕ) :
    0 ≤ linearRenegingFirstMomentTerm arrival μ γ n := by
  unfold linearRenegingFirstMomentTerm
  exact mul_nonneg (by positivity)
    (linearRenegingMass_nonneg hArrival_nonneg hμ_nonneg hγ_pos (n + 1))

theorem linearRenegingFirstMomentTerm_ratio_le_half_eventually
    {arrival μ γ : ℝ}
    (hArrival_nonneg : 0 ≤ arrival)
    (hμ_nonneg : 0 ≤ μ)
    (hγ_pos : 0 < γ) :
    ∀ᶠ n in atTop,
      ‖linearRenegingFirstMomentTerm arrival μ γ (n + 1)‖ ≤
        (1 / 2 : ℝ) * ‖linearRenegingFirstMomentTerm arrival μ γ n‖ := by
  let cutoff := Nat.ceil (4 * arrival / γ)
  refine Filter.eventually_atTop.2 ⟨cutoff, ?_⟩
  intro n hn
  have hMassNonneg : 0 ≤ linearRenegingMass arrival μ γ (n + 1) :=
    linearRenegingMass_nonneg hArrival_nonneg hμ_nonneg hγ_pos (n + 1)
  have hTermNonneg : 0 ≤ linearRenegingFirstMomentTerm arrival μ γ n :=
    linearRenegingFirstMomentTerm_nonneg hArrival_nonneg hμ_nonneg hγ_pos n
  have hDenPos : 0 < μ + γ * ((n + 2 : ℕ) : ℝ) := by
    have hGammaPart : 0 < γ * ((n + 2 : ℕ) : ℝ) := by positivity
    linarith
  have hCutoffLe : 4 * arrival / γ ≤ (cutoff : ℝ) := by
    exact Nat.le_ceil (4 * arrival / γ)
  have hCutoffBound : 4 * arrival ≤ (n : ℝ) * γ := by
    have hNatLe : (cutoff : ℝ) ≤ n := by exact_mod_cast hn
    have hFracLe : 4 * arrival / γ ≤ (n : ℝ) := hCutoffLe.trans hNatLe
    exact (div_le_iff₀ hγ_pos).mp hFracLe
  have hGammaSucc : 4 * arrival ≤ γ * ((n + 2 : ℕ) : ℝ) := by
    have hNatLeTwo : (n : ℝ) ≤ ((n + 2 : ℕ) : ℝ) := by
      exact_mod_cast Nat.le_add_right n 2
    have hGammaMono : (n : ℝ) * γ ≤ ((n + 2 : ℕ) : ℝ) * γ :=
      mul_le_mul_of_nonneg_right hNatLeTwo (le_of_lt hγ_pos)
    calc
      4 * arrival ≤ (n : ℝ) * γ := hCutoffBound
      _ ≤ ((n + 2 : ℕ) : ℝ) * γ := hGammaMono
      _ = γ * ((n + 2 : ℕ) : ℝ) := by ring
  have hDenLarge : 4 * arrival ≤ μ + γ * ((n + 2 : ℕ) : ℝ) := by
    nlinarith
  have hRatioQuarter : arrival / (μ + γ * ((n + 2 : ℕ) : ℝ)) ≤ (1 / 4 : ℝ) := by
    apply (div_le_iff₀ hDenPos).2
    nlinarith
  have hRatioNonneg : 0 ≤ arrival / (μ + γ * ((n + 2 : ℕ) : ℝ)) :=
    div_nonneg hArrival_nonneg hDenPos.le
  have hCountBound : (((n + 2 : ℕ) : ℝ)) ≤ 2 * (((n + 1 : ℕ) : ℝ)) := by
    calc
      (((n + 2 : ℕ) : ℝ)) = (n : ℝ) + 2 := by norm_num
      _ ≤ 2 * ((n : ℝ) + 1) := by nlinarith
      _ = 2 * (((n + 1 : ℕ) : ℝ)) := by norm_num
  have hScaledCount :
      (((n + 2 : ℕ) : ℝ)) * linearRenegingMass arrival μ γ (n + 1) ≤
        (2 * (((n + 1 : ℕ) : ℝ))) * linearRenegingMass arrival μ γ (n + 1) :=
    mul_le_mul_of_nonneg_right hCountBound hMassNonneg
  have hProduct₁ :
      ((((n + 2 : ℕ) : ℝ)) * linearRenegingMass arrival μ γ (n + 1)) *
          (arrival / (μ + γ * ((n + 2 : ℕ) : ℝ))) ≤
        ((2 * (((n + 1 : ℕ) : ℝ))) * linearRenegingMass arrival μ γ (n + 1)) *
          (arrival / (μ + γ * ((n + 2 : ℕ) : ℝ))) :=
    mul_le_mul_of_nonneg_right hScaledCount hRatioNonneg
  have hScaledNonneg :
      0 ≤ (2 * (((n + 1 : ℕ) : ℝ))) * linearRenegingMass arrival μ γ (n + 1) := by
    positivity
  have hProduct₂ :
      ((2 * (((n + 1 : ℕ) : ℝ))) * linearRenegingMass arrival μ γ (n + 1)) *
          (arrival / (μ + γ * ((n + 2 : ℕ) : ℝ))) ≤
        ((2 * (((n + 1 : ℕ) : ℝ))) * linearRenegingMass arrival μ γ (n + 1)) * (1 / 4 : ℝ) :=
    mul_le_mul_of_nonneg_left hRatioQuarter hScaledNonneg
  calc
    ‖linearRenegingFirstMomentTerm arrival μ γ (n + 1)‖
      = ((((n + 2 : ℕ) : ℝ)) * linearRenegingMass arrival μ γ (n + 1)) *
          (arrival / (μ + γ * ((n + 2 : ℕ) : ℝ))) := by
          rw [linearRenegingFirstMomentTerm, linearRenegingMass_succ]
          rw [Real.norm_of_nonneg]
          · ring
          ·
            have hDivNonneg :
                0 ≤ arrival / (μ + γ * ((n + 2 : ℕ) : ℝ)) :=
              div_nonneg hArrival_nonneg hDenPos.le
            have hInner :
                0 ≤ linearRenegingMass arrival μ γ (n + 1) *
                  (arrival / (μ + γ * ((n + 2 : ℕ) : ℝ))) :=
              mul_nonneg hMassNonneg hDivNonneg
            exact mul_nonneg (by positivity) hInner
    _ ≤ ((2 * (((n + 1 : ℕ) : ℝ))) * linearRenegingMass arrival μ γ (n + 1)) *
          (arrival / (μ + γ * ((n + 2 : ℕ) : ℝ))) := hProduct₁
    _ ≤ ((2 * (((n + 1 : ℕ) : ℝ))) * linearRenegingMass arrival μ γ (n + 1)) * (1 / 4 : ℝ) := hProduct₂
    _ = (1 / 2 : ℝ) * ‖linearRenegingFirstMomentTerm arrival μ γ n‖ := by
          rw [Real.norm_of_nonneg hTermNonneg]
          unfold linearRenegingFirstMomentTerm
          ring

theorem linearRenegingFirstMomentTerm_summable
    {arrival μ γ : ℝ}
    (hArrival_nonneg : 0 ≤ arrival)
    (hμ_nonneg : 0 ≤ μ)
    (hγ_pos : 0 < γ) :
    Summable (linearRenegingFirstMomentTerm arrival μ γ) := by
  refine summable_of_ratio_norm_eventually_le (α := ℝ) (r := 1 / 2) ?_ ?_
  · norm_num
  · exact linearRenegingFirstMomentTerm_ratio_le_half_eventually
      hArrival_nonneg hμ_nonneg hγ_pos

theorem linearRenegingMeanQueueSummable
    {arrival μ γ : ℝ}
    (hArrival_nonneg : 0 ≤ arrival)
    (hμ_nonneg : 0 ≤ μ)
    (hγ_pos : 0 < γ) :
    Summable (fun n : ℕ => (n : ℝ) * linearRenegingMass arrival μ γ n) := by
  have hShifted :
      Summable (fun n : ℕ => ((n + 1 : ℕ) : ℝ) * linearRenegingMass arrival μ γ (n + 1)) :=
    linearRenegingFirstMomentTerm_summable hArrival_nonneg hμ_nonneg hγ_pos
  simpa [linearRenegingFirstMomentTerm] using
    ((_root_.summable_nat_add_iff (f := fun n : ℕ => (n : ℝ) * linearRenegingMass arrival μ γ n) 1).1
      hShifted)

structure RenegingQueueFamily (maxQueue maxPatience : ℕ) where
  stationary : PMF (RenegingQueueState maxQueue maxPatience)
  serviceDependsOnPatience : Prop
  routingDependsOnPatience : Prop
  irreducible : Prop
  fosterLyapunovDrift : Prop
  petiteSet : Prop
  serviceDependsOnPatience_holds : serviceDependsOnPatience
  routingDependsOnPatience_holds : routingDependsOnPatience
  irreducible_holds : irreducible
  fosterLyapunovDrift_holds : fosterLyapunovDrift
  petiteSet_holds : petiteSet
  positiveRecurrent : Prop
  stationaryLawExists : Prop
  positiveRecurrenceFromDrift :
    serviceDependsOnPatience ->
    routingDependsOnPatience ->
    irreducible ->
    fosterLyapunovDrift ->
    petiteSet ->
    positiveRecurrent
  stationaryLawFromPositiveRecurrence :
    positiveRecurrent -> stationaryLawExists

structure RenegingQueueKernelFamily (maxQueue maxPatience : ℕ) where
  stationary : PMF (RenegingQueueState maxQueue maxPatience)
  serviceKernel : RenegingQueueState maxQueue maxPatience → ℝ
  routingKernel :
    RenegingQueueState maxQueue maxPatience → RenegingQueueState maxQueue maxPatience → ℝ
  lyapunov : RenegingQueueState maxQueue maxPatience → ℝ
  expectedLyapunov : RenegingQueueState maxQueue maxPatience → ℝ
  smallSet : Set (RenegingQueueState maxQueue maxPatience)
  driftGap : ℝ
  serviceDependsWitness :
    ∃ (queueLevel : Fin (maxQueue + 1)) (patienceA patienceB : Fin (maxPatience + 1)),
      serviceKernel (queueLevel, patienceA) ≠ serviceKernel (queueLevel, patienceB)
  routingDependsWitness :
    ∃ (queueLevel : Fin (maxQueue + 1))
      (patienceA patienceB : Fin (maxPatience + 1))
      (nextState : RenegingQueueState maxQueue maxPatience),
      routingKernel (queueLevel, patienceA) nextState ≠
        routingKernel (queueLevel, patienceB) nextState
  irreducible : Prop
  irreducible_holds : irreducible
  driftBound :
    ∀ state ∉ smallSet, expectedLyapunov state ≤ lyapunov state - driftGap
  driftGapPositive : 0 < driftGap
  positiveRecurrent : Prop
  stationaryLawExists : Prop
  positiveRecurrenceFromDrift :
    irreducible ->
    (∀ state ∉ smallSet, expectedLyapunov state ≤ lyapunov state - driftGap) ->
    0 < driftGap ->
    positiveRecurrent
  stationaryLawFromPositiveRecurrence :
    positiveRecurrent -> stationaryLawExists

def RenegingQueueKernelFamily.serviceDependsOnPatience
    {maxQueue maxPatience : ℕ}
    (kernel : RenegingQueueKernelFamily maxQueue maxPatience) : Prop :=
  ∃ (queueLevel : Fin (maxQueue + 1)) (patienceA patienceB : Fin (maxPatience + 1)),
    kernel.serviceKernel (queueLevel, patienceA) ≠ kernel.serviceKernel (queueLevel, patienceB)

def RenegingQueueKernelFamily.routingDependsOnPatience
    {maxQueue maxPatience : ℕ}
    (kernel : RenegingQueueKernelFamily maxQueue maxPatience) : Prop :=
  ∃ (queueLevel : Fin (maxQueue + 1))
    (patienceA patienceB : Fin (maxPatience + 1))
    (nextState : RenegingQueueState maxQueue maxPatience),
    kernel.routingKernel (queueLevel, patienceA) nextState ≠
      kernel.routingKernel (queueLevel, patienceB) nextState

def RenegingQueueKernelFamily.fosterLyapunovDrift
    {maxQueue maxPatience : ℕ}
    (kernel : RenegingQueueKernelFamily maxQueue maxPatience) : Prop :=
  ∀ state ∉ kernel.smallSet, kernel.expectedLyapunov state ≤ kernel.lyapunov state - kernel.driftGap

def RenegingQueueKernelFamily.petiteSet
    {maxQueue maxPatience : ℕ}
    (kernel : RenegingQueueKernelFamily maxQueue maxPatience) : Prop :=
  kernel.smallSet.Finite

theorem RenegingQueueKernelFamily.serviceDependsOnPatience_holds
    {maxQueue maxPatience : ℕ}
    (kernel : RenegingQueueKernelFamily maxQueue maxPatience) :
    kernel.serviceDependsOnPatience :=
  kernel.serviceDependsWitness

theorem RenegingQueueKernelFamily.routingDependsOnPatience_holds
    {maxQueue maxPatience : ℕ}
    (kernel : RenegingQueueKernelFamily maxQueue maxPatience) :
    kernel.routingDependsOnPatience :=
  kernel.routingDependsWitness

theorem RenegingQueueKernelFamily.fosterLyapunovDrift_holds
    {maxQueue maxPatience : ℕ}
    (kernel : RenegingQueueKernelFamily maxQueue maxPatience) :
    kernel.fosterLyapunovDrift :=
  kernel.driftBound

theorem RenegingQueueKernelFamily.petiteSet_holds
    {maxQueue maxPatience : ℕ}
    (kernel : RenegingQueueKernelFamily maxQueue maxPatience) :
    kernel.petiteSet := by
  classical
  exact Set.toFinite kernel.smallSet

noncomputable def RenegingQueueKernelFamily.toFamily
    {maxQueue maxPatience : ℕ}
    (kernel : RenegingQueueKernelFamily maxQueue maxPatience) :
    RenegingQueueFamily maxQueue maxPatience where
  stationary := kernel.stationary
  serviceDependsOnPatience := kernel.serviceDependsOnPatience
  routingDependsOnPatience := kernel.routingDependsOnPatience
  irreducible := kernel.irreducible
  fosterLyapunovDrift := kernel.fosterLyapunovDrift
  petiteSet := kernel.petiteSet
  serviceDependsOnPatience_holds := kernel.serviceDependsOnPatience_holds
  routingDependsOnPatience_holds := kernel.routingDependsOnPatience_holds
  irreducible_holds := kernel.irreducible_holds
  fosterLyapunovDrift_holds := kernel.fosterLyapunovDrift_holds
  petiteSet_holds := kernel.petiteSet_holds
  positiveRecurrent := kernel.positiveRecurrent
  stationaryLawExists := kernel.stationaryLawExists
  positiveRecurrenceFromDrift := by
    intro _ _ hIrreducible hDrift _
    exact kernel.positiveRecurrenceFromDrift hIrreducible hDrift kernel.driftGapPositive
  stationaryLawFromPositiveRecurrence := kernel.stationaryLawFromPositiveRecurrence

noncomputable def RenegingQueueFamily.stabilityAssumptions
    {maxQueue maxPatience : ℕ}
    (family : RenegingQueueFamily maxQueue maxPatience) :
    StateDependentQueueStabilityAssumptions
      (RenegingQueueState maxQueue maxPatience) where
  law := renegingQueueLaw maxQueue maxPatience
  stationaryMeasure := family.stationary.toMeasure
  stateDependentService := family.serviceDependsOnPatience
  stateDependentRouting := family.routingDependsOnPatience
  irreducible := family.irreducible
  fosterLyapunovDrift := family.fosterLyapunovDrift
  petiteSet := family.petiteSet
  positiveRecurrent := family.positiveRecurrent
  stationaryLawExists := family.stationaryLawExists
  positiveRecurrenceFromDrift := family.positiveRecurrenceFromDrift
  stationaryLawFromPositiveRecurrence := family.stationaryLawFromPositiveRecurrence

theorem reneging_openAge_zero_of_no_impatience_ae
    {maxQueue maxPatience : ℕ}
    (family : RenegingQueueFamily maxQueue maxPatience)
    (hNoImpatience : ∀ᵐ state ∂ family.stationary.toMeasure, (state.2 : ℕ) = 0) :
    (renegingQueueLaw maxQueue maxPatience).openAge =ᵐ[family.stationary.toMeasure] 0 := by
  filter_upwards [hNoImpatience] with state hState
  change renegingOpenAge state = 0
  simp [renegingOpenAge, hState]

theorem RenegingQueueFamily.stationary_balance
    {maxQueue maxPatience : ℕ}
    (family : RenegingQueueFamily maxQueue maxPatience) :
    family.positiveRecurrent /\
      family.stationaryLawExists /\
      (∫⁻ state, (renegingQueueLaw maxQueue maxPatience).customerTime state ∂ family.stationary.toMeasure =
        ∫⁻ state, (renegingQueueLaw maxQueue maxPatience).sojournTime state ∂ family.stationary.toMeasure +
          ∫⁻ state, (renegingQueueLaw maxQueue maxPatience).openAge state ∂ family.stationary.toMeasure) := by
  exact state_dependent_queue_stability_schema
    family.stabilityAssumptions
    family.serviceDependsOnPatience_holds
    family.routingDependsOnPatience_holds
    family.irreducible_holds
    family.fosterLyapunovDrift_holds
    family.petiteSet_holds

theorem RenegingQueueFamily.terminal_balance
    {maxQueue maxPatience : ℕ}
    (family : RenegingQueueFamily maxQueue maxPatience)
    (hNoImpatience : ∀ᵐ state ∂ family.stationary.toMeasure, (state.2 : ℕ) = 0) :
    family.positiveRecurrent /\
      family.stationaryLawExists /\
      (∫⁻ state, (renegingQueueLaw maxQueue maxPatience).customerTime state ∂ family.stationary.toMeasure =
        ∫⁻ state, (renegingQueueLaw maxQueue maxPatience).sojournTime state ∂ family.stationary.toMeasure) := by
  exact state_dependent_queue_terminal_balance_schema
    family.stabilityAssumptions
    (reneging_openAge_zero_of_no_impatience_ae family hNoImpatience)
    family.serviceDependsOnPatience_holds
    family.routingDependsOnPatience_holds
    family.irreducible_holds
    family.fosterLyapunovDrift_holds
    family.petiteSet_holds

theorem RenegingQueueKernelFamily.stationary_balance
    {maxQueue maxPatience : ℕ}
    (kernel : RenegingQueueKernelFamily maxQueue maxPatience) :
    kernel.positiveRecurrent /\
      kernel.stationaryLawExists /\
      (∫⁻ state, (renegingQueueLaw maxQueue maxPatience).customerTime state
          ∂ kernel.stationary.toMeasure =
        ∫⁻ state, (renegingQueueLaw maxQueue maxPatience).sojournTime state
            ∂ kernel.stationary.toMeasure +
          ∫⁻ state, (renegingQueueLaw maxQueue maxPatience).openAge state
            ∂ kernel.stationary.toMeasure) := by
  simpa using RenegingQueueFamily.stationary_balance kernel.toFamily

theorem RenegingQueueKernelFamily.terminal_balance
    {maxQueue maxPatience : ℕ}
    (kernel : RenegingQueueKernelFamily maxQueue maxPatience)
    (hNoImpatience : ∀ᵐ state ∂ kernel.stationary.toMeasure, (state.2 : ℕ) = 0) :
    kernel.positiveRecurrent /\
      kernel.stationaryLawExists /\
      (∫⁻ state, (renegingQueueLaw maxQueue maxPatience).customerTime state
          ∂ kernel.stationary.toMeasure =
        ∫⁻ state, (renegingQueueLaw maxQueue maxPatience).sojournTime state
          ∂ kernel.stationary.toMeasure) := by
  simpa using RenegingQueueFamily.terminal_balance kernel.toFamily hNoImpatience

noncomputable def adaptiveRoutingQueueLength {maxLeft maxRight : ℕ}
    (state : AdaptiveRoutingQueueState maxLeft maxRight) : ℝ≥0∞ :=
  (state.1 : ℕ) + (state.2.1 : ℕ)

noncomputable def adaptiveRoutingOpenAge {maxLeft maxRight : ℕ}
    (state : AdaptiveRoutingQueueState maxLeft maxRight) : ℝ≥0∞ :=
  boolOpenAge state.2.2

noncomputable def adaptiveRoutingCustomerTime {maxLeft maxRight : ℕ}
    (state : AdaptiveRoutingQueueState maxLeft maxRight) : ℝ≥0∞ :=
  adaptiveRoutingQueueLength state + adaptiveRoutingOpenAge state

noncomputable def adaptiveRoutingQueueLaw (maxLeft maxRight : ℕ) :
    MeasureQueueLaw (AdaptiveRoutingQueueState maxLeft maxRight) where
  customerTime := adaptiveRoutingCustomerTime
  sojournTime := adaptiveRoutingQueueLength
  openAge := adaptiveRoutingOpenAge
  measurableCustomerTime := measurable_of_countable adaptiveRoutingCustomerTime
  measurableSojournTime := measurable_of_countable adaptiveRoutingQueueLength
  measurableOpenAge := measurable_of_countable adaptiveRoutingOpenAge
  samplePathBalance := by
    intro state
    rfl

structure AdaptiveRoutingQueueFamily (maxLeft maxRight : ℕ) where
  stationary : PMF (AdaptiveRoutingQueueState maxLeft maxRight)
  serviceDependsOnCongestion : Prop
  routingDependsOnCongestion : Prop
  irreducible : Prop
  fosterLyapunovDrift : Prop
  petiteSet : Prop
  serviceDependsOnCongestion_holds : serviceDependsOnCongestion
  routingDependsOnCongestion_holds : routingDependsOnCongestion
  irreducible_holds : irreducible
  fosterLyapunovDrift_holds : fosterLyapunovDrift
  petiteSet_holds : petiteSet
  positiveRecurrent : Prop
  stationaryLawExists : Prop
  positiveRecurrenceFromDrift :
    serviceDependsOnCongestion ->
    routingDependsOnCongestion ->
    irreducible ->
    fosterLyapunovDrift ->
    petiteSet ->
    positiveRecurrent
  stationaryLawFromPositiveRecurrence :
    positiveRecurrent -> stationaryLawExists

structure AdaptiveRoutingQueueKernelFamily (maxLeft maxRight : ℕ) where
  stationary : PMF (AdaptiveRoutingQueueState maxLeft maxRight)
  serviceKernel : AdaptiveRoutingQueueState maxLeft maxRight → ℝ
  routingKernel :
    AdaptiveRoutingQueueState maxLeft maxRight →
      AdaptiveRoutingQueueState maxLeft maxRight → ℝ
  lyapunov : AdaptiveRoutingQueueState maxLeft maxRight → ℝ
  expectedLyapunov : AdaptiveRoutingQueueState maxLeft maxRight → ℝ
  smallSet : Set (AdaptiveRoutingQueueState maxLeft maxRight)
  driftGap : ℝ
  serviceDependsWitness :
    ∃ stateA stateB : AdaptiveRoutingQueueState maxLeft maxRight,
      serviceKernel stateA ≠ serviceKernel stateB
  routingDependsWitness :
    ∃ stateA stateB nextState : AdaptiveRoutingQueueState maxLeft maxRight,
      routingKernel stateA nextState ≠ routingKernel stateB nextState
  irreducible : Prop
  irreducible_holds : irreducible
  driftBound :
    ∀ state ∉ smallSet, expectedLyapunov state ≤ lyapunov state - driftGap
  driftGapPositive : 0 < driftGap
  positiveRecurrent : Prop
  stationaryLawExists : Prop
  positiveRecurrenceFromDrift :
    irreducible ->
    (∀ state ∉ smallSet, expectedLyapunov state ≤ lyapunov state - driftGap) ->
    0 < driftGap ->
    positiveRecurrent
  stationaryLawFromPositiveRecurrence :
    positiveRecurrent -> stationaryLawExists

def AdaptiveRoutingQueueKernelFamily.serviceDependsOnCongestion
    {maxLeft maxRight : ℕ}
    (kernel : AdaptiveRoutingQueueKernelFamily maxLeft maxRight) : Prop :=
  ∃ stateA stateB : AdaptiveRoutingQueueState maxLeft maxRight,
    kernel.serviceKernel stateA ≠ kernel.serviceKernel stateB

def AdaptiveRoutingQueueKernelFamily.routingDependsOnCongestion
    {maxLeft maxRight : ℕ}
    (kernel : AdaptiveRoutingQueueKernelFamily maxLeft maxRight) : Prop :=
  ∃ stateA stateB nextState : AdaptiveRoutingQueueState maxLeft maxRight,
    kernel.routingKernel stateA nextState ≠ kernel.routingKernel stateB nextState

def AdaptiveRoutingQueueKernelFamily.fosterLyapunovDrift
    {maxLeft maxRight : ℕ}
    (kernel : AdaptiveRoutingQueueKernelFamily maxLeft maxRight) : Prop :=
  ∀ state ∉ kernel.smallSet, kernel.expectedLyapunov state ≤ kernel.lyapunov state - kernel.driftGap

def AdaptiveRoutingQueueKernelFamily.petiteSet
    {maxLeft maxRight : ℕ}
    (kernel : AdaptiveRoutingQueueKernelFamily maxLeft maxRight) : Prop :=
  kernel.smallSet.Finite

theorem AdaptiveRoutingQueueKernelFamily.serviceDependsOnCongestion_holds
    {maxLeft maxRight : ℕ}
    (kernel : AdaptiveRoutingQueueKernelFamily maxLeft maxRight) :
    kernel.serviceDependsOnCongestion :=
  kernel.serviceDependsWitness

theorem AdaptiveRoutingQueueKernelFamily.routingDependsOnCongestion_holds
    {maxLeft maxRight : ℕ}
    (kernel : AdaptiveRoutingQueueKernelFamily maxLeft maxRight) :
    kernel.routingDependsOnCongestion :=
  kernel.routingDependsWitness

theorem AdaptiveRoutingQueueKernelFamily.fosterLyapunovDrift_holds
    {maxLeft maxRight : ℕ}
    (kernel : AdaptiveRoutingQueueKernelFamily maxLeft maxRight) :
    kernel.fosterLyapunovDrift :=
  kernel.driftBound

theorem AdaptiveRoutingQueueKernelFamily.petiteSet_holds
    {maxLeft maxRight : ℕ}
    (kernel : AdaptiveRoutingQueueKernelFamily maxLeft maxRight) :
    kernel.petiteSet := by
  classical
  exact Set.toFinite kernel.smallSet

noncomputable def AdaptiveRoutingQueueKernelFamily.toFamily
    {maxLeft maxRight : ℕ}
    (kernel : AdaptiveRoutingQueueKernelFamily maxLeft maxRight) :
    AdaptiveRoutingQueueFamily maxLeft maxRight where
  stationary := kernel.stationary
  serviceDependsOnCongestion := kernel.serviceDependsOnCongestion
  routingDependsOnCongestion := kernel.routingDependsOnCongestion
  irreducible := kernel.irreducible
  fosterLyapunovDrift := kernel.fosterLyapunovDrift
  petiteSet := kernel.petiteSet
  serviceDependsOnCongestion_holds := kernel.serviceDependsOnCongestion_holds
  routingDependsOnCongestion_holds := kernel.routingDependsOnCongestion_holds
  irreducible_holds := kernel.irreducible_holds
  fosterLyapunovDrift_holds := kernel.fosterLyapunovDrift_holds
  petiteSet_holds := kernel.petiteSet_holds
  positiveRecurrent := kernel.positiveRecurrent
  stationaryLawExists := kernel.stationaryLawExists
  positiveRecurrenceFromDrift := by
    intro _ _ hIrreducible hDrift _
    exact kernel.positiveRecurrenceFromDrift hIrreducible hDrift kernel.driftGapPositive
  stationaryLawFromPositiveRecurrence := kernel.stationaryLawFromPositiveRecurrence

noncomputable def AdaptiveRoutingQueueFamily.stabilityAssumptions
    {maxLeft maxRight : ℕ}
    (family : AdaptiveRoutingQueueFamily maxLeft maxRight) :
    StateDependentQueueStabilityAssumptions
      (AdaptiveRoutingQueueState maxLeft maxRight) where
  law := adaptiveRoutingQueueLaw maxLeft maxRight
  stationaryMeasure := family.stationary.toMeasure
  stateDependentService := family.serviceDependsOnCongestion
  stateDependentRouting := family.routingDependsOnCongestion
  irreducible := family.irreducible
  fosterLyapunovDrift := family.fosterLyapunovDrift
  petiteSet := family.petiteSet
  positiveRecurrent := family.positiveRecurrent
  stationaryLawExists := family.stationaryLawExists
  positiveRecurrenceFromDrift := family.positiveRecurrenceFromDrift
  stationaryLawFromPositiveRecurrence := family.stationaryLawFromPositiveRecurrence

theorem adaptiveRouting_openAge_zero_of_static_policy_ae
    {maxLeft maxRight : ℕ}
    (family : AdaptiveRoutingQueueFamily maxLeft maxRight)
    (hStaticPolicy : ∀ᵐ state ∂ family.stationary.toMeasure, state.2.2 = false) :
    (adaptiveRoutingQueueLaw maxLeft maxRight).openAge =ᵐ[family.stationary.toMeasure] 0 := by
  filter_upwards [hStaticPolicy] with state hState
  change adaptiveRoutingOpenAge state = 0
  simp [adaptiveRoutingOpenAge, boolOpenAge, hState]

theorem AdaptiveRoutingQueueFamily.stationary_balance
    {maxLeft maxRight : ℕ}
    (family : AdaptiveRoutingQueueFamily maxLeft maxRight) :
    family.positiveRecurrent /\
      family.stationaryLawExists /\
      (∫⁻ state, (adaptiveRoutingQueueLaw maxLeft maxRight).customerTime state
          ∂ family.stationary.toMeasure =
        ∫⁻ state, (adaptiveRoutingQueueLaw maxLeft maxRight).sojournTime state
            ∂ family.stationary.toMeasure +
          ∫⁻ state, (adaptiveRoutingQueueLaw maxLeft maxRight).openAge state
            ∂ family.stationary.toMeasure) := by
  exact state_dependent_queue_stability_schema
    family.stabilityAssumptions
    family.serviceDependsOnCongestion_holds
    family.routingDependsOnCongestion_holds
    family.irreducible_holds
    family.fosterLyapunovDrift_holds
    family.petiteSet_holds

theorem AdaptiveRoutingQueueFamily.terminal_balance
    {maxLeft maxRight : ℕ}
    (family : AdaptiveRoutingQueueFamily maxLeft maxRight)
    (hStaticPolicy : ∀ᵐ state ∂ family.stationary.toMeasure, state.2.2 = false) :
    family.positiveRecurrent /\
      family.stationaryLawExists /\
      (∫⁻ state, (adaptiveRoutingQueueLaw maxLeft maxRight).customerTime state
          ∂ family.stationary.toMeasure =
        ∫⁻ state, (adaptiveRoutingQueueLaw maxLeft maxRight).sojournTime state
          ∂ family.stationary.toMeasure) := by
  exact state_dependent_queue_terminal_balance_schema
    family.stabilityAssumptions
    (adaptiveRouting_openAge_zero_of_static_policy_ae family hStaticPolicy)
    family.serviceDependsOnCongestion_holds
    family.routingDependsOnCongestion_holds
    family.irreducible_holds
    family.fosterLyapunovDrift_holds
    family.petiteSet_holds

theorem AdaptiveRoutingQueueKernelFamily.stationary_balance
    {maxLeft maxRight : ℕ}
    (kernel : AdaptiveRoutingQueueKernelFamily maxLeft maxRight) :
    kernel.positiveRecurrent /\
      kernel.stationaryLawExists /\
      (∫⁻ state, (adaptiveRoutingQueueLaw maxLeft maxRight).customerTime state
          ∂ kernel.stationary.toMeasure =
        ∫⁻ state, (adaptiveRoutingQueueLaw maxLeft maxRight).sojournTime state
            ∂ kernel.stationary.toMeasure +
          ∫⁻ state, (adaptiveRoutingQueueLaw maxLeft maxRight).openAge state
            ∂ kernel.stationary.toMeasure) := by
  simpa using AdaptiveRoutingQueueFamily.stationary_balance kernel.toFamily

theorem AdaptiveRoutingQueueKernelFamily.terminal_balance
    {maxLeft maxRight : ℕ}
    (kernel : AdaptiveRoutingQueueKernelFamily maxLeft maxRight)
    (hStaticPolicy : ∀ᵐ state ∂ kernel.stationary.toMeasure, state.2.2 = false) :
    kernel.positiveRecurrent /\
      kernel.stationaryLawExists /\
      (∫⁻ state, (adaptiveRoutingQueueLaw maxLeft maxRight).customerTime state
          ∂ kernel.stationary.toMeasure =
        ∫⁻ state, (adaptiveRoutingQueueLaw maxLeft maxRight).sojournTime state
          ∂ kernel.stationary.toMeasure) := by
  simpa using AdaptiveRoutingQueueFamily.terminal_balance kernel.toFamily hStaticPolicy

end ForkRaceFoldTheorems
