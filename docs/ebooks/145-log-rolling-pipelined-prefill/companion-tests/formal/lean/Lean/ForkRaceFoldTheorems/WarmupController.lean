import Mathlib
import ForkRaceFoldTheorems.WarmupEfficiency

namespace ForkRaceFoldTheorems

inductive WarmupControllerAction where
  | expand
  | constrain
  | shedLoad
  deriving DecidableEq, Repr

def totalDeficit (underDeficit overDeficit : Nat) : Nat :=
  underDeficit + overDeficit

def expandResidual (underDeficit overDeficit : Nat) : Nat :=
  if 0 < underDeficit then (underDeficit - 1) + overDeficit else totalDeficit underDeficit overDeficit

def constrainResidual (underDeficit overDeficit : Nat) : Nat :=
  if 0 < overDeficit then underDeficit + (overDeficit - 1) else totalDeficit underDeficit overDeficit

def shedResidual (underDeficit overDeficit : Nat) : Nat :=
  totalDeficit underDeficit overDeficit

def controllerBurden (sequentialCapacity recoveredOverlap buleyRise : Nat) : Nat :=
  burdenScalar sequentialCapacity recoveredOverlap buleyRise

def repairRedline (deficitWeight shedPenalty : Nat) : Nat :=
  deficitWeight + shedPenalty

def expandScore
    (sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight : Nat) : Nat :=
  controllerBurden sequentialCapacity recoveredOverlap buleyRise +
    deficitWeight * expandResidual underDeficit overDeficit

def constrainScore
    (sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight : Nat) : Nat :=
  controllerBurden sequentialCapacity recoveredOverlap buleyRise +
    deficitWeight * constrainResidual underDeficit overDeficit

def shedScore (underDeficit overDeficit deficitWeight shedPenalty : Nat) : Nat :=
  deficitWeight * shedResidual underDeficit overDeficit + shedPenalty

def chooseWarmupAction
    (sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty :
      Nat) : WarmupControllerAction :=
  if expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <=
      constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight ∧
      expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <=
        shedScore underDeficit overDeficit deficitWeight shedPenalty then
    .expand
  else if constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <=
      shedScore underDeficit overDeficit deficitWeight shedPenalty then
    .constrain
  else
    .shedLoad

theorem weighted_predecessor_split
    {width deficitWeight : Nat}
    (hWidth : 0 < width) :
    deficitWeight * width = deficitWeight * (width - 1) + deficitWeight := by
  have hSplit : width - 1 + 1 = width := by
    exact Nat.sub_add_cancel (Nat.succ_le_of_lt hWidth)
  calc
    deficitWeight * width
      = deficitWeight * (width - 1 + 1) := by
          exact congrArg (fun t => deficitWeight * t) hSplit.symm
    _ = deficitWeight * (width - 1) + deficitWeight * 1 := by rw [Nat.mul_add]
    _ = deficitWeight * (width - 1) + deficitWeight := by rw [Nat.mul_one]

theorem expandResidual_under_only
    {underDeficit overDeficit : Nat}
    (hUnder : 0 < underDeficit)
    (hOver : overDeficit = 0) :
    expandResidual underDeficit overDeficit = underDeficit - 1 := by
  simp [expandResidual, hUnder, hOver]

theorem constrainResidual_under_only
    {underDeficit overDeficit : Nat}
    (_hUnder : 0 < underDeficit)
    (hOver : overDeficit = 0) :
    constrainResidual underDeficit overDeficit = underDeficit := by
  simp [constrainResidual, totalDeficit, hOver]

theorem shedResidual_under_only
    {underDeficit overDeficit : Nat}
    (hOver : overDeficit = 0) :
    shedResidual underDeficit overDeficit = underDeficit := by
  simp [shedResidual, totalDeficit, hOver]

theorem constrainResidual_over_only
    {underDeficit overDeficit : Nat}
    (hUnder : underDeficit = 0)
    (hOver : 0 < overDeficit) :
    constrainResidual underDeficit overDeficit = overDeficit - 1 := by
  simp [constrainResidual, hUnder, hOver]

theorem expandResidual_over_only
    {underDeficit overDeficit : Nat}
    (hUnder : underDeficit = 0)
    (_hOver : 0 < overDeficit) :
    expandResidual underDeficit overDeficit = overDeficit := by
  simp [expandResidual, totalDeficit, hUnder]

theorem shedResidual_over_only
    {underDeficit overDeficit : Nat}
    (hUnder : underDeficit = 0) :
    shedResidual underDeficit overDeficit = overDeficit := by
  simp [shedResidual, totalDeficit, hUnder]

theorem expandScore_under_form
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight : Nat}
    (hUnder : 0 < underDeficit)
    (hOver : overDeficit = 0) :
    expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight =
      deficitWeight * (underDeficit - 1) +
        controllerBurden sequentialCapacity recoveredOverlap buleyRise := by
  unfold expandScore
  rw [expandResidual_under_only hUnder hOver]
  ac_rfl

theorem constrainScore_under_form
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight : Nat}
    (hUnder : 0 < underDeficit)
    (hOver : overDeficit = 0) :
    constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight =
      deficitWeight * underDeficit + controllerBurden sequentialCapacity recoveredOverlap buleyRise := by
  unfold constrainScore
  rw [constrainResidual_under_only hUnder hOver]
  ac_rfl

theorem shedScore_under_form
    {underDeficit overDeficit deficitWeight shedPenalty : Nat}
    (hUnder : 0 < underDeficit)
    (hOver : overDeficit = 0) :
    shedScore underDeficit overDeficit deficitWeight shedPenalty =
      deficitWeight * (underDeficit - 1) + repairRedline deficitWeight shedPenalty := by
  unfold shedScore repairRedline
  rw [shedResidual_under_only hOver, weighted_predecessor_split (deficitWeight := deficitWeight) hUnder]
  ac_rfl

theorem constrainScore_over_form
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight : Nat}
    (hUnder : underDeficit = 0)
    (hOver : 0 < overDeficit) :
    constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight =
      deficitWeight * (overDeficit - 1) +
        controllerBurden sequentialCapacity recoveredOverlap buleyRise := by
  unfold constrainScore
  rw [constrainResidual_over_only hUnder hOver]
  ac_rfl

theorem expandScore_over_form
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight : Nat}
    (hUnder : underDeficit = 0)
    (hOver : 0 < overDeficit) :
    expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight =
      deficitWeight * overDeficit + controllerBurden sequentialCapacity recoveredOverlap buleyRise := by
  unfold expandScore
  rw [expandResidual_over_only hUnder hOver]
  ac_rfl

theorem shedScore_over_form
    {underDeficit overDeficit deficitWeight shedPenalty : Nat}
    (hUnder : underDeficit = 0)
    (hOver : 0 < overDeficit) :
    shedScore underDeficit overDeficit deficitWeight shedPenalty =
      deficitWeight * (overDeficit - 1) + repairRedline deficitWeight shedPenalty := by
  unfold shedScore repairRedline
  rw [shedResidual_over_only hUnder, weighted_predecessor_split (deficitWeight := deficitWeight) hOver]
  ac_rfl

theorem expand_score_plus_weight_eq_constrain
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight : Nat}
    (hUnder : 0 < underDeficit)
    (hOver : overDeficit = 0) :
    expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight +
        deficitWeight =
      constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight := by
  rw [expandScore_under_form hUnder hOver, constrainScore_under_form hUnder hOver]
  rw [weighted_predecessor_split (deficitWeight := deficitWeight) hUnder]
  ac_rfl

theorem constrain_score_plus_weight_eq_expand
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight : Nat}
    (hUnder : underDeficit = 0)
    (hOver : 0 < overDeficit) :
    constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight +
        deficitWeight =
      expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight := by
  rw [constrainScore_over_form hUnder hOver, expandScore_over_form hUnder hOver]
  rw [weighted_predecessor_split (deficitWeight := deficitWeight) hOver]
  ac_rfl

theorem expand_lt_constrain_when_under
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight : Nat}
    (hUnder : 0 < underDeficit)
    (hOver : overDeficit = 0)
    (hDeficitWeight : 0 < deficitWeight) :
    expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <
      constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight := by
  calc
    expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <
        expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight +
          deficitWeight := by exact Nat.lt_add_of_pos_right hDeficitWeight
    _ = constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight :=
      expand_score_plus_weight_eq_constrain hUnder hOver

theorem constrain_lt_expand_when_over
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight : Nat}
    (hUnder : underDeficit = 0)
    (hOver : 0 < overDeficit)
    (hDeficitWeight : 0 < deficitWeight) :
    constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <
      expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight := by
  calc
    constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <
        constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight +
          deficitWeight := by exact Nat.lt_add_of_pos_right hDeficitWeight
    _ = expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight :=
      constrain_score_plus_weight_eq_expand hUnder hOver

theorem expand_beats_shed_below_redline
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty : Nat}
    (hUnder : 0 < underDeficit)
    (hOver : overDeficit = 0)
    (hBelow :
      controllerBurden sequentialCapacity recoveredOverlap buleyRise <
        repairRedline deficitWeight shedPenalty) :
    expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <
      shedScore underDeficit overDeficit deficitWeight shedPenalty := by
  rw [expandScore_under_form hUnder hOver, shedScore_under_form hUnder hOver]
  exact Nat.add_lt_add_left hBelow (deficitWeight * (underDeficit - 1))

theorem constrain_beats_shed_below_redline
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty : Nat}
    (hUnder : underDeficit = 0)
    (hOver : 0 < overDeficit)
    (hBelow :
      controllerBurden sequentialCapacity recoveredOverlap buleyRise <
        repairRedline deficitWeight shedPenalty) :
    constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <
      shedScore underDeficit overDeficit deficitWeight shedPenalty := by
  rw [constrainScore_over_form hUnder hOver, shedScore_over_form hUnder hOver]
  exact Nat.add_lt_add_left hBelow (deficitWeight * (overDeficit - 1))

theorem shed_beats_expand_when_under_above_redline
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty : Nat}
    (hUnder : 0 < underDeficit)
    (hOver : overDeficit = 0)
    (hAbove :
      repairRedline deficitWeight shedPenalty <
        controllerBurden sequentialCapacity recoveredOverlap buleyRise) :
    shedScore underDeficit overDeficit deficitWeight shedPenalty <
      expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight := by
  rw [shedScore_under_form hUnder hOver, expandScore_under_form hUnder hOver]
  exact Nat.add_lt_add_left hAbove (deficitWeight * (underDeficit - 1))

theorem shed_beats_constrain_when_over_above_redline
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty : Nat}
    (hUnder : underDeficit = 0)
    (hOver : 0 < overDeficit)
    (hAbove :
      repairRedline deficitWeight shedPenalty <
        controllerBurden sequentialCapacity recoveredOverlap buleyRise) :
    shedScore underDeficit overDeficit deficitWeight shedPenalty <
      constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight := by
  rw [shedScore_over_form hUnder hOver, constrainScore_over_form hUnder hOver]
  exact Nat.add_lt_add_left hAbove (deficitWeight * (overDeficit - 1))

theorem choose_expand_below_redline
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty : Nat}
    (hUnder : 0 < underDeficit)
    (hOver : overDeficit = 0)
    (hDeficitWeight : 0 < deficitWeight)
    (hBelow :
      controllerBurden sequentialCapacity recoveredOverlap buleyRise <
        repairRedline deficitWeight shedPenalty) :
    chooseWarmupAction
        sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty =
      .expand := by
  have hExpandLeConstrain :
      expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <=
        constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight :=
    Nat.le_of_lt (expand_lt_constrain_when_under hUnder hOver hDeficitWeight)
  have hExpandLeShed :
      expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <=
        shedScore underDeficit overDeficit deficitWeight shedPenalty :=
    Nat.le_of_lt (expand_beats_shed_below_redline hUnder hOver hBelow)
  simp [chooseWarmupAction, hExpandLeConstrain, hExpandLeShed]

theorem choose_constrain_below_redline
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty : Nat}
    (hUnder : underDeficit = 0)
    (hOver : 0 < overDeficit)
    (hDeficitWeight : 0 < deficitWeight)
    (hBelow :
      controllerBurden sequentialCapacity recoveredOverlap buleyRise <
        repairRedline deficitWeight shedPenalty) :
    chooseWarmupAction
        sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty =
      .constrain := by
  have hExpandNotLeConstrain :
      ¬ expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <=
        constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight :=
    Nat.not_le_of_gt (constrain_lt_expand_when_over hUnder hOver hDeficitWeight)
  have hConstrainLeShed :
      constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <=
        shedScore underDeficit overDeficit deficitWeight shedPenalty :=
    Nat.le_of_lt (constrain_beats_shed_below_redline hUnder hOver hBelow)
  simp [chooseWarmupAction, hExpandNotLeConstrain, hConstrainLeShed]

theorem choose_shed_load_when_under_above_redline
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty : Nat}
    (hUnder : 0 < underDeficit)
    (hOver : overDeficit = 0)
    (hDeficitWeight : 0 < deficitWeight)
    (hAbove :
      repairRedline deficitWeight shedPenalty <
        controllerBurden sequentialCapacity recoveredOverlap buleyRise) :
    chooseWarmupAction
        sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty =
      .shedLoad := by
  have hShedLtExpand :
      shedScore underDeficit overDeficit deficitWeight shedPenalty <
        expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight :=
    shed_beats_expand_when_under_above_redline hUnder hOver hAbove
  have hExpandLtConstrain :
      expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <
        constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight :=
    expand_lt_constrain_when_under hUnder hOver hDeficitWeight
  have hShedLtConstrain :
      shedScore underDeficit overDeficit deficitWeight shedPenalty <
        constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight :=
    Nat.lt_trans hShedLtExpand hExpandLtConstrain
  have hExpandNotLeShed :
      ¬ expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <=
        shedScore underDeficit overDeficit deficitWeight shedPenalty :=
    Nat.not_le_of_gt hShedLtExpand
  have hConstrainNotLeShed :
      ¬ constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <=
        shedScore underDeficit overDeficit deficitWeight shedPenalty :=
    Nat.not_le_of_gt hShedLtConstrain
  simp [chooseWarmupAction, hExpandNotLeShed, hConstrainNotLeShed]

theorem choose_shed_load_when_over_above_redline
    {sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty : Nat}
    (hUnder : underDeficit = 0)
    (hOver : 0 < overDeficit)
    (hDeficitWeight : 0 < deficitWeight)
    (hAbove :
      repairRedline deficitWeight shedPenalty <
        controllerBurden sequentialCapacity recoveredOverlap buleyRise) :
    chooseWarmupAction
        sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight shedPenalty =
      .shedLoad := by
  have hShedLtConstrain :
      shedScore underDeficit overDeficit deficitWeight shedPenalty <
        constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight :=
    shed_beats_constrain_when_over_above_redline hUnder hOver hAbove
  have hConstrainLtExpand :
      constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <
        expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight :=
    constrain_lt_expand_when_over hUnder hOver hDeficitWeight
  have hShedLtExpand :
      shedScore underDeficit overDeficit deficitWeight shedPenalty <
        expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight :=
    Nat.lt_trans hShedLtConstrain hConstrainLtExpand
  have hExpandNotLeConstrain :
      ¬ expandScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <=
        constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight :=
    Nat.not_le_of_gt hConstrainLtExpand
  have hConstrainNotLeShed :
      ¬ constrainScore sequentialCapacity recoveredOverlap buleyRise underDeficit overDeficit deficitWeight <=
        shedScore underDeficit overDeficit deficitWeight shedPenalty :=
    Nat.not_le_of_gt hShedLtConstrain
  simp [chooseWarmupAction, hExpandNotLeConstrain, hConstrainNotLeShed]

end ForkRaceFoldTheorems
