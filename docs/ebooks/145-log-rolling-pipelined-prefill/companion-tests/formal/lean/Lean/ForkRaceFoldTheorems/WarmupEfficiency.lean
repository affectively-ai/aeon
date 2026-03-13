import Mathlib
import ForkRaceFoldTheorems.Multiplexing

namespace ForkRaceFoldTheorems

def warmupWallaceDropCross
    (busyWork sequentialCapacity recoveredOverlap : Nat) : Nat :=
  sequentialWallaceNumerator busyWork sequentialCapacity *
      multiplexedCapacity sequentialCapacity recoveredOverlap -
    multiplexedWallaceNumerator busyWork sequentialCapacity recoveredOverlap *
      sequentialCapacity

def weightedWallaceBenefit
    (busyWork sequentialCapacity recoveredOverlap wallaceWeight : Nat) : Nat :=
  wallaceWeight * warmupWallaceDropCross busyWork sequentialCapacity recoveredOverlap

def burdenScalar
    (sequentialCapacity recoveredOverlap buleyRise : Nat) : Nat :=
  buleyRise * sequentialCapacity * multiplexedCapacity sequentialCapacity recoveredOverlap

def warmupWorth
    (busyWork sequentialCapacity recoveredOverlap buleyRise wallaceWeight : Nat) : Prop :=
  weightedWallaceBenefit busyWork sequentialCapacity recoveredOverlap wallaceWeight >
    burdenScalar sequentialCapacity recoveredOverlap buleyRise

theorem warmup_wallace_drop_cross_closed_form
    {busyWork sequentialCapacity recoveredOverlap : Nat}
    (hBusyFits : busyWork <= sequentialCapacity)
    (hRecoveredLegal : recoveredOverlap <= sequentialCapacity - busyWork) :
    warmupWallaceDropCross busyWork sequentialCapacity recoveredOverlap =
      busyWork * recoveredOverlap := by
  let muxCap := multiplexedCapacity sequentialCapacity recoveredOverlap
  let muxWall := multiplexedWallaceNumerator busyWork sequentialCapacity recoveredOverlap
  let seqWall := sequentialWallaceNumerator busyWork sequentialCapacity
  have hRecoveredFits : recoveredOverlap <= sequentialCapacity := by
    exact Nat.le_trans hRecoveredLegal (Nat.sub_le _ _)
  have hSeqCapSplit : sequentialCapacity = muxCap + recoveredOverlap := by
    unfold muxCap multiplexedCapacity
    simpa [Nat.add_comm] using (Nat.sub_add_cancel hRecoveredFits).symm
  have hSeqWallSplit : seqWall = muxWall + recoveredOverlap := by
    have hDrop : seqWall - muxWall = recoveredOverlap := by
      unfold seqWall muxWall
      exact multiplexing_wallace_numerator_drop_equals_overlap hBusyFits hRecoveredLegal
    have hMuxLeSeq : muxWall <= seqWall := by
      unfold muxWall seqWall
      exact multiplexing_wallace_numerator_monotone hBusyFits hRecoveredLegal
    have hEqAdd : seqWall = recoveredOverlap + muxWall :=
      (Nat.sub_eq_iff_eq_add hMuxLeSeq).1 hDrop
    simpa [Nat.add_comm] using hEqAdd
  have hMuxCapSplit : muxCap = muxWall + busyWork := by
    unfold muxCap muxWall multiplexedWallaceNumerator
    omega
  have hCrossEq :
      seqWall * muxCap = muxWall * sequentialCapacity + busyWork * recoveredOverlap := by
    calc
      seqWall * muxCap
        = (muxWall + recoveredOverlap) * muxCap := by rw [hSeqWallSplit]
      _ = muxWall * muxCap + recoveredOverlap * muxCap := by rw [Nat.add_mul]
      _ = muxWall * muxCap + recoveredOverlap * (muxWall + busyWork) := by
        rw [hMuxCapSplit]
      _ = muxWall * muxCap + (recoveredOverlap * muxWall + recoveredOverlap * busyWork) := by
        rw [Nat.mul_add]
      _ = (muxWall * muxCap + recoveredOverlap * muxWall) + recoveredOverlap * busyWork := by
        omega
      _ = (muxWall * muxCap + muxWall * recoveredOverlap) + recoveredOverlap * busyWork := by
        rw [Nat.mul_comm recoveredOverlap muxWall]
      _ = muxWall * (muxCap + recoveredOverlap) + recoveredOverlap * busyWork := by
        rw [← Nat.mul_add]
      _ = muxWall * sequentialCapacity + recoveredOverlap * busyWork := by
        rw [hSeqCapSplit]
      _ = muxWall * sequentialCapacity + busyWork * recoveredOverlap := by
        rw [Nat.mul_comm recoveredOverlap busyWork]
  have hCrossGe :
      muxWall * sequentialCapacity <= seqWall * muxCap := by
    unfold muxWall seqWall muxCap
    exact multiplexing_wallace_ratio_monotone hBusyFits hRecoveredLegal
  unfold warmupWallaceDropCross
  exact (Nat.sub_eq_iff_eq_add hCrossGe).2 (by
    simpa [Nat.add_comm] using hCrossEq)

theorem warmup_efficiency_iff
    {busyWork sequentialCapacity recoveredOverlap buleyRise wallaceWeight : Nat}
    (hBusyFits : busyWork <= sequentialCapacity)
    (hRecoveredLegal : recoveredOverlap <= sequentialCapacity - busyWork) :
    warmupWorth busyWork sequentialCapacity recoveredOverlap buleyRise wallaceWeight ↔
      wallaceWeight * busyWork * recoveredOverlap >
        burdenScalar sequentialCapacity recoveredOverlap buleyRise := by
  unfold warmupWorth
  unfold weightedWallaceBenefit burdenScalar
  rw [warmup_wallace_drop_cross_closed_form hBusyFits hRecoveredLegal]
  simp [Nat.mul_assoc]

theorem warmup_efficiency_iff_shifted_utility
    {busyWork sequentialCapacity recoveredOverlap buleyRise wallaceWeight : Nat}
    (hBusyFits : busyWork <= sequentialCapacity)
    (hRecoveredLegal : recoveredOverlap <= sequentialCapacity - busyWork) :
    warmupWorth busyWork sequentialCapacity recoveredOverlap buleyRise wallaceWeight ↔
      wallaceWeight * busyWork * sequentialCapacity >
        wallaceWeight * busyWork *
            multiplexedCapacity sequentialCapacity recoveredOverlap +
          burdenScalar sequentialCapacity recoveredOverlap buleyRise := by
  rw [warmup_efficiency_iff hBusyFits hRecoveredLegal]
  let muxCap := multiplexedCapacity sequentialCapacity recoveredOverlap
  have hRecoveredFits : recoveredOverlap <= sequentialCapacity := by
    exact Nat.le_trans hRecoveredLegal (Nat.sub_le _ _)
  have hSeqCapSplit :
      sequentialCapacity = muxCap + recoveredOverlap := by
    unfold muxCap multiplexedCapacity
    simpa [Nat.add_comm] using (Nat.sub_add_cancel hRecoveredFits).symm
  have hSeqExpand :
      wallaceWeight * busyWork * sequentialCapacity =
        wallaceWeight * busyWork * muxCap +
          wallaceWeight * busyWork * recoveredOverlap := by
    calc
      wallaceWeight * busyWork * sequentialCapacity
        = (wallaceWeight * busyWork) * sequentialCapacity := by ac_rfl
      _ = (wallaceWeight * busyWork) * (muxCap + recoveredOverlap) := by
            rw [hSeqCapSplit]
      _ = (wallaceWeight * busyWork) * muxCap +
          (wallaceWeight * busyWork) * recoveredOverlap := by
            rw [Nat.mul_add]
      _ = wallaceWeight * busyWork * muxCap +
          wallaceWeight * busyWork * recoveredOverlap := by
            ac_rfl
  constructor
  · intro h
    rw [hSeqExpand]
    exact Nat.add_lt_add_left h _
  · intro h
    rw [hSeqExpand] at h
    exact Nat.lt_of_add_lt_add_left h

theorem free_warmup_positive_overlap_is_worth
    {busyWork sequentialCapacity recoveredOverlap wallaceWeight : Nat}
    (hBusyPositive : 0 < busyWork)
    (hBusyFits : busyWork <= sequentialCapacity)
    (hRecoveredLegal : recoveredOverlap <= sequentialCapacity - busyWork)
    (hRecoveredPositive : 0 < recoveredOverlap)
    (hWallaceWeightPositive : 0 < wallaceWeight) :
    warmupWorth busyWork sequentialCapacity recoveredOverlap 0 wallaceWeight := by
  rw [warmup_efficiency_iff hBusyFits hRecoveredLegal]
  simp [burdenScalar, Nat.mul_assoc]
  have hBusyOverlapPos : 0 < busyWork * recoveredOverlap := by
    exact Nat.mul_pos hBusyPositive hRecoveredPositive
  have hBenefitPos : 0 < wallaceWeight * (busyWork * recoveredOverlap) := by
    exact Nat.mul_pos hWallaceWeightPositive hBusyOverlapPos
  simpa [Nat.mul_assoc] using hBenefitPos

theorem no_recovery_not_worth_when_buley_positive
    {busyWork sequentialCapacity buleyRise wallaceWeight : Nat}
    (_hBusyPositive : 0 < busyWork)
    (hBusyFits : busyWork <= sequentialCapacity)
    (_hBuleyRisePositive : 0 < buleyRise) :
    ¬ warmupWorth busyWork sequentialCapacity 0 buleyRise wallaceWeight := by
  have hRecoveredLegal : 0 <= sequentialCapacity - busyWork := by
    exact Nat.zero_le _
  rw [warmup_efficiency_iff hBusyFits hRecoveredLegal]
  simp [burdenScalar, multiplexedCapacity, Nat.mul_assoc]

end ForkRaceFoldTheorems
