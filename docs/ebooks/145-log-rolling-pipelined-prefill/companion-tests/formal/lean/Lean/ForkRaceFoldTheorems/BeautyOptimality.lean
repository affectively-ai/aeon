import Mathlib
import ForkRaceFoldTheorems.Axioms

namespace ForkRaceFoldTheorems

theorem linear_cost_monotone
    {base penalty deficitLeft deficitRight : Nat}
    (hDeficit : deficitLeft <= deficitRight) :
    base + penalty * deficitLeft <= base + penalty * deficitRight := by
  exact Nat.add_le_add_left (Nat.mul_le_mul_left penalty hDeficit) base

structure BeautyLinearWorkload where
  intrinsicBu : Bu
  implementationBuA : Bu
  implementationBuB : Bu
  baseLatency : Nat
  latencyPenalty : Nat
  baseWaste : Nat
  wastePenalty : Nat
  implementationBoundA : implementationBuA <= intrinsicBu
  implementationBoundB : implementationBuB <= intrinsicBu
  deficitOrder : intrinsicBu - implementationBuA <= intrinsicBu - implementationBuB

namespace BeautyLinearWorkload

def deficitA (workload : BeautyLinearWorkload) : Bu :=
  workload.intrinsicBu - workload.implementationBuA

def deficitB (workload : BeautyLinearWorkload) : Bu :=
  workload.intrinsicBu - workload.implementationBuB

def beautyA (workload : BeautyLinearWorkload) : Bu :=
  workload.intrinsicBu - workload.deficitA

def beautyB (workload : BeautyLinearWorkload) : Bu :=
  workload.intrinsicBu - workload.deficitB

def latencyA (workload : BeautyLinearWorkload) : Nat :=
  workload.baseLatency + workload.latencyPenalty * workload.deficitA

def latencyB (workload : BeautyLinearWorkload) : Nat :=
  workload.baseLatency + workload.latencyPenalty * workload.deficitB

def wasteA (workload : BeautyLinearWorkload) : Nat :=
  workload.baseWaste + workload.wastePenalty * workload.deficitA

def wasteB (workload : BeautyLinearWorkload) : Nat :=
  workload.baseWaste + workload.wastePenalty * workload.deficitB

theorem deficitA_eq
    (workload : BeautyLinearWorkload) :
    workload.deficitA = workload.intrinsicBu - workload.implementationBuA := by
  rfl

theorem deficitB_eq
    (workload : BeautyLinearWorkload) :
    workload.deficitB = workload.intrinsicBu - workload.implementationBuB := by
  rfl

theorem beautyA_eq
    (workload : BeautyLinearWorkload) :
    workload.beautyA = workload.intrinsicBu - workload.deficitA := by
  rfl

theorem beautyB_eq
    (workload : BeautyLinearWorkload) :
    workload.beautyB = workload.intrinsicBu - workload.deficitB := by
  rfl

theorem beautyA_eq_implementation
    (workload : BeautyLinearWorkload) :
    workload.beautyA = workload.implementationBuA := by
  simpa [beautyA, deficitA] using Nat.sub_sub_self workload.implementationBoundA

theorem beautyB_eq_implementation
    (workload : BeautyLinearWorkload) :
    workload.beautyB = workload.implementationBuB := by
  simpa [beautyB, deficitB] using Nat.sub_sub_self workload.implementationBoundB

theorem latency_monotone
    (workload : BeautyLinearWorkload) :
    workload.latencyA <= workload.latencyB := by
  exact linear_cost_monotone workload.deficitOrder

theorem waste_monotone
    (workload : BeautyLinearWorkload) :
    workload.wasteA <= workload.wasteB := by
  exact linear_cost_monotone workload.deficitOrder

theorem beauty_monotone
    (workload : BeautyLinearWorkload) :
    workload.beautyB <= workload.beautyA := by
  simpa [beautyA, beautyB, deficitA, deficitB] using
    (Nat.sub_le_sub_left workload.deficitOrder workload.intrinsicBu)

theorem strict_latency_monotone
    (workload : BeautyLinearWorkload)
    (hPenalty : 0 < workload.latencyPenalty)
    (hStrictDeficit : workload.deficitA < workload.deficitB) :
    workload.latencyA < workload.latencyB := by
  unfold latencyA latencyB
  exact Nat.add_lt_add_left (Nat.mul_lt_mul_of_pos_left hStrictDeficit hPenalty) _

theorem strict_waste_monotone
    (workload : BeautyLinearWorkload)
    (hPenalty : 0 < workload.wastePenalty)
    (hStrictDeficit : workload.deficitA < workload.deficitB) :
    workload.wasteA < workload.wasteB := by
  unfold wasteA wasteB
  exact Nat.add_lt_add_left (Nat.mul_lt_mul_of_pos_left hStrictDeficit hPenalty) _

theorem strict_beauty_monotone
    (workload : BeautyLinearWorkload)
    (hStrictDeficit : workload.deficitA < workload.deficitB) :
    workload.beautyB < workload.beautyA := by
  have hImplementation :
      workload.implementationBuB < workload.implementationBuA := by
    by_contra hNotStrict
    have hImplLe : workload.implementationBuA <= workload.implementationBuB :=
      Nat.le_of_not_gt hNotStrict
    have hDeficitLe : workload.deficitB <= workload.deficitA := by
      simpa [deficitA, deficitB] using
        (Nat.sub_le_sub_left hImplLe workload.intrinsicBu)
    exact (not_lt_of_ge hDeficitLe hStrictDeficit).elim
  simpa [workload.beautyA_eq_implementation, workload.beautyB_eq_implementation] using
    hImplementation

theorem zero_deficit_of_full_fit
    (workload : BeautyLinearWorkload)
    (hFullFit : workload.implementationBuA = workload.intrinsicBu) :
    workload.deficitA = 0 := by
  simp [deficitA, hFullFit]

theorem deficitB_positive_of_strict_underfit
    (workload : BeautyLinearWorkload)
    (hStrictUnderfit : workload.implementationBuB < workload.intrinsicBu) :
    0 < workload.deficitB := by
  simpa [deficitB] using Nat.sub_pos_of_lt hStrictUnderfit

theorem zero_deficit_pareto
    (workload : BeautyLinearWorkload)
    (hZeroDeficit : workload.deficitA = 0) :
    workload.deficitA = 0 ∧ workload.latencyA <= workload.latencyB ∧ workload.wasteA <= workload.wasteB := by
  exact ⟨hZeroDeficit, workload.latency_monotone, workload.waste_monotone⟩

theorem zero_deficit_strict_optimality
    (workload : BeautyLinearWorkload)
    (hFullFit : workload.implementationBuA = workload.intrinsicBu)
    (hStrictUnderfit : workload.implementationBuB < workload.intrinsicBu)
    (hLatencyPenalty : 0 < workload.latencyPenalty)
    (hWastePenalty : 0 < workload.wastePenalty) :
    workload.latencyA < workload.latencyB ∧
      workload.wasteA < workload.wasteB ∧
      workload.beautyB < workload.beautyA := by
  have hDeficitAZero : workload.deficitA = 0 :=
    workload.zero_deficit_of_full_fit hFullFit
  have hDeficitBPos : 0 < workload.deficitB :=
    workload.deficitB_positive_of_strict_underfit hStrictUnderfit
  have hStrictDeficit : workload.deficitA < workload.deficitB := by
    rw [hDeficitAZero]
    exact hDeficitBPos
  exact
    ⟨ workload.strict_latency_monotone hLatencyPenalty hStrictDeficit
    , workload.strict_waste_monotone hWastePenalty hStrictDeficit
    , workload.strict_beauty_monotone hStrictDeficit
    ⟩

def toDefinitionAssumptions
    (workload : BeautyLinearWorkload) :
    BeautyDefinitionAssumptions where
  intrinsicBu := workload.intrinsicBu
  implementationBuA := workload.implementationBuA
  implementationBuB := workload.implementationBuB
  deficitBuA := workload.deficitA
  deficitBuB := workload.deficitB
  beautyBuA := workload.beautyA
  beautyBuB := workload.beautyB
  deficitDefA := by rfl
  deficitDefB := by rfl
  beautyDefA := by rfl
  beautyDefB := by rfl

def toLatencyAssumptions
    (workload : BeautyLinearWorkload) :
    BeautyLatencyMonotonicityAssumptions where
  deficitBuA := workload.deficitA
  deficitBuB := workload.deficitB
  latencyA := workload.latencyA
  latencyB := workload.latencyB
  deficitOrder := workload.deficitOrder
  latencyMonotoneFromDeficit := by
    intro hDeficit
    exact linear_cost_monotone hDeficit

def toWasteAssumptions
    (workload : BeautyLinearWorkload) :
    BeautyWasteMonotonicityAssumptions where
  deficitBuA := workload.deficitA
  deficitBuB := workload.deficitB
  wasteA := workload.wasteA
  wasteB := workload.wasteB
  deficitOrder := workload.deficitOrder
  wasteMonotoneFromDeficit := by
    intro hDeficit
    exact linear_cost_monotone hDeficit

def toParetoAssumptions
    (workload : BeautyLinearWorkload)
    (hZeroDeficit : workload.deficitA = 0) :
    BeautyParetoAssumptions where
  deficitBuA := workload.deficitA
  deficitBuB := workload.deficitB
  latencyA := workload.latencyA
  latencyB := workload.latencyB
  wasteA := workload.wasteA
  wasteB := workload.wasteB
  zeroDeficitA := hZeroDeficit
  deficitOrder := workload.deficitOrder
  latencyMonotoneFromDeficit := by
    intro hDeficit
    exact linear_cost_monotone hDeficit
  wasteMonotoneFromDeficit := by
    intro hDeficit
    exact linear_cost_monotone hDeficit

end BeautyLinearWorkload

structure BeautyCompositionWitness where
  pipelineBu : Bu
  protocolBu : Bu
  compressionBu : Bu

namespace BeautyCompositionWitness

def globalBu (witness : BeautyCompositionWitness) : Bu :=
  witness.pipelineBu + witness.protocolBu + witness.compressionBu

theorem global_eq_sum
    (witness : BeautyCompositionWitness) :
    witness.globalBu = witness.pipelineBu + witness.protocolBu + witness.compressionBu := by
  rfl

def toAssumptions
    (witness : BeautyCompositionWitness) :
    BeautyCompositionAssumptions where
  pipelineBu := witness.pipelineBu
  protocolBu := witness.protocolBu
  compressionBu := witness.compressionBu
  globalBu := witness.globalBu
  additiveComposition := by rfl

end BeautyCompositionWitness

structure BeautyLinearOptimalityInstance where
  workload : BeautyLinearWorkload
  composition : BeautyCompositionWitness
  zeroDeficitA : workload.deficitA = 0

namespace BeautyLinearOptimalityInstance

def toAssumptions
    (certificate : BeautyLinearOptimalityInstance) :
    BeautyOptimalityAssumptions where
  definition := certificate.workload.toDefinitionAssumptions
  latency := certificate.workload.toLatencyAssumptions
  waste := certificate.workload.toWasteAssumptions
  pareto := certificate.workload.toParetoAssumptions certificate.zeroDeficitA
  composition := certificate.composition.toAssumptions
  beautyMonotoneFromDeficit := by
    intro hDeficit
    simpa [BeautyLinearWorkload.toDefinitionAssumptions, BeautyLinearWorkload.toLatencyAssumptions,
      BeautyLinearWorkload.deficitA, BeautyLinearWorkload.deficitB,
      BeautyLinearWorkload.beautyA, BeautyLinearWorkload.beautyB] using
      (Nat.sub_le_sub_left hDeficit certificate.workload.intrinsicBu)

theorem schema_instantiated
    (certificate : BeautyLinearOptimalityInstance) :
    let assumptions := certificate.toAssumptions
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
  simpa using beauty_optimality_schema certificate.toAssumptions

theorem optimality
    (certificate : BeautyLinearOptimalityInstance) :
    (certificate.workload.deficitA =
      certificate.workload.intrinsicBu - certificate.workload.implementationBuA /\
     certificate.workload.deficitB =
      certificate.workload.intrinsicBu - certificate.workload.implementationBuB /\
     certificate.workload.beautyA =
      certificate.workload.intrinsicBu - certificate.workload.deficitA /\
     certificate.workload.beautyB =
      certificate.workload.intrinsicBu - certificate.workload.deficitB) /\
    certificate.workload.latencyA <= certificate.workload.latencyB /\
    certificate.workload.wasteA <= certificate.workload.wasteB /\
    (certificate.workload.deficitA = 0 /\
      certificate.workload.latencyA <= certificate.workload.latencyB /\
      certificate.workload.wasteA <= certificate.workload.wasteB) /\
    certificate.workload.beautyB <= certificate.workload.beautyA /\
    certificate.composition.globalBu =
      certificate.composition.pipelineBu + certificate.composition.protocolBu +
        certificate.composition.compressionBu := by
  exact
    ⟨ ⟨ certificate.workload.deficitA_eq
      , certificate.workload.deficitB_eq
      , certificate.workload.beautyA_eq
      , certificate.workload.beautyB_eq
      ⟩
    , certificate.workload.latency_monotone
    , certificate.workload.waste_monotone
    , certificate.workload.zero_deficit_pareto certificate.zeroDeficitA
    , certificate.workload.beauty_monotone
    , certificate.composition.global_eq_sum
    ⟩

end BeautyLinearOptimalityInstance

end ForkRaceFoldTheorems
