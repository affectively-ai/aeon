namespace ForkRaceFoldTheorems

def structuredFrontier (frontier vented : Nat) : Nat := frontier - vented

def repairedFrontier (frontier vented repaired : Nat) : Nat :=
  structuredFrontier frontier vented + repaired

def frontierEntropyProxy (frontier : Nat) : Nat := frontier - 1

theorem structured_failure_conserves_frontier_mass {frontier vented : Nat}
    (hBound : vented <= frontier) :
    frontier = structuredFrontier frontier vented + vented := by
  unfold structuredFrontier
  omega

theorem structured_failure_reduces_frontier_width {frontier vented : Nat}
    (hVented : 0 < vented)
    (hBound : vented <= frontier) :
    structuredFrontier frontier vented < frontier := by
  unfold structuredFrontier
  omega

theorem structured_failure_reduces_entropy_proxy {frontier vented : Nat}
    (hVented : 0 < vented)
    (hSurvivor : vented < frontier) :
    frontierEntropyProxy (structuredFrontier frontier vented) <
      frontierEntropyProxy frontier := by
  unfold frontierEntropyProxy structuredFrontier
  omega

theorem forked_frontier_collapses_to_single_survivor {frontier : Nat}
    (hForked : 1 < frontier) :
    structuredFrontier frontier (frontier - 1) = 1 := by
  unfold structuredFrontier
  omega

theorem success_from_forked_frontier_requires_failure {frontier vented : Nat}
    (hForked : 1 < frontier)
    (hCollapse : structuredFrontier frontier vented = 1) :
    0 < vented := by
  unfold structuredFrontier at hCollapse
  omega

theorem single_survivor_has_zero_entropy_proxy {frontier : Nat}
    (hForked : 1 < frontier) :
    frontierEntropyProxy (structuredFrontier frontier (frontier - 1)) = 0 := by
  rw [forked_frontier_collapses_to_single_survivor hForked]
  unfold frontierEntropyProxy
  decide

theorem coupled_failure_preserves_or_increases_frontier_width
    {frontier vented repaired : Nat}
    (hBound : vented <= frontier)
    (hDebt : vented <= repaired) :
    frontier <= repairedFrontier frontier vented repaired := by
  unfold repairedFrontier structuredFrontier
  omega

theorem coupled_failure_preserves_or_increases_entropy_proxy
    {frontier vented repaired : Nat}
    (hFrontier : 0 < frontier)
    (hBound : vented <= frontier)
    (hDebt : vented <= repaired) :
    frontierEntropyProxy frontier <=
      frontierEntropyProxy (repairedFrontier frontier vented repaired) := by
  unfold frontierEntropyProxy repairedFrontier structuredFrontier
  omega

theorem coupled_failure_strictly_increases_entropy_proxy
    {frontier vented repaired : Nat}
    (hFrontier : 0 < frontier)
    (hBound : vented <= frontier)
    (hDebt : vented < repaired) :
    frontierEntropyProxy frontier <
      frontierEntropyProxy (repairedFrontier frontier vented repaired) := by
  unfold frontierEntropyProxy repairedFrontier structuredFrontier
  omega

end ForkRaceFoldTheorems
