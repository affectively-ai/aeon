import Mathlib
import ForkRaceFoldTheorems.FailureController

namespace ForkRaceFoldTheorems

inductive FailureParetoAction where
  | keepMultiplicity
  | payVent
  | payRepair
  deriving DecidableEq, Repr

structure FailureObjectivePoint where
  wallaceNumber : Nat
  buleyNumber : Nat
  ventCost : Nat
  repairDebt : Nat
  deriving DecidableEq, Repr

def failureObjectivePoint
    (liveBranches : Nat)
    (action : FailureParetoAction) : FailureObjectivePoint :=
  match action with
  | .keepMultiplicity =>
      { wallaceNumber := exactCollapseFloor liveBranches
        buleyNumber := exactCollapseFloor liveBranches
        ventCost := 0
        repairDebt := 0 }
  | .payVent =>
      { wallaceNumber := 0
        buleyNumber := 0
        ventCost := exactCollapseFloor liveBranches
        repairDebt := 0 }
  | .payRepair =>
      { wallaceNumber := 0
        buleyNumber := exactCollapseFloor liveBranches
        ventCost := 0
        repairDebt := exactCollapseFloor liveBranches }

def weaklyDominates (left right : FailureObjectivePoint) : Prop :=
  left.wallaceNumber <= right.wallaceNumber ∧
    left.buleyNumber <= right.buleyNumber ∧
    left.ventCost <= right.ventCost ∧
    left.repairDebt <= right.repairDebt

def dominates (left right : FailureObjectivePoint) : Prop :=
  weaklyDominates left right ∧ left ≠ right

def ParetoOptimalAmongCanonical
    (liveBranches : Nat)
    (action : FailureParetoAction) : Prop :=
  ∀ challenger,
    challenger ≠ action ->
      ¬ dominates
        (failureObjectivePoint liveBranches challenger)
        (failureObjectivePoint liveBranches action)

theorem keep_not_dominated_by_pay_vent
    {liveBranches : Nat}
    (hLive : 1 < liveBranches) :
    ¬ dominates
      (failureObjectivePoint liveBranches .payVent)
      (failureObjectivePoint liveBranches .keepMultiplicity) := by
  intro hDom
  have hGap : 0 < exactCollapseFloor liveBranches := collapse_gap_positive hLive
  exact Nat.not_lt_zero _ (Nat.lt_of_lt_of_le hGap hDom.1.2.2.1)

theorem keep_not_dominated_by_pay_repair
    {liveBranches : Nat}
    (hLive : 1 < liveBranches) :
    ¬ dominates
      (failureObjectivePoint liveBranches .payRepair)
      (failureObjectivePoint liveBranches .keepMultiplicity) := by
  intro hDom
  have hGap : 0 < exactCollapseFloor liveBranches := collapse_gap_positive hLive
  exact Nat.not_lt_zero _ (Nat.lt_of_lt_of_le hGap hDom.1.2.2.2)

theorem pay_vent_not_dominated_by_keep
    {liveBranches : Nat}
    (hLive : 1 < liveBranches) :
    ¬ dominates
      (failureObjectivePoint liveBranches .keepMultiplicity)
      (failureObjectivePoint liveBranches .payVent) := by
  intro hDom
  have hGap : 0 < exactCollapseFloor liveBranches := collapse_gap_positive hLive
  exact Nat.not_lt_zero _ (Nat.lt_of_lt_of_le hGap hDom.1.1)

theorem pay_vent_not_dominated_by_pay_repair
    {liveBranches : Nat}
    (hLive : 1 < liveBranches) :
    ¬ dominates
      (failureObjectivePoint liveBranches .payRepair)
      (failureObjectivePoint liveBranches .payVent) := by
  intro hDom
  have hGap : 0 < exactCollapseFloor liveBranches := collapse_gap_positive hLive
  exact Nat.not_lt_zero _ (Nat.lt_of_lt_of_le hGap hDom.1.2.1)

theorem pay_repair_not_dominated_by_keep
    {liveBranches : Nat}
    (hLive : 1 < liveBranches) :
    ¬ dominates
      (failureObjectivePoint liveBranches .keepMultiplicity)
      (failureObjectivePoint liveBranches .payRepair) := by
  intro hDom
  have hGap : 0 < exactCollapseFloor liveBranches := collapse_gap_positive hLive
  exact Nat.not_lt_zero _ (Nat.lt_of_lt_of_le hGap hDom.1.1)

theorem pay_repair_not_dominated_by_pay_vent
    {liveBranches : Nat}
    (hLive : 1 < liveBranches) :
    ¬ dominates
      (failureObjectivePoint liveBranches .payVent)
      (failureObjectivePoint liveBranches .payRepair) := by
  intro hDom
  have hGap : 0 < exactCollapseFloor liveBranches := collapse_gap_positive hLive
  exact Nat.not_lt_zero _ (Nat.lt_of_lt_of_le hGap hDom.1.2.2.1)

theorem keep_is_pareto_optimal
    {liveBranches : Nat}
    (hLive : 1 < liveBranches) :
    ParetoOptimalAmongCanonical liveBranches .keepMultiplicity := by
  intro challenger hNe
  cases challenger with
  | keepMultiplicity =>
      contradiction
  | payVent =>
      exact keep_not_dominated_by_pay_vent hLive
  | payRepair =>
      exact keep_not_dominated_by_pay_repair hLive

theorem pay_vent_is_pareto_optimal
    {liveBranches : Nat}
    (hLive : 1 < liveBranches) :
    ParetoOptimalAmongCanonical liveBranches .payVent := by
  intro challenger hNe
  cases challenger with
  | keepMultiplicity =>
      exact pay_vent_not_dominated_by_keep hLive
  | payVent =>
      contradiction
  | payRepair =>
      exact pay_vent_not_dominated_by_pay_repair hLive

theorem pay_repair_is_pareto_optimal
    {liveBranches : Nat}
    (hLive : 1 < liveBranches) :
    ParetoOptimalAmongCanonical liveBranches .payRepair := by
  intro challenger hNe
  cases challenger with
  | keepMultiplicity =>
      exact pay_repair_not_dominated_by_keep hLive
  | payVent =>
      exact pay_repair_not_dominated_by_pay_vent hLive
  | payRepair =>
      contradiction

theorem canonical_failure_actions_are_pareto
    {liveBranches : Nat}
    (hLive : 1 < liveBranches) :
    ParetoOptimalAmongCanonical liveBranches .keepMultiplicity ∧
      ParetoOptimalAmongCanonical liveBranches .payVent ∧
      ParetoOptimalAmongCanonical liveBranches .payRepair := by
  exact
    ⟨ keep_is_pareto_optimal hLive
    , pay_vent_is_pareto_optimal hLive
    , pay_repair_is_pareto_optimal hLive
    ⟩

end ForkRaceFoldTheorems
