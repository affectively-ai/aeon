import Mathlib
import ForkRaceFoldTheorems.FailureFamilies

namespace ForkRaceFoldTheorems

def alignedSnapshots (before after : List BranchSnapshot) : Prop :=
  before.length = after.length

def liveBranchCount : List BranchSnapshot -> Nat
  | [] => 0
  | branch :: rest =>
      (if branch.survives then 1 else 0) + liveBranchCount rest

def ventedCount : List BranchSnapshot -> List BranchSnapshot -> Nat
  | before :: beforeRest, after :: afterRest =>
      (if before.survives && !after.survives then 1 else 0) +
        ventedCount beforeRest afterRest
  | [], [] => 0
  | _, _ => 0

def singleSurvivor (branches : List BranchSnapshot) : Prop :=
  liveBranchCount branches = 1

def zeroWaste (before after : List BranchSnapshot) : Prop :=
  ventedCount before after = 0 /\ repairDebt before after = 0

def deterministicCollapse (before after : List BranchSnapshot) : Prop :=
  deterministicFold after = deterministicFold (projectSurvivorMask before after) /\
    singleSurvivor after

theorem zero_vent_preserves_live_branch_lower_bound :
    ∀ before after,
      alignedSnapshots before after ->
      ventedCount before after = 0 ->
      liveBranchCount before <= liveBranchCount after
  | [], [], _, _ => by
      simp [liveBranchCount]
  | [], _ :: _, hAligned, _ => by
      cases hAligned
  | _ :: _, [], hAligned, _ => by
      cases hAligned
  | beforeHead :: beforeRest, afterHead :: afterRest, hAligned, hZero => by
      have hTailAligned : alignedSnapshots beforeRest afterRest := by
        simpa [alignedSnapshots] using Nat.succ.inj hAligned
      by_cases hBeforeSurv : beforeHead.survives = true
      · by_cases hAfterSurv : afterHead.survives = true
        · have hTailZero : ventedCount beforeRest afterRest = 0 := by
            simpa [ventedCount, hBeforeSurv, hAfterSurv] using hZero
          have hTailLower :=
            zero_vent_preserves_live_branch_lower_bound beforeRest afterRest hTailAligned hTailZero
          have hStep : 1 + liveBranchCount beforeRest ≤ 1 + liveBranchCount afterRest := by
            simpa [Nat.succ_eq_add_one] using Nat.succ_le_succ hTailLower
          simpa [liveBranchCount, hBeforeSurv, hAfterSurv] using hStep
        · have hAfterFalse : afterHead.survives = false := by
            cases hValue : afterHead.survives <;> simp_all
          have : False := by
            simp [ventedCount, hBeforeSurv, hAfterFalse] at hZero
          exact False.elim this
      · have hBeforeFalse : beforeHead.survives = false := by
          cases hValue : beforeHead.survives <;> simp_all
        by_cases hAfterSurv : afterHead.survives = true
        · have hTailZero : ventedCount beforeRest afterRest = 0 := by
            simpa [ventedCount, hBeforeFalse, hAfterSurv] using hZero
          have hTailLower :=
            zero_vent_preserves_live_branch_lower_bound beforeRest afterRest hTailAligned hTailZero
          have hStep : liveBranchCount beforeRest <= 1 + liveBranchCount afterRest := by
            simpa [Nat.succ_eq_add_one, Nat.add_comm] using Nat.le_succ_of_le hTailLower
          simpa [liveBranchCount, hBeforeFalse, hAfterSurv] using hStep
        · have hAfterFalse : afterHead.survives = false := by
            cases hValue : afterHead.survives <;> simp_all
          have hTailZero : ventedCount beforeRest afterRest = 0 := by
            simpa [ventedCount, hBeforeFalse, hAfterFalse] using hZero
          have hTailLower :=
            zero_vent_preserves_live_branch_lower_bound beforeRest afterRest hTailAligned hTailZero
          simpa [liveBranchCount, hBeforeFalse, hAfterFalse] using hTailLower

theorem zero_vent_precludes_single_survivor_collapse
    {before after : List BranchSnapshot}
    (hAligned : alignedSnapshots before after)
    (hForked : 1 < liveBranchCount before)
    (hZeroVent : ventedCount before after = 0) :
    ¬ singleSurvivor after := by
  intro hSingle
  have hLower :=
    zero_vent_preserves_live_branch_lower_bound before after hAligned hZeroVent
  unfold singleSurvivor at hSingle
  rw [hSingle] at hLower
  omega

theorem nontrivial_fork_no_waste_precludes_deterministic_collapse
    {before after : List BranchSnapshot}
    (hAligned : alignedSnapshots before after)
    (hForked : 1 < liveBranchCount before)
    (hNoWaste : zeroWaste before after) :
    ¬ deterministicCollapse before after := by
  intro hCollapse
  exact zero_vent_precludes_single_survivor_collapse hAligned hForked hNoWaste.1 hCollapse.2

theorem deterministic_single_survivor_collapse_requires_waste
    {before after : List BranchSnapshot}
    (hAligned : alignedSnapshots before after)
    (hForked : 1 < liveBranchCount before)
    (hCollapse : deterministicCollapse before after) :
    0 < ventedCount before after \/ 0 < repairDebt before after := by
  by_cases hZeroVent : ventedCount before after = 0
  · right
    by_cases hZeroDebt : repairDebt before after = 0
    · have hImpossible :=
        nontrivial_fork_no_waste_precludes_deterministic_collapse
          hAligned hForked ⟨hZeroVent, hZeroDebt⟩
      exact False.elim (hImpossible hCollapse)
    · exact Nat.pos_of_ne_zero hZeroDebt
  · left
    exact Nat.pos_of_ne_zero hZeroVent

theorem contagious_failure_cannot_be_entropy_free
    {before after : List BranchSnapshot}
    (hContagious : ContagiousFailure before after) :
    ¬ zeroWaste before after := by
  intro hNoWaste
  have hDebtPositive := contagious_failure_forces_repair_debt before after hContagious
  rw [hNoWaste.2] at hDebtPositive
  exact (Nat.lt_irrefl 0) hDebtPositive

theorem contagious_global_recovery_preserves_branch_mass_and_forces_debt
    {before after : List BranchSnapshot}
    (hAligned : alignedSnapshots before after)
    (hZeroVent : ventedCount before after = 0)
    (hContagious : ContagiousFailure before after) :
    liveBranchCount before <= liveBranchCount after /\ 0 < repairDebt before after := by
  exact
    ⟨ zero_vent_preserves_live_branch_lower_bound before after hAligned hZeroVent
    , contagious_failure_forces_repair_debt before after hContagious
    ⟩

end ForkRaceFoldTheorems
