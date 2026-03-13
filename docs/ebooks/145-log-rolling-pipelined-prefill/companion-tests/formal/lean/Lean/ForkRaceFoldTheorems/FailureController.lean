import Mathlib
import ForkRaceFoldTheorems.FailureUniversality

namespace ForkRaceFoldTheorems

inductive FailureControllerAction where
  | keepMultiplicity
  | payVent
  | payRepair
  deriving DecidableEq, Repr

def collapseGap (liveBranches : Nat) : Nat :=
  liveBranches - 1

def exactCollapseFloor (liveBranches : Nat) : Nat :=
  collapseGap liveBranches

def keepCoefficient (alphaWeight betaWeight : Nat) : Nat :=
  alphaWeight + betaWeight

def ventCoefficient (ventWeight : Nat) : Nat :=
  ventWeight

def repairCoefficient (betaWeight repairWeight : Nat) : Nat :=
  betaWeight + repairWeight

def keepMultiplicityScore (liveBranches alphaWeight betaWeight : Nat) : Nat :=
  keepCoefficient alphaWeight betaWeight * exactCollapseFloor liveBranches

def payVentScore (liveBranches ventWeight : Nat) : Nat :=
  ventCoefficient ventWeight * exactCollapseFloor liveBranches

def payRepairScore (liveBranches betaWeight repairWeight : Nat) : Nat :=
  repairCoefficient betaWeight repairWeight * exactCollapseFloor liveBranches

def failureActionScore
    (action : FailureControllerAction)
    (liveBranches alphaWeight betaWeight ventWeight repairWeight : Nat) : Nat :=
  match action with
  | .keepMultiplicity => keepMultiplicityScore liveBranches alphaWeight betaWeight
  | .payVent => payVentScore liveBranches ventWeight
  | .payRepair => payRepairScore liveBranches betaWeight repairWeight

def chooseFailureAction
    (alphaWeight betaWeight ventWeight repairWeight : Nat) : FailureControllerAction :=
  if keepCoefficient alphaWeight betaWeight <= ventCoefficient ventWeight ∧
      keepCoefficient alphaWeight betaWeight <= repairCoefficient betaWeight repairWeight then
    .keepMultiplicity
  else if ventCoefficient ventWeight <= repairCoefficient betaWeight repairWeight then
    .payVent
  else
    .payRepair

theorem collapse_gap_positive
    {liveBranches : Nat}
    (hLive : 1 < liveBranches) :
    0 < exactCollapseFloor liveBranches := by
  unfold exactCollapseFloor collapseGap
  omega

theorem branch_isolating_floor_achievable_from_live_count
    (start : List BranchSnapshot)
    (hHasLive : 0 < liveBranchCount start) :
    CollapseCostAchievableFrom start (exactCollapseFloor (liveBranchCount start)) := by
  simpa [exactCollapseFloor, collapseGap] using collapse_cost_floor_attainable start hHasLive

theorem choose_keep_when_keep_coefficient_min
    {alphaWeight betaWeight ventWeight repairWeight : Nat}
    (hKeepVent :
      keepCoefficient alphaWeight betaWeight <= ventCoefficient ventWeight)
    (hKeepRepair :
      keepCoefficient alphaWeight betaWeight <= repairCoefficient betaWeight repairWeight) :
    chooseFailureAction alphaWeight betaWeight ventWeight repairWeight =
      .keepMultiplicity := by
  simp [chooseFailureAction, hKeepVent, hKeepRepair]

theorem choose_vent_when_vent_coefficient_min
    {alphaWeight betaWeight ventWeight repairWeight : Nat}
    (hVentRepair :
      ventCoefficient ventWeight <= repairCoefficient betaWeight repairWeight)
    (hVentKeep :
      ventCoefficient ventWeight < keepCoefficient alphaWeight betaWeight) :
    chooseFailureAction alphaWeight betaWeight ventWeight repairWeight =
      .payVent := by
  have hKeepFalse :
      ¬ (keepCoefficient alphaWeight betaWeight <= ventCoefficient ventWeight ∧
          keepCoefficient alphaWeight betaWeight <= repairCoefficient betaWeight repairWeight) := by
    intro hKeep
    omega
  simp [chooseFailureAction, hKeepFalse, hVentRepair]

theorem choose_repair_when_repair_coefficient_min
    {alphaWeight betaWeight ventWeight repairWeight : Nat}
    (hRepairKeep :
      repairCoefficient betaWeight repairWeight < keepCoefficient alphaWeight betaWeight)
    (hRepairVent :
      repairCoefficient betaWeight repairWeight < ventCoefficient ventWeight) :
    chooseFailureAction alphaWeight betaWeight ventWeight repairWeight =
      .payRepair := by
  have hKeepFalse :
      ¬ (keepCoefficient alphaWeight betaWeight <= ventCoefficient ventWeight ∧
          keepCoefficient alphaWeight betaWeight <= repairCoefficient betaWeight repairWeight) := by
    intro hKeep
    omega
  have hVentFalse :
      ¬ ventCoefficient ventWeight <= repairCoefficient betaWeight repairWeight := by
    omega
  simp [chooseFailureAction, hKeepFalse, hVentFalse]

theorem chosen_failure_action_coefficient_minimal
    (alphaWeight betaWeight ventWeight repairWeight : Nat) :
    match chooseFailureAction alphaWeight betaWeight ventWeight repairWeight with
    | .keepMultiplicity =>
        keepCoefficient alphaWeight betaWeight <= ventCoefficient ventWeight ∧
          keepCoefficient alphaWeight betaWeight <=
            repairCoefficient betaWeight repairWeight
    | .payVent =>
        ventCoefficient ventWeight <= keepCoefficient alphaWeight betaWeight ∧
          ventCoefficient ventWeight <= repairCoefficient betaWeight repairWeight
    | .payRepair =>
        repairCoefficient betaWeight repairWeight <=
            keepCoefficient alphaWeight betaWeight ∧
          repairCoefficient betaWeight repairWeight <= ventCoefficient ventWeight := by
  unfold chooseFailureAction
  split_ifs with hKeep hVent
  · exact hKeep
  · constructor
    · by_cases hKeepVent :
        keepCoefficient alphaWeight betaWeight <= ventCoefficient ventWeight
      · have hKeepRepairFalse :
          ¬ keepCoefficient alphaWeight betaWeight <=
              repairCoefficient betaWeight repairWeight := by
          intro hKeepRepair
          exact hKeep ⟨hKeepVent, hKeepRepair⟩
        omega
      · omega
    · exact hVent
  · constructor
    · by_cases hKeepVent :
        keepCoefficient alphaWeight betaWeight <= ventCoefficient ventWeight
      · have hKeepRepairFalse :
          ¬ keepCoefficient alphaWeight betaWeight <=
              repairCoefficient betaWeight repairWeight := by
          intro hKeepRepair
          exact hKeep ⟨hKeepVent, hKeepRepair⟩
        omega
      · omega
    · omega

theorem chosen_failure_action_score_minimal
    (liveBranches alphaWeight betaWeight ventWeight repairWeight : Nat) :
    failureActionScore
        (chooseFailureAction alphaWeight betaWeight ventWeight repairWeight)
        liveBranches
        alphaWeight
        betaWeight
        ventWeight
        repairWeight <=
      keepMultiplicityScore liveBranches alphaWeight betaWeight
      ∧ failureActionScore
          (chooseFailureAction alphaWeight betaWeight ventWeight repairWeight)
          liveBranches
          alphaWeight
          betaWeight
          ventWeight
          repairWeight <=
        payVentScore liveBranches ventWeight
      ∧ failureActionScore
          (chooseFailureAction alphaWeight betaWeight ventWeight repairWeight)
          liveBranches
          alphaWeight
          betaWeight
          ventWeight
          repairWeight <=
        payRepairScore liveBranches betaWeight repairWeight := by
  let gap := exactCollapseFloor liveBranches
  have hCoeff :=
    chosen_failure_action_coefficient_minimal
      alphaWeight
      betaWeight
      ventWeight
      repairWeight
  cases hChosen : chooseFailureAction alphaWeight betaWeight ventWeight repairWeight with
  | keepMultiplicity =>
      have hCoeff' :
          keepCoefficient alphaWeight betaWeight <= ventCoefficient ventWeight ∧
            keepCoefficient alphaWeight betaWeight <=
              repairCoefficient betaWeight repairWeight := by
        simpa [hChosen] using hCoeff
      rcases hCoeff' with ⟨hKeep, hRepair⟩
      constructor
      · simp [failureActionScore, keepMultiplicityScore]
      · constructor
        · simpa [failureActionScore, keepMultiplicityScore, payVentScore, gap]
            using Nat.mul_le_mul_right gap hKeep
        · simpa [failureActionScore, keepMultiplicityScore, payRepairScore, gap]
            using Nat.mul_le_mul_right gap hRepair
  | payVent =>
      have hCoeff' :
          ventCoefficient ventWeight <= keepCoefficient alphaWeight betaWeight ∧
            ventCoefficient ventWeight <=
              repairCoefficient betaWeight repairWeight := by
        simpa [hChosen] using hCoeff
      rcases hCoeff' with ⟨hKeep, hRepair⟩
      constructor
      · simpa [failureActionScore, keepMultiplicityScore, payVentScore, gap]
          using Nat.mul_le_mul_right gap hKeep
      · constructor
        · simp [failureActionScore, payVentScore]
        · simpa [failureActionScore, payVentScore, payRepairScore, gap]
            using Nat.mul_le_mul_right gap hRepair
  | payRepair =>
      have hCoeff' :
          repairCoefficient betaWeight repairWeight <=
              keepCoefficient alphaWeight betaWeight ∧
            repairCoefficient betaWeight repairWeight <=
              ventCoefficient ventWeight := by
        simpa [hChosen] using hCoeff
      rcases hCoeff' with ⟨hKeep, hVent⟩
      constructor
      · simpa [failureActionScore, keepMultiplicityScore, payRepairScore, gap]
          using Nat.mul_le_mul_right gap hKeep
      · constructor
        · simpa [failureActionScore, payVentScore, payRepairScore, gap]
            using Nat.mul_le_mul_right gap hVent
        · simp [failureActionScore, payRepairScore]

end ForkRaceFoldTheorems
