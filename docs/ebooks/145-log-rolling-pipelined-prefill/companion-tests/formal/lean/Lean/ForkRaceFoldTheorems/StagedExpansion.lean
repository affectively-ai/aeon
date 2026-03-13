import Mathlib
import ForkRaceFoldTheorems.Wallace

namespace ForkRaceFoldTheorems

def stagedExpansionFrontierArea (peak left right : Nat) : Nat :=
  frontierArea3 (1 + left) peak (1 + right)

def stagedExpansionEnvelope (peak left right : Nat) : Nat :=
  envelopeArea3 (1 + left) peak (1 + right)

def stagedExpansionWallaceNumerator (peak left right : Nat) : Nat :=
  wallaceNumerator3 (1 + left) peak (1 + right)

def stagedExpansionWallaceDenominator (peak left right : Nat) : Nat :=
  wallaceDenominator3 (1 + left) peak (1 + right)

def naiveWidenFrontierArea (peak budget : Nat) : Nat :=
  frontierArea3 1 (peak + budget) 1

def naiveWidenEnvelope (peak budget : Nat) : Nat :=
  envelopeArea3 1 (peak + budget) 1

def naiveWidenWallaceNumerator (peak budget : Nat) : Nat :=
  wallaceNumerator3 1 (peak + budget) 1

def naiveWidenWallaceDenominator (peak budget : Nat) : Nat :=
  wallaceDenominator3 1 (peak + budget) 1

theorem staged_frontier_area_matches_naive (peak left right : Nat) :
    stagedExpansionFrontierArea peak left right =
      naiveWidenFrontierArea peak (left + right) := by
  unfold stagedExpansionFrontierArea naiveWidenFrontierArea frontierArea3
  omega

theorem staged_peak_preserved {peak left right : Nat}
    (hPeak : 0 < peak)
    (hLeft : left <= peak - 1)
    (hRight : right <= peak - 1) :
    peakFrontier3 (1 + left) peak (1 + right) = peak := by
  have hLeftLe : 1 + left <= peak := by
    omega
  have hRightLe : 1 + right <= peak := by
    omega
  unfold peakFrontier3
  rw [Nat.max_eq_left hRightLe]
  exact Nat.max_eq_right hLeftLe

theorem staged_envelope_preserved {peak left right : Nat}
    (hPeak : 0 < peak)
    (hLeft : left <= peak - 1)
    (hRight : right <= peak - 1) :
    stagedExpansionEnvelope peak left right = 3 * peak := by
  unfold stagedExpansionEnvelope envelopeArea3
  rw [staged_peak_preserved hPeak hLeft hRight]

theorem naive_widen_envelope_closed_form {peak budget : Nat}
    (hPeak : 0 < peak) :
    naiveWidenEnvelope peak budget = 3 * (peak + budget) := by
  have hPeakBudgetGeOne : 1 <= peak + budget := by
    omega
  unfold naiveWidenEnvelope envelopeArea3 peakFrontier3
  rw [Nat.max_eq_left hPeakBudgetGeOne]
  rw [Nat.max_eq_right hPeakBudgetGeOne]

theorem staged_budget_supported_by_positive_deficit
    {left right deficit : Nat}
    (hBudgetPositive : 0 < left + right)
    (hBudgetFits : left + right <= deficit) :
    0 < deficit := by
  omega

theorem staged_budget_feasible {peak left right : Nat}
    (hLeft : left <= peak - 1)
    (hRight : right <= peak - 1) :
    left + right <= 2 * (peak - 1) := by
  omega

theorem staged_wallace_closed_form {peak left right : Nat}
    (hPeak : 0 < peak)
    (hLeft : left <= peak - 1)
    (hRight : right <= peak - 1) :
    stagedExpansionWallaceNumerator peak left right =
      2 * (peak - 1) - (left + right) /\
    stagedExpansionWallaceDenominator peak left right = 3 * peak := by
  constructor
  · unfold stagedExpansionWallaceNumerator wallaceNumerator3
    unfold frontierArea3
    have hEnvelope :
        envelopeArea3 (1 + left) peak (1 + right) = 3 * peak := by
      simpa [stagedExpansionEnvelope] using
        staged_envelope_preserved hPeak hLeft hRight
    rw [hEnvelope]
    omega
  · unfold stagedExpansionWallaceDenominator wallaceDenominator3
    simpa [stagedExpansionEnvelope] using
      staged_envelope_preserved hPeak hLeft hRight

theorem naive_widen_wallace_closed_form {peak budget : Nat}
    (hPeak : 0 < peak) :
    naiveWidenWallaceNumerator peak budget =
      2 * (peak + budget - 1) /\
    naiveWidenWallaceDenominator peak budget = 3 * (peak + budget) := by
  constructor
  · unfold naiveWidenWallaceNumerator wallaceNumerator3
    unfold frontierArea3
    have hEnvelope :
        envelopeArea3 1 (peak + budget) 1 = 3 * (peak + budget) := by
      simpa [naiveWidenEnvelope] using
        naive_widen_envelope_closed_form (peak := peak) (budget := budget) hPeak
    rw [hEnvelope]
    omega
  · unfold naiveWidenWallaceDenominator wallaceDenominator3
    simpa [naiveWidenEnvelope] using
      naive_widen_envelope_closed_form (peak := peak) (budget := budget) hPeak

theorem staged_frontier_area_positive {peak left right : Nat}
    (hPeak : 0 < peak) :
    0 < stagedExpansionFrontierArea peak left right := by
  unfold stagedExpansionFrontierArea frontierArea3
  omega

theorem staged_fill_dominates_naive
    {peak left right deficit : Nat}
    (hPeak : 0 < peak)
    (hLeft : left <= peak - 1)
    (hRight : right <= peak - 1)
    (hBudgetPositive : 0 < left + right)
    (hBudgetFits : left + right <= deficit) :
    stagedExpansionFrontierArea peak left right *
        naiveWidenEnvelope peak (left + right) >
      naiveWidenFrontierArea peak (left + right) *
        stagedExpansionEnvelope peak left right := by
  have _hDeficitPositive : 0 < deficit :=
    staged_budget_supported_by_positive_deficit hBudgetPositive hBudgetFits
  have hSameArea := staged_frontier_area_matches_naive peak left right
  have hDenStrict :
      stagedExpansionEnvelope peak left right <
        naiveWidenEnvelope peak (left + right) := by
    rw [staged_envelope_preserved hPeak hLeft hRight]
    rw [naive_widen_envelope_closed_form hPeak]
    omega
  have hAreaPos : 0 < stagedExpansionFrontierArea peak left right :=
    staged_frontier_area_positive hPeak
  have hNaiveAreaPos : 0 < naiveWidenFrontierArea peak (left + right) := by
    rw [← hSameArea]
    exact hAreaPos
  rw [hSameArea]
  have hScaled :
      naiveWidenFrontierArea peak (left + right) *
          stagedExpansionEnvelope peak left right <
        naiveWidenFrontierArea peak (left + right) *
          naiveWidenEnvelope peak (left + right) := by
    exact Nat.mul_lt_mul_of_pos_left hDenStrict hNaiveAreaPos
  simpa [gt_iff_lt, Nat.mul_comm] using hScaled

end ForkRaceFoldTheorems
