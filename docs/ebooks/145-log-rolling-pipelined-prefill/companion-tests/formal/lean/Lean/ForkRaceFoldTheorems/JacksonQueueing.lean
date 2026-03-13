import Mathlib
import ForkRaceFoldTheorems.QueueStability

open Filter MeasureTheory ProbabilityTheory
open scoped BigOperators ENNReal Topology

namespace ForkRaceFoldTheorems

theorem mm1_stationary_lintegral_queue_length
    {ρ : ℝ}
    (hρ_nonneg : 0 ≤ ρ)
    (hρ_lt_one : ρ < 1) :
    ∫⁻ n : ℕ, (n : ℝ≥0∞) ∂ (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure =
      ENNReal.ofReal (ρ / (1 - ρ)) := by
  have hNorm : ‖ρ‖ < 1 := by
    rwa [Real.norm_of_nonneg hρ_nonneg]
  have hSummable : Summable (fun n : ℕ => (n : ℝ) * ρ ^ n) := by
    simpa [pow_one] using
      (summable_pow_mul_geometric_of_norm_lt_one 1 hNorm : Summable (fun n : ℕ => (n : ℝ) ^ 1 * ρ ^ n))
  have hWeightedSummable :
      Summable (fun n : ℕ => (n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal) := by
    simpa [mm1StationaryPMF_toReal hρ_nonneg hρ_lt_one, mul_assoc] using
      hSummable.mul_right (1 - ρ)
  have hWeightedNonneg :
      ∀ n : ℕ, 0 ≤ (n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal := by
    intro n
    rw [mm1StationaryPMF_toReal hρ_nonneg hρ_lt_one n]
    have hOneMinusRhoNonneg : 0 ≤ 1 - ρ := by
      linarith
    exact mul_nonneg (Nat.cast_nonneg n) (mul_nonneg (pow_nonneg hρ_nonneg _) hOneMinusRhoNonneg)
  rw [MeasureTheory.lintegral_countable']
  calc
    (∑' n : ℕ, (n : ℝ≥0∞) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure {n})
      = ∑' n : ℕ, ENNReal.ofReal ((n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal) := by
          apply tsum_congr
          intro n
          calc
            (n : ℝ≥0∞) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure {n}
              = ENNReal.ofReal (n : ℝ) *
                  ENNReal.ofReal ((mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal) := by
                    simp [PMF.toMeasure_apply_singleton, ENNReal.ofReal_natCast,
                      ENNReal.ofReal_toReal ((mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).apply_ne_top n)]
            _ = ENNReal.ofReal ((n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal) := by
                    rw [ENNReal.ofReal_mul (show 0 ≤ (n : ℝ) by positivity)]
    _ = ENNReal.ofReal (∑' n : ℕ, (n : ℝ) * (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one n).toReal) := by
          symm
          exact ENNReal.ofReal_tsum_of_nonneg hWeightedNonneg hWeightedSummable
    _ = ENNReal.ofReal (ρ / (1 - ρ)) := by
          rw [mm1_stationary_mean_queue_length hρ_nonneg hρ_lt_one]

theorem mm1_stationary_integrable_queue_length
    {ρ : ℝ}
    (hρ_nonneg : 0 ≤ ρ)
    (hρ_lt_one : ρ < 1) :
    Integrable (fun n : ℕ => (n : ℝ)) (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure := by
  simpa using
    (integrable_toReal_of_lintegral_ne_top
      (measurable_of_countable (fun n : ℕ => (n : ℝ≥0∞))).aemeasurable
      (by
        rw [mm1_stationary_lintegral_queue_length hρ_nonneg hρ_lt_one]
        exact ENNReal.ofReal_ne_top))

theorem mm1_stationary_integral_queue_length
    {ρ : ℝ}
    (hρ_nonneg : 0 ≤ ρ)
    (hρ_lt_one : ρ < 1) :
    ∫ n : ℕ, (n : ℝ) ∂ (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure = ρ / (1 - ρ) := by
  have hIntegrable :
      Integrable (fun n : ℕ => (n : ℝ)) (mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure :=
    mm1_stationary_integrable_queue_length hρ_nonneg hρ_lt_one
  have hNonneg :
      0 ≤ᵐ[(mm1StationaryPMF ρ hρ_nonneg hρ_lt_one).toMeasure] fun n : ℕ => (n : ℝ) :=
    Filter.Eventually.of_forall fun n => Nat.cast_nonneg n
  have hRatioNonneg : 0 ≤ ρ / (1 - ρ) := by
    have hOneMinusPos : 0 < 1 - ρ := by
      linarith
    positivity
  rw [← ENNReal.ofReal_eq_ofReal_iff (integral_nonneg fun n : ℕ => Nat.cast_nonneg n) hRatioNonneg]
  rw [MeasureTheory.ofReal_integral_eq_lintegral_ofReal hIntegrable hNonneg]
  simpa using mm1_stationary_lintegral_queue_length hρ_nonneg hρ_lt_one

section JacksonProduct

variable {ι : Type*} [Fintype ι]

structure JacksonTrafficData where
  externalArrival : ι → ℝ
  routing : ι → ι → ℝ
  serviceRate : ι → ℝ
  arrivalNonneg : ∀ i, 0 ≤ externalArrival i
  routingNonneg : ∀ i j, 0 ≤ routing i j
  routingSubstochastic : ∀ i, ∑ j, routing i j ≤ 1
  servicePositive : ∀ i, 0 < serviceRate i

structure JacksonNetworkData where
  externalArrival : ι → ℝ
  routing : ι → ι → ℝ
  serviceRate : ι → ℝ
  throughput : ι → ℝ
  arrivalNonneg : ∀ i, 0 ≤ externalArrival i
  routingNonneg : ∀ i j, 0 ≤ routing i j
  routingSubstochastic : ∀ i, ∑ j, routing i j ≤ 1
  servicePositive : ∀ i, 0 < serviceRate i
  throughputNonneg : ∀ i, 0 ≤ throughput i
  trafficEquation : ∀ i, throughput i = externalArrival i + ∑ j, throughput j * routing j i
  stable : ∀ i, throughput i < serviceRate i

namespace JacksonTrafficData

section SpectralRadius

variable [DecidableEq ι]

noncomputable def routingMatrix (data : JacksonTrafficData (ι := ι)) : Matrix ι ι ℝ :=
  Matrix.of data.routing

omit [DecidableEq ι] in
@[simp]
theorem routingMatrix_apply (data : JacksonTrafficData (ι := ι)) (i j : ι) :
    data.routingMatrix i j = data.routing i j :=
  rfl

theorem routingMatrix_isUnit_of_spectralRadius_lt_one
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1) :
    IsUnit (1 - data.routingMatrix) := by
  have hMem : (1 : ℝ) ∈ resolventSet ℝ data.routingMatrix :=
    spectrum.mem_resolventSet_of_spectralRadius_lt (by simpa using hρ)
  have hUnit :
      IsUnit ((algebraMap ℝ (Matrix ι ι ℝ)) 1 - data.routingMatrix) :=
    (spectrum.mem_resolventSet_iff.mp hMem)
  simpa using hUnit

noncomputable def spectralThroughput
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1) : ι → ℝ :=
  Matrix.vecMul data.externalArrival
    (↑((data.routingMatrix_isUnit_of_spectralRadius_lt_one hρ).unit⁻¹) : Matrix ι ι ℝ)

theorem spectralThroughput_resolvent
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1) :
    Matrix.vecMul (data.spectralThroughput hρ) (1 - data.routingMatrix) = data.externalArrival := by
  let hUnit := data.routingMatrix_isUnit_of_spectralRadius_lt_one hρ
  let u : Units (Matrix ι ι ℝ) := hUnit.unit
  have hu : (↑u : Matrix ι ι ℝ) = 1 - data.routingMatrix := hUnit.unit_spec
  unfold spectralThroughput
  calc
    Matrix.vecMul (Matrix.vecMul data.externalArrival (↑(u⁻¹) : Matrix ι ι ℝ)) (1 - data.routingMatrix)
      = Matrix.vecMul data.externalArrival ((↑(u⁻¹) : Matrix ι ι ℝ) * (1 - data.routingMatrix)) := by
          rw [Matrix.vecMul_vecMul]
    _ = Matrix.vecMul data.externalArrival 1 := by
          congr 1
          calc
            (↑(u⁻¹) : Matrix ι ι ℝ) * (1 - data.routingMatrix)
              = (↑(u⁻¹) : Matrix ι ι ℝ) * ↑u := by rw [hu]
            _ = 1 := by simp
    _ = data.externalArrival := by
          simp

theorem spectralThroughput_matrix_fixed_point
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1) :
    data.spectralThroughput hρ =
      data.externalArrival + (Matrix.vecMul (data.spectralThroughput hρ) data.routingMatrix) := by
  have hResolvent : Matrix.vecMul (data.spectralThroughput hρ) (1 - data.routingMatrix) =
      data.externalArrival := data.spectralThroughput_resolvent hρ
  rw [Matrix.vecMul_sub, Matrix.vecMul_one] at hResolvent
  exact (sub_eq_iff_eq_add.mp hResolvent)

theorem spectralThroughput_fixed_point
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (i : ι) :
    data.spectralThroughput hρ i =
      data.externalArrival i + (∑ j, data.spectralThroughput hρ j * data.routing j i) := by
  have hMatrix := congrFun (data.spectralThroughput_matrix_fixed_point hρ) i
  simpa [Matrix.vecMul, dotProduct, routingMatrix_apply] using hMatrix

end SpectralRadius

noncomputable def trafficStep (data : JacksonTrafficData (ι := ι)) (throughput : ι → ℝ≥0∞) (i : ι) : ℝ≥0∞ :=
  ENNReal.ofReal (data.externalArrival i) +
    ∑ j, throughput j * ENNReal.ofReal (data.routing j i)

theorem trafficStep_monotone (data : JacksonTrafficData (ι := ι)) :
    Monotone data.trafficStep := by
  intro throughput₁ throughput₂ hle i
  rw [trafficStep, trafficStep]
  refine add_le_add le_rfl ?_
  refine Finset.sum_le_sum ?_
  intro j hj
  exact mul_le_mul' (hle j) le_rfl

noncomputable def trafficApprox (data : JacksonTrafficData (ι := ι)) : ℕ → ι → ℝ≥0∞
  | 0 => fun i => ENNReal.ofReal (data.externalArrival i)
  | n + 1 => data.trafficStep (data.trafficApprox n)

theorem trafficApprox_le_succ (data : JacksonTrafficData (ι := ι)) :
    ∀ n i, data.trafficApprox n i ≤ data.trafficApprox (n + 1) i
  | 0, i => by
      simp [trafficApprox, trafficStep]
  | n + 1, i => by
      rw [trafficApprox, trafficApprox, trafficStep, trafficStep]
      refine add_le_add le_rfl ?_
      refine Finset.sum_le_sum ?_
      intro j hj
      exact mul_le_mul' (trafficApprox_le_succ data n j) le_rfl

theorem trafficApprox_monotone (data : JacksonTrafficData (ι := ι)) (i : ι) :
    Monotone fun n => data.trafficApprox n i :=
  monotone_nat_of_le_succ fun n => data.trafficApprox_le_succ n i

theorem trafficApprox_monotone_mul_routing
    (data : JacksonTrafficData (ι := ι))
    (i j : ι) :
    Monotone fun n => data.trafficApprox n j * ENNReal.ofReal (data.routing j i) := by
  intro m n hmn
  exact mul_le_mul' (data.trafficApprox_monotone j hmn) le_rfl

noncomputable def constructiveThroughput (data : JacksonTrafficData (ι := ι)) (i : ι) : ℝ≥0∞ :=
  ⨆ n, data.trafficApprox n i

theorem constructiveThroughput_fixed_point
    (data : JacksonTrafficData (ι := ι))
    (i : ι) :
    data.constructiveThroughput i =
      ENNReal.ofReal (data.externalArrival i) +
        ∑ j, data.constructiveThroughput j * ENNReal.ofReal (data.routing j i) := by
  have hShift :
      data.constructiveThroughput i = ⨆ n, data.trafficApprox (n + 1) i := by
    rw [constructiveThroughput, ← sup_iSup_nat_succ (u := fun n => data.trafficApprox n i)]
    have hBaseLe : data.trafficApprox 0 i ≤ ⨆ n, data.trafficApprox (n + 1) i := by
      exact le_iSup_of_le 0 (data.trafficApprox_le_succ 0 i)
    exact sup_eq_right.mpr hBaseLe
  calc
    data.constructiveThroughput i
      = ⨆ n, (ENNReal.ofReal (data.externalArrival i) +
          ∑ j, data.trafficApprox n j * ENNReal.ofReal (data.routing j i)) := by
          rw [hShift]
          apply iSup_congr
          intro n
          simp [trafficApprox, trafficStep]
    _ = ENNReal.ofReal (data.externalArrival i) +
          ⨆ n, ∑ j, data.trafficApprox n j * ENNReal.ofReal (data.routing j i) := by
          rw [ENNReal.add_iSup]
    _ = ENNReal.ofReal (data.externalArrival i) +
          ∑ j, ⨆ n, data.trafficApprox n j * ENNReal.ofReal (data.routing j i) := by
          congr 1
          symm
          exact ENNReal.finsetSum_iSup_of_monotone fun j =>
            data.trafficApprox_monotone_mul_routing i j
    _ = ENNReal.ofReal (data.externalArrival i) +
          ∑ j, data.constructiveThroughput j * ENNReal.ofReal (data.routing j i) := by
          congr 1
          apply Finset.sum_congr rfl
          intro j hj
          rw [constructiveThroughput, ENNReal.iSup_mul]

theorem trafficApprox_le_of_postfixed
    (data : JacksonTrafficData (ι := ι))
    (candidate : ι → ℝ≥0∞)
    (hPostfixed : ∀ i, data.trafficStep candidate i ≤ candidate i) :
    ∀ n i, data.trafficApprox n i ≤ candidate i
  | 0, i => by
      exact le_trans (by simp [trafficApprox, trafficStep]) (hPostfixed i)
  | n + 1, i => by
      exact le_trans
        ((data.trafficStep_monotone fun j => trafficApprox_le_of_postfixed data candidate hPostfixed n j) i)
        (hPostfixed i)

theorem constructiveThroughput_le_of_postfixed
    (data : JacksonTrafficData (ι := ι))
    (candidate : ι → ℝ≥0∞)
    (hPostfixed : ∀ i, data.trafficStep candidate i ≤ candidate i)
    (i : ι) :
    data.constructiveThroughput i ≤ candidate i := by
  rw [constructiveThroughput]
  exact iSup_le fun n => data.trafficApprox_le_of_postfixed candidate hPostfixed n i

theorem constructiveThroughput_le_of_fixed_point
    (data : JacksonTrafficData (ι := ι))
    (candidate : ι → ℝ≥0∞)
    (hFixed : ∀ i, candidate i = data.trafficStep candidate i)
    (i : ι) :
    data.constructiveThroughput i ≤ candidate i := by
  exact data.constructiveThroughput_le_of_postfixed candidate
    (fun j => by rw [← hFixed j])
    i

/--
Knaster-Tarski-style dominance bridge: any nonnegative real-valued solution of the
Jackson traffic equations bounds the monotone constructive witness from above after
embedding into `ℝ≥0∞`.
-/
theorem constructiveThroughput_le_of_real_fixed_point
    (data : JacksonTrafficData (ι := ι))
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hFixed : ∀ i, candidate i = data.externalArrival i + ∑ j, candidate j * data.routing j i)
    (i : ι) :
    data.constructiveThroughput i ≤ ENNReal.ofReal (candidate i) := by
  exact data.constructiveThroughput_le_of_fixed_point
    (candidate := fun j => ENNReal.ofReal (candidate j))
    (hFixed := by
      intro k
      have hSumNonneg : 0 ≤ ∑ j, candidate j * data.routing j k := by
        refine Finset.sum_nonneg ?_
        intro j hj
        exact mul_nonneg (hNonneg j) (data.routingNonneg j k)
      calc
        ENNReal.ofReal (candidate k)
          = ENNReal.ofReal (data.externalArrival k + ∑ j, candidate j * data.routing j k) := by
              rw [hFixed k]
        _ = ENNReal.ofReal (data.externalArrival k) +
              ENNReal.ofReal (∑ j, candidate j * data.routing j k) := by
              rw [ENNReal.ofReal_add (data.arrivalNonneg k) hSumNonneg]
        _ = ENNReal.ofReal (data.externalArrival k) +
              ∑ j, ENNReal.ofReal (candidate j * data.routing j k) := by
              rw [ENNReal.ofReal_sum_of_nonneg fun j _ => mul_nonneg (hNonneg j) (data.routingNonneg j k)]
        _ = ENNReal.ofReal (data.externalArrival k) +
              ∑ j, ENNReal.ofReal (candidate j) * ENNReal.ofReal (data.routing j k) := by
              congr 1
              apply Finset.sum_congr rfl
              intro j hj
              rw [ENNReal.ofReal_mul (hNonneg j)]
        _ = data.trafficStep (fun j => ENNReal.ofReal (candidate j)) k := by
              simp [trafficStep])
    i

theorem constructiveThroughput_le_spectralThroughput
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (i : ι) :
    data.constructiveThroughput i ≤ ENNReal.ofReal (data.spectralThroughput hρ i) := by
  exact data.constructiveThroughput_le_of_real_fixed_point
    (candidate := data.spectralThroughput hρ)
    hNonneg
    (data.spectralThroughput_fixed_point hρ)
    i

theorem constructiveThroughput_finite_of_spectral
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (i : ι) :
    data.constructiveThroughput i < ∞ := by
  exact lt_of_le_of_lt (data.constructiveThroughput_le_spectralThroughput hρ hNonneg i)
    ENNReal.ofReal_lt_top

theorem constructiveThroughput_stable_of_spectral
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (hStable : ∀ i, data.spectralThroughput hρ i < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput i).toReal < data.serviceRate i := by
  have hLe :
      data.constructiveThroughput i ≤ ENNReal.ofReal (data.spectralThroughput hρ i) :=
    data.constructiveThroughput_le_spectralThroughput hρ hNonneg i
  have hToRealLe :
      (data.constructiveThroughput i).toReal ≤ data.spectralThroughput hρ i :=
    ENNReal.toReal_le_of_le_ofReal (hNonneg i) hLe
  exact lt_of_le_of_lt hToRealLe (hStable i)

noncomputable def constructiveNetworkData
    (data : JacksonTrafficData (ι := ι))
    (hFinite : ∀ i, data.constructiveThroughput i < ∞)
    (hStable : ∀ i, (data.constructiveThroughput i).toReal < data.serviceRate i) :
    JacksonNetworkData (ι := ι) where
  externalArrival := data.externalArrival
  routing := data.routing
  serviceRate := data.serviceRate
  throughput := fun i => (data.constructiveThroughput i).toReal
  arrivalNonneg := data.arrivalNonneg
  routingNonneg := data.routingNonneg
  routingSubstochastic := data.routingSubstochastic
  servicePositive := data.servicePositive
  throughputNonneg := fun _ => ENNReal.toReal_nonneg
  trafficEquation := by
    intro i
    have hFixed := data.constructiveThroughput_fixed_point i
    have hSumFinite :
        (∑ j, data.constructiveThroughput j * ENNReal.ofReal (data.routing j i)) < ∞ := by
      exact ENNReal.sum_lt_top.2 fun j _ =>
        ENNReal.mul_lt_top (hFinite j) ENNReal.ofReal_lt_top
    have hFixedReal := congrArg ENNReal.toReal hFixed
    rw [ENNReal.toReal_add ENNReal.ofReal_ne_top hSumFinite.ne,
      ENNReal.toReal_ofReal (data.arrivalNonneg i),
      ENNReal.toReal_sum (fun j _ =>
        (ENNReal.mul_lt_top (hFinite j) (by
          exact ENNReal.ofReal_lt_top)).ne)] at hFixedReal
    simp_rw [ENNReal.toReal_mul, ENNReal.toReal_ofReal (data.routingNonneg _ _)] at hFixedReal
    exact hFixedReal
  stable := hStable

noncomputable def spectralNetworkData
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (hStable : ∀ i, data.spectralThroughput hρ i < data.serviceRate i) :
    JacksonNetworkData (ι := ι) where
  externalArrival := data.externalArrival
  routing := data.routing
  serviceRate := data.serviceRate
  throughput := data.spectralThroughput hρ
  arrivalNonneg := data.arrivalNonneg
  routingNonneg := data.routingNonneg
  routingSubstochastic := data.routingSubstochastic
  servicePositive := data.servicePositive
  throughputNonneg := hNonneg
  trafficEquation := by
    intro i
    exact data.spectralThroughput_fixed_point hρ i
  stable := hStable

noncomputable def constructiveNetworkDataOfSpectral
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (hStable : ∀ i, data.spectralThroughput hρ i < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.constructiveNetworkData
    (data.constructiveThroughput_finite_of_spectral hρ hNonneg)
    (data.constructiveThroughput_stable_of_spectral hρ hNonneg hStable)

end JacksonTrafficData

section AdaptiveComparison

variable {σ : Type*} [Fintype σ] [Nonempty σ]

structure AdaptiveJacksonTrafficData where
  externalArrival : ι → ℝ
  routing : σ → ι → ι → ℝ
  serviceRate : ι → ℝ
  arrivalNonneg : ∀ i, 0 ≤ externalArrival i
  routingNonneg : ∀ s i j, 0 ≤ routing s i j
  routingSubstochastic : ∀ s i, ∑ j, routing s i j ≤ 1
  servicePositive : ∀ i, 0 < serviceRate i

namespace AdaptiveJacksonTrafficData

noncomputable def trafficStep
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (state : σ)
    (throughput : ι → ℝ≥0∞)
    (i : ι) : ℝ≥0∞ :=
  ENNReal.ofReal (data.externalArrival i) +
    ∑ j, throughput j * ENNReal.ofReal (data.routing state j i)

omit [Fintype σ] [Nonempty σ] in
theorem trafficStep_monotone
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (state : σ) :
    Monotone (data.trafficStep state) := by
  intro throughput₁ throughput₂ hle i
  rw [trafficStep, trafficStep]
  refine add_le_add le_rfl ?_
  refine Finset.sum_le_sum ?_
  intro j hj
  exact mul_le_mul' (hle j) le_rfl

noncomputable def trafficApprox
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ) : ℕ → ι → ℝ≥0∞
  | 0 => fun i => ENNReal.ofReal (data.externalArrival i)
  | n + 1 => data.trafficStep (schedule n) (data.trafficApprox schedule n)

noncomputable def constructiveThroughput
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (i : ι) : ℝ≥0∞ :=
  ⨆ n, data.trafficApprox schedule n i

omit [Fintype σ] [Nonempty σ] in
theorem trafficStep_le_of_dominated
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (state : σ)
    (throughput : ι → ℝ≥0∞)
    (i : ι) :
    data.trafficStep state throughput i ≤ dominant.trafficStep throughput i := by
  rw [trafficStep, JacksonTrafficData.trafficStep]
  refine add_le_add ?_ ?_
  · exact ENNReal.ofReal_le_ofReal (hArrivalLe i)
  · refine Finset.sum_le_sum ?_
    intro j hj
    exact mul_le_mul' le_rfl (ENNReal.ofReal_le_ofReal (hRoutingLe state j i))

omit [Fintype σ] [Nonempty σ] in
theorem trafficApprox_le_of_dominated
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j) :
    ∀ n i, data.trafficApprox schedule n i ≤ dominant.trafficApprox n i
  | 0, i => by
      simp [trafficApprox, JacksonTrafficData.trafficApprox]
      exact ENNReal.ofReal_le_ofReal (hArrivalLe i)
  | n + 1, i => by
      calc
        data.trafficApprox schedule (n + 1) i
          = data.trafficStep (schedule n) (data.trafficApprox schedule n) i := by
              simp [trafficApprox]
        _ ≤ data.trafficStep (schedule n) (dominant.trafficApprox n) i := by
              exact (data.trafficStep_monotone (schedule n)
                (fun j => data.trafficApprox_le_of_dominated schedule dominant hArrivalLe hRoutingLe n j)) i
        _ ≤ dominant.trafficStep (dominant.trafficApprox n) i := by
              exact data.trafficStep_le_of_dominated dominant hArrivalLe hRoutingLe
                (schedule n) (dominant.trafficApprox n) i
        _ = dominant.trafficApprox (n + 1) i := by
              simp [JacksonTrafficData.trafficApprox]

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_le_of_dominated
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (i : ι) :
    data.constructiveThroughput schedule i ≤ dominant.constructiveThroughput i := by
  rw [constructiveThroughput, JacksonTrafficData.constructiveThroughput]
  exact iSup_le fun n =>
    le_iSup_of_le n (data.trafficApprox_le_of_dominated schedule dominant hArrivalLe hRoutingLe n i)

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_le_of_dominating_spectral
    [DecidableEq ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (hρ : spectralRadius ℝ dominant.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ dominant.spectralThroughput hρ i)
    (i : ι) :
    data.constructiveThroughput schedule i ≤ ENNReal.ofReal (dominant.spectralThroughput hρ i) := by
  exact le_trans
    (data.constructiveThroughput_le_of_dominated schedule dominant hArrivalLe hRoutingLe i)
    (dominant.constructiveThroughput_le_spectralThroughput hρ hNonneg i)

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_finite_of_dominating_spectral
    [DecidableEq ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (hρ : spectralRadius ℝ dominant.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ dominant.spectralThroughput hρ i)
    (i : ι) :
    data.constructiveThroughput schedule i < ∞ := by
  exact lt_of_le_of_lt
    (data.constructiveThroughput_le_of_dominating_spectral schedule dominant
      hArrivalLe hRoutingLe hρ hNonneg i)
    ENNReal.ofReal_lt_top

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_stable_of_dominating_spectral
    [DecidableEq ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (hρ : spectralRadius ℝ dominant.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ dominant.spectralThroughput hρ i)
    (hStable : ∀ i, dominant.spectralThroughput hρ i < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput schedule i).toReal < data.serviceRate i := by
  have hLe :
      data.constructiveThroughput schedule i ≤ ENNReal.ofReal (dominant.spectralThroughput hρ i) :=
    data.constructiveThroughput_le_of_dominating_spectral schedule dominant
      hArrivalLe hRoutingLe hρ hNonneg i
  have hToRealLe :
      (data.constructiveThroughput schedule i).toReal ≤ dominant.spectralThroughput hρ i :=
    ENNReal.toReal_le_of_le_ofReal (hNonneg i) hLe
  exact lt_of_le_of_lt hToRealLe (hStable i)

noncomputable def supremumKernel
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (i j : ι) : ℝ :=
  Finset.univ.sup' Finset.univ_nonempty (fun s => data.routing s i j)

theorem routing_le_supremumKernel
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (state : σ)
    (i j : ι) :
    data.routing state i j ≤ data.supremumKernel i j := by
  exact Finset.le_sup' (s := Finset.univ) (f := fun s => data.routing s i j) (Finset.mem_univ state)

theorem supremumKernel_nonneg
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (i j : ι) :
    0 ≤ data.supremumKernel i j := by
  let state : σ := Classical.choice inferInstance
  exact le_trans (data.routingNonneg state i j) (data.routing_le_supremumKernel state i j)

noncomputable def supremumTrafficData
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1) :
    JacksonTrafficData (ι := ι) where
  externalArrival := data.externalArrival
  routing := data.supremumKernel
  serviceRate := data.serviceRate
  arrivalNonneg := data.arrivalNonneg
  routingNonneg := data.supremumKernel_nonneg
  routingSubstochastic := hSupSubstochastic
  servicePositive := data.servicePositive

theorem constructiveThroughput_le_supremumConstructiveThroughput
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (i : ι) :
    data.constructiveThroughput schedule i ≤
      (data.supremumTrafficData hSupSubstochastic).constructiveThroughput i := by
  exact data.constructiveThroughput_le_of_dominated schedule
    (data.supremumTrafficData hSupSubstochastic)
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    i

theorem constructiveThroughput_le_supremumSpectralThroughput
    [DecidableEq ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (hρ : spectralRadius ℝ (data.supremumTrafficData hSupSubstochastic).routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ (data.supremumTrafficData hSupSubstochastic).spectralThroughput hρ i)
    (i : ι) :
    data.constructiveThroughput schedule i ≤
      ENNReal.ofReal ((data.supremumTrafficData hSupSubstochastic).spectralThroughput hρ i) := by
  exact data.constructiveThroughput_le_of_dominating_spectral schedule
    (data.supremumTrafficData hSupSubstochastic)
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    hρ
    hNonneg
    i

theorem constructiveThroughput_finite_of_supremumSpectral
    [DecidableEq ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (hρ : spectralRadius ℝ (data.supremumTrafficData hSupSubstochastic).routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ (data.supremumTrafficData hSupSubstochastic).spectralThroughput hρ i)
    (i : ι) :
    data.constructiveThroughput schedule i < ∞ := by
  exact data.constructiveThroughput_finite_of_dominating_spectral schedule
    (data.supremumTrafficData hSupSubstochastic)
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    hρ
    hNonneg
    i

theorem constructiveThroughput_stable_of_supremumSpectral
    [DecidableEq ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (hρ : spectralRadius ℝ (data.supremumTrafficData hSupSubstochastic).routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ (data.supremumTrafficData hSupSubstochastic).spectralThroughput hρ i)
    (hStable : ∀ i,
      (data.supremumTrafficData hSupSubstochastic).spectralThroughput hρ i < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput schedule i).toReal < data.serviceRate i := by
  exact data.constructiveThroughput_stable_of_dominating_spectral schedule
    (data.supremumTrafficData hSupSubstochastic)
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    hρ
    hNonneg
    hStable
    i

end AdaptiveJacksonTrafficData

end AdaptiveComparison

namespace JacksonNetworkData

noncomputable def load (network : JacksonNetworkData (ι := ι)) (i : ι) : ℝ :=
  network.throughput i / network.serviceRate i

theorem load_nonneg (network : JacksonNetworkData (ι := ι)) :
    ∀ i, 0 ≤ network.load i := by
  intro i
  exact div_nonneg (network.throughputNonneg i) (le_of_lt (network.servicePositive i))

theorem load_lt_one (network : JacksonNetworkData (ι := ι)) :
    ∀ i, network.load i < 1 := by
  intro i
  have hServicePos : 0 < network.serviceRate i := network.servicePositive i
  have hStable : network.throughput i < network.serviceRate i := network.stable i
  exact (div_lt_one hServicePos).2 hStable

theorem load_mul_serviceRate (network : JacksonNetworkData (ι := ι)) (i : ι) :
    network.load i * network.serviceRate i = network.throughput i := by
  unfold JacksonNetworkData.load
  field_simp [ne_of_gt (network.servicePositive i)]

theorem throughput_over_gap_eq_load_fraction (network : JacksonNetworkData (ι := ι)) (i : ι) :
    network.throughput i / (network.serviceRate i - network.throughput i) =
      network.load i / (1 - network.load i) := by
  have hServicePos : 0 < network.serviceRate i := network.servicePositive i
  have hGapPos : 0 < network.serviceRate i - network.throughput i := by
    linarith [network.stable i]
  have hLoadDenomPos : 0 < 1 - network.load i := by
    linarith [network.load_lt_one i]
  unfold JacksonNetworkData.load
  field_simp [ne_of_gt hServicePos, ne_of_gt hGapPos, ne_of_gt hLoadDenomPos]

theorem load_traffic_equation (network : JacksonNetworkData (ι := ι)) (i : ι) :
    network.throughput i =
      network.externalArrival i + ∑ j, network.throughput j * network.routing j i := by
  exact network.trafficEquation i

end JacksonNetworkData

/-- Finite open-network product-form occupancy law with independent stable `M/M/1` marginals. -/
noncomputable def jacksonProductMeasure
    (ρ : ι → ℝ)
    (hρ_nonneg : ∀ i, 0 ≤ ρ i)
    (hρ_lt_one : ∀ i, ρ i < 1) :
    ProbabilityMeasure (ι → ℕ) :=
  ProbabilityMeasure.pi fun i =>
    ⟨(mm1StationaryPMF (ρ i) (hρ_nonneg i) (hρ_lt_one i)).toMeasure, inferInstance⟩

theorem jacksonProductMeasure_apply_singleton
    {ρ : ι → ℝ}
    (hρ_nonneg : ∀ i, 0 ≤ ρ i)
    (hρ_lt_one : ∀ i, ρ i < 1)
    (state : ι → ℕ) :
    (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure {state} =
      ∏ i, ENNReal.ofReal ((ρ i) ^ (state i) * (1 - ρ i)) := by
  have hSingleton :
      Measure.pi
          (fun i =>
            (((⟨(mm1StationaryPMF (ρ i) (hρ_nonneg i) (hρ_lt_one i)).toMeasure, inferInstance⟩ :
              ProbabilityMeasure ℕ) : Measure ℕ))) {state} =
        ∏ i,
          (((⟨(mm1StationaryPMF (ρ i) (hρ_nonneg i) (hρ_lt_one i)).toMeasure, inferInstance⟩ :
            ProbabilityMeasure ℕ) : Measure ℕ) {state i}) := by
    exact
      (Measure.pi_singleton
        (μ := fun i =>
          (((⟨(mm1StationaryPMF (ρ i) (hρ_nonneg i) (hρ_lt_one i)).toMeasure, inferInstance⟩ :
            ProbabilityMeasure ℕ) : Measure ℕ)))
        state)
  calc
    (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure {state}
      = Measure.pi
          (fun i =>
            (((⟨(mm1StationaryPMF (ρ i) (hρ_nonneg i) (hρ_lt_one i)).toMeasure, inferInstance⟩ :
              ProbabilityMeasure ℕ) : Measure ℕ))) {state} := by
          simp [jacksonProductMeasure]
    _ = ∏ i,
          (((⟨(mm1StationaryPMF (ρ i) (hρ_nonneg i) (hρ_lt_one i)).toMeasure, inferInstance⟩ :
            ProbabilityMeasure ℕ) : Measure ℕ) {state i}) := hSingleton
    _ = ∏ i, ENNReal.ofReal ((ρ i) ^ (state i) * (1 - ρ i)) := by
          simp [PMF.toMeasure_apply_singleton, mm1StationaryPMF_apply]

theorem jackson_product_mean_total_occupancy
    {ρ : ι → ℝ}
    (hρ_nonneg : ∀ i, 0 ≤ ρ i)
    (hρ_lt_one : ∀ i, ρ i < 1) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure =
      ∑ i, ρ i / (1 - ρ i) := by
  rw [show (∑ i, ρ i / (1 - ρ i)) = ∑ i ∈ Finset.univ, ρ i / (1 - ρ i) by simp]
  rw [show (∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure) =
      ∫ state : ι → ℕ, ∑ i ∈ Finset.univ, (state i : ℝ) ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure by
        simp]
  rw [integral_finset_sum Finset.univ]
  · apply Finset.sum_congr rfl
    intro i hi
    calc
      ∫ state : ι → ℕ, (state i : ℝ) ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure
        = ∫ n : ℕ, (n : ℝ) ∂ (mm1StationaryPMF (ρ i) (hρ_nonneg i) (hρ_lt_one i)).toMeasure := by
            simpa [jacksonProductMeasure] using
              (MeasureTheory.integral_comp_eval
                (μ := fun j => (mm1StationaryPMF (ρ j) (hρ_nonneg j) (hρ_lt_one j)).toMeasure)
                (i := i)
                (f := fun n : ℕ => (n : ℝ))
                (mm1_stationary_integrable_queue_length (hρ_nonneg i) (hρ_lt_one i)).aestronglyMeasurable)
      _ = ρ i / (1 - ρ i) := mm1_stationary_integral_queue_length (hρ_nonneg i) (hρ_lt_one i)
  · intro i hi
    simpa [jacksonProductMeasure] using
      (MeasureTheory.integrable_comp_eval
        (μ := fun j => (mm1StationaryPMF (ρ j) (hρ_nonneg j) (hρ_lt_one j)).toMeasure)
        (i := i)
        (f := fun n : ℕ => (n : ℝ))
        (mm1_stationary_integrable_queue_length (hρ_nonneg i) (hρ_lt_one i)))

theorem jackson_product_lintegral_balance
    {ρ : ι → ℝ}
    (hρ_nonneg : ∀ i, 0 ≤ ρ i)
    (hρ_lt_one : ∀ i, ρ i < 1)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure =
      ∫⁻ state, law.sojournTime state ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure +
        ∫⁻ state, law.openAge state ∂ (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure := by
  exact measure_queue_lintegral_balance (jacksonProductMeasure ρ hρ_nonneg hρ_lt_one).toMeasure law

/-- Product-form occupancy law induced by a stable Jackson-network throughput witness. -/
noncomputable def jacksonNetworkMeasure (network : JacksonNetworkData (ι := ι)) :
    ProbabilityMeasure (ι → ℕ) :=
  jacksonProductMeasure network.load network.load_nonneg network.load_lt_one

theorem jackson_network_measure_apply_singleton
    (network : JacksonNetworkData (ι := ι))
    (state : ι → ℕ) :
    (jacksonNetworkMeasure network).toMeasure {state} =
      ∏ i, ENNReal.ofReal ((network.load i) ^ (state i) * (1 - network.load i)) := by
  exact jacksonProductMeasure_apply_singleton network.load_nonneg network.load_lt_one state

theorem jackson_network_mean_total_occupancy
    (network : JacksonNetworkData (ι := ι)) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂ (jacksonNetworkMeasure network).toMeasure =
      ∑ i, network.throughput i / (network.serviceRate i - network.throughput i) := by
  calc
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂ (jacksonNetworkMeasure network).toMeasure
      = ∑ i, network.load i / (1 - network.load i) := by
          simpa [jacksonNetworkMeasure] using
            (jackson_product_mean_total_occupancy network.load_nonneg network.load_lt_one)
    _ = ∑ i, network.throughput i / (network.serviceRate i - network.throughput i) := by
          apply Finset.sum_congr rfl
          intro i hi
          symm
          exact network.throughput_over_gap_eq_load_fraction i

theorem jackson_network_lintegral_balance
    (network : JacksonNetworkData (ι := ι))
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂ (jacksonNetworkMeasure network).toMeasure =
      ∫⁻ state, law.sojournTime state ∂ (jacksonNetworkMeasure network).toMeasure +
        ∫⁻ state, law.openAge state ∂ (jacksonNetworkMeasure network).toMeasure := by
  simpa [jacksonNetworkMeasure] using
    (jackson_product_lintegral_balance network.load_nonneg network.load_lt_one law)

noncomputable def JacksonTrafficData.constructiveNetworkMeasure
    (data : JacksonTrafficData (ι := ι))
    (hFinite : ∀ i, data.constructiveThroughput i < ∞)
    (hStable : ∀ i, (data.constructiveThroughput i).toReal < data.serviceRate i) :
    ProbabilityMeasure (ι → ℕ) :=
  jacksonNetworkMeasure (data.constructiveNetworkData hFinite hStable)

noncomputable def JacksonTrafficData.spectralNetworkMeasure
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (hStable : ∀ i, data.spectralThroughput hρ i < data.serviceRate i) :
    ProbabilityMeasure (ι → ℕ) :=
  jacksonNetworkMeasure (data.spectralNetworkData hρ hNonneg hStable)

theorem JacksonTrafficData.constructive_network_mean_total_occupancy
    (data : JacksonTrafficData (ι := ι))
    (hFinite : ∀ i, data.constructiveThroughput i < ∞)
    (hStable : ∀ i, (data.constructiveThroughput i).toReal < data.serviceRate i) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂ (data.constructiveNetworkMeasure hFinite hStable).toMeasure =
      ∑ i, (data.constructiveThroughput i).toReal /
        (data.serviceRate i - (data.constructiveThroughput i).toReal) := by
  simpa [JacksonTrafficData.constructiveNetworkMeasure, JacksonTrafficData.constructiveNetworkData] using
    jackson_network_mean_total_occupancy (data.constructiveNetworkData hFinite hStable)

theorem JacksonTrafficData.spectral_network_mean_total_occupancy
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (hStable : ∀ i, data.spectralThroughput hρ i < data.serviceRate i) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂ (data.spectralNetworkMeasure hρ hNonneg hStable).toMeasure =
      ∑ i, data.spectralThroughput hρ i /
        (data.serviceRate i - data.spectralThroughput hρ i) := by
  simpa [JacksonTrafficData.spectralNetworkMeasure, JacksonTrafficData.spectralNetworkData] using
    jackson_network_mean_total_occupancy (data.spectralNetworkData hρ hNonneg hStable)

theorem JacksonTrafficData.constructive_network_lintegral_balance
    (data : JacksonTrafficData (ι := ι))
    (hFinite : ∀ i, data.constructiveThroughput i < ∞)
    (hStable : ∀ i, (data.constructiveThroughput i).toReal < data.serviceRate i)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂ (data.constructiveNetworkMeasure hFinite hStable).toMeasure =
      ∫⁻ state, law.sojournTime state ∂ (data.constructiveNetworkMeasure hFinite hStable).toMeasure +
        ∫⁻ state, law.openAge state ∂ (data.constructiveNetworkMeasure hFinite hStable).toMeasure := by
  simpa [JacksonTrafficData.constructiveNetworkMeasure, JacksonTrafficData.constructiveNetworkData] using
    jackson_network_lintegral_balance (data.constructiveNetworkData hFinite hStable) law

theorem JacksonTrafficData.spectral_network_lintegral_balance
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (hStable : ∀ i, data.spectralThroughput hρ i < data.serviceRate i)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂ (data.spectralNetworkMeasure hρ hNonneg hStable).toMeasure =
      ∫⁻ state, law.sojournTime state ∂ (data.spectralNetworkMeasure hρ hNonneg hStable).toMeasure +
        ∫⁻ state, law.openAge state ∂ (data.spectralNetworkMeasure hρ hNonneg hStable).toMeasure := by
  simpa [JacksonTrafficData.spectralNetworkMeasure, JacksonTrafficData.spectralNetworkData] using
    jackson_network_lintegral_balance (data.spectralNetworkData hρ hNonneg hStable) law

end JacksonProduct

end ForkRaceFoldTheorems
