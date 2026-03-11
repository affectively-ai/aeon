namespace ForkRaceFoldTheorems

def worthingtonNum (shards : Nat) : Nat := shards - 1

def worthingtonDen (shards : Nat) : Nat := 2 * shards

theorem worthington_num_lt_den {shards : Nat} (hShards : 0 < shards) :
    worthingtonNum shards < worthingtonDen shards := by
  unfold worthingtonNum worthingtonDen
  omega

private theorem pow_strict_mono_succ {p q n : Nat} (h : p < q) :
    p ^ (n + 1) < q ^ (n + 1) := by
  induction n with
  | zero =>
      simpa using h
  | succ n ih =>
      have hPLeQ : p ≤ q := Nat.le_of_lt h
      have hQPos : 0 < q := by omega
      have hLeft : p ^ (n + 1) * p ≤ p ^ (n + 1) * q := by
        exact Nat.mul_le_mul_left (p ^ (n + 1)) hPLeQ
      have hRight : p ^ (n + 1) * q < q ^ (n + 1) * q := by
        exact Nat.mul_lt_mul_of_pos_right ih hQPos
      have hLt : p ^ (n + 1) * p < q ^ (n + 1) * q := Nat.lt_of_le_of_lt hLeft hRight
      simpa [Nat.pow_succ, Nat.mul_assoc] using hLt

theorem speculative_tree_numerator_positive {p q k : Nat}
    (hPQ : p < q)
    (hK : 0 < k) :
    0 < q ^ k - p ^ k := by
  cases k with
  | zero =>
      cases hK
  | succ n =>
      exact Nat.sub_pos_of_lt (pow_strict_mono_succ (p := p) (q := q) (n := n) hPQ)

theorem speculative_tree_denominator_positive {p q n : Nat}
    (hPQ : p < q) :
    0 < (q - p) * q ^ n := by
  have hGap : 0 < q - p := Nat.sub_pos_of_lt hPQ
  have hQPos : 0 < q := by omega
  have hPowPos : 0 < q ^ n := Nat.pow_pos hQPos
  exact Nat.mul_pos hGap hPowPos

def turbulentIdleNum (chunkCount : Nat) : Nat := chunkCount * (chunkCount - 1)

def turbulentIdleDen (stageCount chunkCount : Nat) : Nat :=
  chunkCount * (stageCount + chunkCount - 1)

theorem turbulent_idle_num_nonnegative (chunkCount : Nat) :
    0 <= turbulentIdleNum chunkCount := by
  unfold turbulentIdleNum
  omega

theorem turbulent_idle_bounds {stageCount chunkCount : Nat}
    (hStageCount : 0 < stageCount)
    (hChunkCount : 0 < chunkCount) :
    turbulentIdleNum chunkCount <= turbulentIdleDen stageCount chunkCount := by
  unfold turbulentIdleNum turbulentIdleDen
  have hInner : chunkCount - 1 <= stageCount + chunkCount - 1 := by
    omega
  exact Nat.mul_le_mul_left chunkCount hInner

theorem turbulent_idle_den_positive {stageCount chunkCount : Nat}
    (hStageCount : 0 < stageCount)
    (hChunkCount : 0 < chunkCount) :
    0 < turbulentIdleDen stageCount chunkCount := by
  unfold turbulentIdleDen
  have hInnerPos : 0 < stageCount + chunkCount - 1 := by
    omega
  exact Nat.mul_pos hChunkCount hInnerPos

def whipTotalTime (items stageCount correctionCost shardCount : Nat) : Nat :=
  ((items + shardCount - 1) / shardCount) + (stageCount - 1) + correctionCost * shardCount

theorem whip_ceiling_term_is_one {items shardCount : Nat}
    (hItems : 0 < items)
    (hShardCount : items <= shardCount) :
    (items + shardCount - 1) / shardCount = 1 := by
  have hShardPos : 0 < shardCount := by omega
  apply (Nat.div_eq_iff hShardPos).2
  constructor
  · omega
  · omega

theorem whip_total_time_after_full_sharding {items stageCount correctionCost shardCount : Nat}
    (hItems : 0 < items)
    (hStageCount : 0 < stageCount)
    (hShardCount : items <= shardCount) :
    whipTotalTime items stageCount correctionCost shardCount =
      stageCount + correctionCost * shardCount := by
  unfold whipTotalTime
  rw [whip_ceiling_term_is_one hItems hShardCount]
  omega

theorem whip_total_time_strictly_increases_after_full_sharding
    {items stageCount correctionCost shardCount : Nat}
    (hItems : 0 < items)
    (hStageCount : 0 < stageCount)
    (hCorrection : 0 < correctionCost)
    (hShardCount : items <= shardCount) :
    whipTotalTime items stageCount correctionCost (shardCount + 1) >
      whipTotalTime items stageCount correctionCost shardCount := by
  have hNext : items <= shardCount + 1 := by omega
  rw [whip_total_time_after_full_sharding hItems hStageCount hNext]
  rw [whip_total_time_after_full_sharding hItems hStageCount hShardCount]
  have hShardGrowth :
      correctionCost * shardCount < correctionCost * (shardCount + 1) := by
    exact Nat.mul_lt_mul_of_pos_left (Nat.lt_succ_self shardCount) hCorrection
  exact Nat.add_lt_add_left hShardGrowth stageCount

theorem whip_strict_crossover_exists {items stageCount correctionCost maxShards : Nat}
    (hItems : 0 < items)
    (hStageCount : 0 < stageCount)
    (hCorrection : 0 < correctionCost)
    (hWindow : items < maxShards) :
    ∃ k, k < maxShards /\
      whipTotalTime items stageCount correctionCost (k + 1) >
        whipTotalTime items stageCount correctionCost k := by
  refine ⟨items, hWindow, ?_⟩
  exact
    whip_total_time_strictly_increases_after_full_sharding
      (items := items)
      (stageCount := stageCount)
      (correctionCost := correctionCost)
      (shardCount := items)
      hItems
      hStageCount
      hCorrection
      (Nat.le_refl items)

def searchSize (sqrtN : Nat) : Nat := sqrtN * sqrtN

def intrinsicBeta1 (sqrtN : Nat) : Nat := sqrtN - 1

def classicalBeta1 : Nat := 0

def classicalDeficit (sqrtN : Nat) : Nat := intrinsicBeta1 sqrtN - classicalBeta1

def quantumBeta1 (sqrtN : Nat) : Nat := intrinsicBeta1 sqrtN

def quantumDeficit (sqrtN : Nat) : Nat := intrinsicBeta1 sqrtN - quantumBeta1 sqrtN

def classicalRounds (sqrtN : Nat) : Nat := searchSize sqrtN

def quantumRounds (sqrtN : Nat) : Nat := sqrtN

def quantumSpeedup (sqrtN : Nat) : Nat := classicalRounds sqrtN / quantumRounds sqrtN

theorem quantum_deficit_is_zero (sqrtN : Nat) : quantumDeficit sqrtN = 0 := by
  unfold quantumDeficit quantumBeta1
  exact Nat.sub_self (intrinsicBeta1 sqrtN)

theorem quantum_speedup_equals_classical_deficit_plus_one {sqrtN : Nat}
    (hSqrtN : 0 < sqrtN) :
    quantumSpeedup sqrtN = classicalDeficit sqrtN + 1 := by
  unfold quantumSpeedup classicalRounds quantumRounds searchSize
  unfold classicalDeficit intrinsicBeta1 classicalBeta1
  rw [Nat.mul_div_right sqrtN hSqrtN]
  omega

def protocolIntrinsicBeta1 (streamCount : Nat) : Nat := streamCount - 1

def tcpBeta1 : Nat := 0

def quicBeta1 (streamCount : Nat) : Nat := streamCount - 1

def flowBeta1 (streamCount : Nat) : Nat := streamCount - 1

def topologicalDeficit (intrinsic implementation : Nat) : Nat := intrinsic - implementation

theorem protocol_deficits {streamCount : Nat} (hStreams : 1 < streamCount) :
    topologicalDeficit (protocolIntrinsicBeta1 streamCount) tcpBeta1 = streamCount - 1 /\
    topologicalDeficit (protocolIntrinsicBeta1 streamCount) (quicBeta1 streamCount) = 0 /\
    topologicalDeficit (protocolIntrinsicBeta1 streamCount) (flowBeta1 streamCount) = 0 := by
  unfold topologicalDeficit protocolIntrinsicBeta1 tcpBeta1 quicBeta1 flowBeta1
  omega

inductive SettlementMode where
  | sequential
  | parallel

def settlementIntrinsicBeta1 : Nat := 2

def settlementImplementationBeta1 : SettlementMode -> Nat
  | .sequential => 0
  | .parallel => 2

def settlementDeficit (mode : SettlementMode) : Nat :=
  settlementIntrinsicBeta1 - settlementImplementationBeta1 mode

theorem settlement_deficit_values :
    settlementDeficit .sequential = 2 /\
    settlementDeficit .parallel = 0 := by
  unfold settlementDeficit settlementIntrinsicBeta1 settlementImplementationBeta1
  constructor <;> decide

def beta2FromBandGap (bandGapExists : Bool) : Nat :=
  if bandGapExists then 1 else 0

theorem band_gap_implies_beta2_positive {bandGapExists : Bool}
    (hGap : bandGapExists = true) :
    0 < beta2FromBandGap bandGapExists := by
  unfold beta2FromBandGap
  simp [hGap]

def ventEnergy (forkEnergy foldWork : Nat) : Nat := forkEnergy - foldWork

theorem first_law_conservation {forkEnergy foldWork : Nat}
    (hWorkBound : foldWork <= forkEnergy) :
    forkEnergy = foldWork + ventEnergy forkEnergy foldWork := by
  unfold ventEnergy
  exact (Nat.add_sub_of_le hWorkBound).symm

def isForkNode (_inDegree outDegree : Nat) : Prop := 1 < outDegree

def isJoinNode (inDegree _outDegree : Nat) : Prop := 1 < inDegree

def isChainNode (inDegree outDegree : Nat) : Prop := outDegree <= 1 /\ inDegree <= 1

theorem local_node_decomposition (inDegree outDegree : Nat) :
    isForkNode inDegree outDegree \/
    isJoinNode inDegree outDegree \/
    isChainNode inDegree outDegree := by
  unfold isForkNode isJoinNode isChainNode
  by_cases hFork : 1 < outDegree
  · exact Or.inl hFork
  · by_cases hJoin : 1 < inDegree
    · exact Or.inr (Or.inl hJoin)
    · exact Or.inr (Or.inr (by constructor <;> omega))

end ForkRaceFoldTheorems
