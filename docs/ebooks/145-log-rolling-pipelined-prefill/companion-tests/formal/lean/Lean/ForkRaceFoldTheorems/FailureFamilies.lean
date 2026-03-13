import Mathlib

namespace ForkRaceFoldTheorems

structure BranchSnapshot where
  survives : Bool
  output : List Nat
deriving DecidableEq, Repr

def deterministicFold : List BranchSnapshot -> List Nat
  | [] => []
  | branch :: rest =>
      (if branch.survives then branch.output else []) ++ deterministicFold rest

def projectSurvivorMask :
    List BranchSnapshot -> List BranchSnapshot -> List BranchSnapshot
  | before :: beforeRest, after :: afterRest =>
      { survives := after.survives, output := before.output } ::
        projectSurvivorMask beforeRest afterRest
  | _, _ => []

def BranchIsolating : List BranchSnapshot -> List BranchSnapshot -> Prop
  | [], [] => True
  | before :: beforeRest, after :: afterRest =>
      BranchIsolating beforeRest afterRest /\
        (after.survives = true -> before.survives = true /\ after.output = before.output)
  | _, _ => False

def repairDebt : List BranchSnapshot -> List BranchSnapshot -> Nat
  | before :: beforeRest, after :: afterRest =>
      (if after.survives then if before.output = after.output then 0 else 1 else 0) +
        repairDebt beforeRest afterRest
  | _, _ => 0

def ContagiousFailure : List BranchSnapshot -> List BranchSnapshot -> Prop
  | [], [] => False
  | before :: beforeRest, after :: afterRest =>
      (after.survives = true /\ before.output ≠ after.output) \/
        ContagiousFailure beforeRest afterRest
  | _, _ => False

theorem branch_isolating_preserves_deterministic_fold :
    ∀ before after,
      BranchIsolating before after ->
      deterministicFold after = deterministicFold (projectSurvivorMask before after)
  | [], [], _ => by
      simp [deterministicFold, projectSurvivorMask]
  | [], _ :: _, h => by
      cases h
  | _ :: _, [], h => by
      cases h
  | beforeHead :: beforeRest, afterHead :: afterRest, h => by
      rcases h with ⟨hTail, hHead⟩
      have hTailEq :=
        branch_isolating_preserves_deterministic_fold beforeRest afterRest hTail
      by_cases hSurvives : afterHead.survives = true
      · have hOutputEq : afterHead.output = beforeHead.output := (hHead hSurvives).2
        simp [deterministicFold, projectSurvivorMask, hSurvives, hOutputEq, hTailEq]
      · have hFalse : afterHead.survives = false := by
          cases hValue : afterHead.survives <;> simp_all
        simp [deterministicFold, projectSurvivorMask, hFalse, hTailEq]

theorem branch_isolating_has_zero_repair_debt :
    ∀ before after,
      BranchIsolating before after ->
      repairDebt before after = 0
  | [], [], _ => by
      simp [repairDebt]
  | [], _ :: _, h => by
      cases h
  | _ :: _, [], h => by
      cases h
  | beforeHead :: beforeRest, afterHead :: afterRest, h => by
      rcases h with ⟨hTail, hHead⟩
      have hTailZero := branch_isolating_has_zero_repair_debt beforeRest afterRest hTail
      by_cases hSurvives : afterHead.survives = true
      · have hOutputEq : afterHead.output = beforeHead.output := (hHead hSurvives).2
        simp [repairDebt, hSurvives, hOutputEq, hTailZero]
      · have hFalse : afterHead.survives = false := by
          cases hValue : afterHead.survives <;> simp_all
        simp [repairDebt, hFalse, hTailZero]

theorem branch_isolating_blocks_contagion :
    ∀ before after,
      BranchIsolating before after ->
      ¬ ContagiousFailure before after
  | [], [], _ => by
      simp [ContagiousFailure]
  | [], _ :: _, h => by
      cases h
  | _ :: _, [], h => by
      cases h
  | beforeHead :: beforeRest, afterHead :: afterRest, h => by
      rcases h with ⟨hTail, hHead⟩
      intro hContagious
      rcases hContagious with hHeadContagious | hTailContagious
      · rcases hHeadContagious with ⟨hSurvives, hChanged⟩
        exact hChanged ((hHead hSurvives).2.symm)
      · exact branch_isolating_blocks_contagion beforeRest afterRest hTail hTailContagious

theorem contagious_failure_forces_repair_debt :
    ∀ before after,
      ContagiousFailure before after ->
      0 < repairDebt before after
  | [], [], h => by
      cases h
  | [], _ :: _, h => by
      cases h
  | _ :: _, [], h => by
      cases h
  | beforeHead :: beforeRest, afterHead :: afterRest, h => by
      rcases h with hHeadContagious | hTailContagious
      · rcases hHeadContagious with ⟨hSurvives, hChanged⟩
        simp [repairDebt, hSurvives, hChanged]
      · have hTailPositive :
          0 < repairDebt beforeRest afterRest :=
            contagious_failure_forces_repair_debt beforeRest afterRest hTailContagious
        by_cases hSurvives : afterHead.survives = true
        · by_cases hOutputEq : beforeHead.output = afterHead.output
          · simp [repairDebt, hSurvives, hOutputEq, hTailPositive]
          · simp [repairDebt, hSurvives, hOutputEq, hTailPositive]
        · have hFalse : afterHead.survives = false := by
            cases hValue : afterHead.survives <;> simp_all
          simp [repairDebt, hFalse, hTailPositive]

end ForkRaceFoldTheorems
