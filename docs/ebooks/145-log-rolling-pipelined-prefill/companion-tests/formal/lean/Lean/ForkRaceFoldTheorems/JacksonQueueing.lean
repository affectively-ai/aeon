import Mathlib
import ForkRaceFoldTheorems.QueueStability

open Filter MeasureTheory ProbabilityTheory
open scoped BigOperators ENNReal Matrix Topology

namespace Matrix

theorem spectrum_transpose_eq
    {K : Type*} [Field K]
    {n : Type*} [Fintype n] [DecidableEq n]
    (A : Matrix n n K) :
    spectrum K Aᵀ = spectrum K A := by
  ext r
  rw [Matrix.mem_spectrum_iff_isRoot_charpoly, Matrix.mem_spectrum_iff_isRoot_charpoly,
    Matrix.charpoly_transpose]

theorem spectralRadius_transpose_eq
    {K : Type*} [NormedField K]
    {n : Type*} [Fintype n] [DecidableEq n]
    (A : Matrix n n K) :
    spectralRadius K Aᵀ = spectralRadius K A := by
  simp [spectralRadius, Matrix.spectrum_transpose_eq]

end Matrix

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

omit [DecidableEq ι] in
open scoped Matrix.Norms.Operator in
omit [DecidableEq ι] in
theorem routingMatrix_nnnorm_lt_one_of_strict_row_substochastic
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : ∀ i, ∑ j, data.routing i j < 1) :
    ‖data.routingMatrix‖₊ < 1 := by
  rw [Matrix.linfty_opNNNorm_def]
  obtain ⟨i, hi, hmax⟩ := Finset.exists_mem_eq_sup
    (s := Finset.univ)
    Finset.univ_nonempty
    (fun i : ι => ∑ j : ι, ‖data.routingMatrix i j‖₊)
  rw [hmax]
  have hRow :
      (∑ j : ι, Real.toNNReal (data.routing i j)) < 1 := by
    rw [← Real.toNNReal_sum_of_nonneg (fun j _ => data.routingNonneg i j)]
    exact (Real.toNNReal_lt_one).2 (hContractive i)
  simpa [routingMatrix_apply, Real.nnnorm_of_nonneg, Real.toNNReal_of_nonneg, data.routingNonneg] using hRow

open scoped Matrix.Norms.Operator in
theorem routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : ∀ i, ∑ j, data.routing i j < 1) :
    spectralRadius ℝ data.routingMatrix < 1 := by
  have hNorm : (‖data.routingMatrix‖₊ : ℝ≥0∞) < 1 := by
    exact_mod_cast data.routingMatrix_nnnorm_lt_one_of_strict_row_substochastic hContractive
  exact lt_of_le_of_lt
    (spectrum.spectralRadius_le_nnnorm (𝕜 := ℝ) data.routingMatrix)
    hNorm

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

/--
Under resolvent invertibility, the Jackson traffic equations have a unique real-valued
fixed point, namely the spectral/resolvent throughput.
-/
theorem real_fixed_point_eq_spectralThroughput
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (candidate : ι → ℝ)
    (hFixed :
      ∀ i,
        candidate i =
          data.externalArrival i + ∑ j, candidate j * data.routing j i) :
    candidate = data.spectralThroughput hρ := by
  have hMatrix :
      candidate =
        data.externalArrival + Matrix.vecMul candidate data.routingMatrix := by
    funext i
    simpa [Matrix.vecMul, dotProduct, routingMatrix_apply] using hFixed i
  have hResolvent :
      Matrix.vecMul candidate (1 - data.routingMatrix) = data.externalArrival := by
    rw [Matrix.vecMul_sub, Matrix.vecMul_one]
    exact sub_eq_iff_eq_add.mpr hMatrix
  let hUnit := data.routingMatrix_isUnit_of_spectralRadius_lt_one hρ
  let u : Units (Matrix ι ι ℝ) := hUnit.unit
  have hu : (↑u : Matrix ι ι ℝ) = 1 - data.routingMatrix := hUnit.unit_spec
  calc
    candidate = Matrix.vecMul candidate 1 := by simp
    _ = Matrix.vecMul candidate ((1 - data.routingMatrix) * (↑(u⁻¹) : Matrix ι ι ℝ)) := by
          congr 1
          calc
            (1 : Matrix ι ι ℝ) = (↑u : Matrix ι ι ℝ) * (↑(u⁻¹) : Matrix ι ι ℝ) := by simp
            _ = (1 - data.routingMatrix) * (↑(u⁻¹) : Matrix ι ι ℝ) := by rw [hu]
    _ = Matrix.vecMul (Matrix.vecMul candidate (1 - data.routingMatrix)) (↑(u⁻¹) : Matrix ι ι ℝ) := by
          rw [Matrix.vecMul_vecMul]
    _ = Matrix.vecMul data.externalArrival (↑(u⁻¹) : Matrix ι ι ℝ) := by rw [hResolvent]
    _ = data.spectralThroughput hρ := by
          unfold spectralThroughput
          rfl

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
Any nonnegative real-valued supersolution of the Jackson traffic equations bounds the
constructive throughput witness from above after embedding into `ℝ≥0∞`.
-/
theorem constructiveThroughput_le_of_real_postfixed
    (data : JacksonTrafficData (ι := ι))
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hPostfixed :
      ∀ i, data.externalArrival i + ∑ j, candidate j * data.routing j i ≤ candidate i)
    (i : ι) :
    data.constructiveThroughput i ≤ ENNReal.ofReal (candidate i) := by
  exact data.constructiveThroughput_le_of_postfixed
    (candidate := fun j => ENNReal.ofReal (candidate j))
    (hPostfixed := by
      intro k
      have hSumNonneg : 0 ≤ ∑ j, candidate j * data.routing j k := by
        refine Finset.sum_nonneg ?_
        intro j hj
        exact mul_nonneg (hNonneg j) (data.routingNonneg j k)
      rw [trafficStep]
      calc
        ENNReal.ofReal (data.externalArrival k) +
            ∑ j, ENNReal.ofReal (candidate j) * ENNReal.ofReal (data.routing j k)
          = ENNReal.ofReal (data.externalArrival k) +
              ∑ j, ENNReal.ofReal (candidate j * data.routing j k) := by
                congr 1
                apply Finset.sum_congr rfl
                intro j hj
                rw [ENNReal.ofReal_mul (hNonneg j)]
        _ = ENNReal.ofReal (data.externalArrival k) +
              ENNReal.ofReal (∑ j, candidate j * data.routing j k) := by
                rw [← ENNReal.ofReal_sum_of_nonneg
                  (fun j _ => mul_nonneg (hNonneg j) (data.routingNonneg j k))]
        _ = ENNReal.ofReal (data.externalArrival k + ∑ j, candidate j * data.routing j k) := by
                symm
                rw [ENNReal.ofReal_add (data.arrivalNonneg k) hSumNonneg]
        _ ≤ ENNReal.ofReal (candidate k) := by
                exact ENNReal.ofReal_le_ofReal (hPostfixed k))
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
  exact data.constructiveThroughput_le_of_real_postfixed
    candidate
    hNonneg
    (by
      intro k
      rw [hFixed k])
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

theorem constructiveThroughput_le_spectralThroughput_of_strict_row_substochastic
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : ∀ i, ∑ j, data.routing i j < 1)
    (hNonneg :
      ∀ i, 0 ≤ data.spectralThroughput
        (data.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hContractive) i)
    (i : ι) :
    data.constructiveThroughput i ≤
      ENNReal.ofReal
        (data.spectralThroughput
          (data.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hContractive) i) := by
  exact data.constructiveThroughput_le_spectralThroughput
    (data.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hContractive)
    hNonneg
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

theorem constructiveThroughput_finite_of_strict_row_substochastic
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : ∀ i, ∑ j, data.routing i j < 1)
    (hNonneg :
      ∀ i, 0 ≤ data.spectralThroughput
        (data.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hContractive) i)
    (i : ι) :
    data.constructiveThroughput i < ∞ := by
  exact data.constructiveThroughput_finite_of_spectral
    (data.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hContractive)
    hNonneg
    i

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

theorem constructiveThroughput_stable_of_strict_row_substochastic
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : ∀ i, ∑ j, data.routing i j < 1)
    (hNonneg :
      ∀ i, 0 ≤ data.spectralThroughput
        (data.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hContractive) i)
    (hStable :
      ∀ i, data.spectralThroughput
        (data.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hContractive) i <
        data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput i).toReal < data.serviceRate i := by
  exact data.constructiveThroughput_stable_of_spectral
    (data.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hContractive)
    hNonneg
    hStable
    i

noncomputable def incomingRoutingMass
    (data : JacksonTrafficData (ι := ι))
    (i : ι) : ℝ :=
  ∑ j, data.routing j i

theorem incomingRoutingMass_nonneg
    (data : JacksonTrafficData (ι := ι))
    (i : ι) :
    0 ≤ data.incomingRoutingMass i := by
  exact Finset.sum_nonneg fun j _ => data.routingNonneg j i

noncomputable def maxExternalArrival
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι)) : ℝ :=
  Finset.univ.sup' Finset.univ_nonempty data.externalArrival

theorem externalArrival_le_maxExternalArrival
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (i : ι) :
    data.externalArrival i ≤ data.maxExternalArrival := by
  exact Finset.le_sup' (s := Finset.univ) (f := data.externalArrival) (Finset.mem_univ i)

theorem maxExternalArrival_nonneg
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι)) :
    0 ≤ data.maxExternalArrival := by
  let witness : ι := Classical.choice inferInstance
  exact le_trans (data.arrivalNonneg witness) (data.externalArrival_le_maxExternalArrival witness)

noncomputable def maxIncomingRoutingMass
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι)) : ℝ :=
  Finset.univ.sup' Finset.univ_nonempty data.incomingRoutingMass

theorem incomingRoutingMass_le_maxIncomingRoutingMass
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (i : ι) :
    data.incomingRoutingMass i ≤ data.maxIncomingRoutingMass := by
  exact Finset.le_sup' (s := Finset.univ) (f := data.incomingRoutingMass) (Finset.mem_univ i)

theorem maxIncomingRoutingMass_nonneg
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι)) :
    0 ≤ data.maxIncomingRoutingMass := by
  let witness : ι := Classical.choice inferInstance
  exact le_trans (data.incomingRoutingMass_nonneg witness)
    (data.incomingRoutingMass_le_maxIncomingRoutingMass witness)

open scoped Matrix.Norms.Operator in
theorem routingMatrix_transpose_nnnorm_lt_one_of_maxIncomingRoutingMass_lt_one
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1) :
    ‖data.routingMatrixᵀ‖₊ < 1 := by
  rw [Matrix.linfty_opNNNorm_def]
  obtain ⟨i, hi, hmax⟩ := Finset.exists_mem_eq_sup
    (s := Finset.univ)
    Finset.univ_nonempty
    (fun i : ι => ∑ j : ι, ‖data.routingMatrixᵀ i j‖₊)
  rw [hmax]
  have hRow :
      (∑ j : ι, Real.toNNReal (data.routing j i)) < 1 := by
    rw [← Real.toNNReal_sum_of_nonneg (fun j _ => data.routingNonneg j i)]
    exact (Real.toNNReal_lt_one).2 <|
      lt_of_le_of_lt (data.incomingRoutingMass_le_maxIncomingRoutingMass i) hContractive
  simpa [routingMatrix_apply, Matrix.transpose_apply, Real.nnnorm_of_nonneg,
    Real.toNNReal_of_nonneg, data.routingNonneg] using hRow

open scoped Matrix.Norms.Operator in
theorem routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1) :
    spectralRadius ℝ data.routingMatrix < 1 := by
  have hNorm : (‖data.routingMatrixᵀ‖₊ : ℝ≥0∞) < 1 := by
    exact_mod_cast data.routingMatrix_transpose_nnnorm_lt_one_of_maxIncomingRoutingMass_lt_one
      hContractive
  have hTranspose :
      spectralRadius ℝ data.routingMatrixᵀ < 1 := by
    exact lt_of_le_of_lt
      (spectrum.spectralRadius_le_nnnorm (𝕜 := ℝ) data.routingMatrixᵀ)
      hNorm
  rw [← Matrix.spectralRadius_transpose_eq data.routingMatrix]
  exact hTranspose

theorem constructiveThroughput_le_of_uniform_column_bound
    (data : JacksonTrafficData (ι := ι))
    (arrivalBound contractivity : ℝ)
    (hArrivalBoundNonneg : 0 ≤ arrivalBound)
    (hArrivalBound : ∀ i, data.externalArrival i ≤ arrivalBound)
    (hColumnBound : ∀ i, ∑ j, data.routing j i ≤ contractivity)
    (hContractivityNonneg : 0 ≤ contractivity)
    (hContractivityLt : contractivity < 1)
    (i : ι) :
    data.constructiveThroughput i ≤ ENNReal.ofReal (arrivalBound / (1 - contractivity)) := by
  let bound : ℝ := arrivalBound / (1 - contractivity)
  have hDenPos : 0 < 1 - contractivity := sub_pos.mpr hContractivityLt
  have hBoundNonneg : 0 ≤ bound := by
    dsimp [bound]
    exact div_nonneg hArrivalBoundNonneg hDenPos.le
  have hBoundEq : arrivalBound + bound * contractivity = bound := by
    dsimp [bound]
    field_simp [hDenPos.ne']
    ring
  exact data.constructiveThroughput_le_of_postfixed
    (candidate := fun _ => ENNReal.ofReal bound)
    (hPostfixed := by
      intro k
      have hMulSum :
          (∑ j, bound * data.routing j k) = bound * ∑ j, data.routing j k := by
        rw [Finset.mul_sum]
      rw [trafficStep]
      calc
        ENNReal.ofReal (data.externalArrival k) +
            ∑ j, ENNReal.ofReal bound * ENNReal.ofReal (data.routing j k)
          = ENNReal.ofReal (data.externalArrival k) +
              ENNReal.ofReal (∑ j, bound * data.routing j k) := by
                congr 1
                calc
                  ∑ j, ENNReal.ofReal bound * ENNReal.ofReal (data.routing j k)
                    = ∑ j, ENNReal.ofReal (bound * data.routing j k) := by
                        apply Finset.sum_congr rfl
                        intro j hj
                        rw [ENNReal.ofReal_mul hBoundNonneg]
                  _ = ENNReal.ofReal (∑ j, bound * data.routing j k) := by
                        symm
                        exact ENNReal.ofReal_sum_of_nonneg
                          (fun j _ => mul_nonneg hBoundNonneg (data.routingNonneg j k))
        _ ≤ ENNReal.ofReal arrivalBound +
              ENNReal.ofReal (∑ j, bound * data.routing j k) := by
                exact add_le_add (ENNReal.ofReal_le_ofReal (hArrivalBound k)) le_rfl
        _ = ENNReal.ofReal arrivalBound +
              ENNReal.ofReal (bound * ∑ j, data.routing j k) := by
                rw [hMulSum]
        _ ≤ ENNReal.ofReal arrivalBound + ENNReal.ofReal (bound * contractivity) := by
                refine add_le_add le_rfl ?_
                exact ENNReal.ofReal_le_ofReal
                  (mul_le_mul_of_nonneg_left (hColumnBound k) hBoundNonneg)
        _ = ENNReal.ofReal (arrivalBound + bound * contractivity) := by
                rw [← ENNReal.ofReal_add hArrivalBoundNonneg
                  (mul_nonneg hBoundNonneg hContractivityNonneg)]
        _ = ENNReal.ofReal bound := by rw [hBoundEq])
    i

theorem constructiveThroughput_finite_of_uniform_column_bound
    (data : JacksonTrafficData (ι := ι))
    (arrivalBound contractivity : ℝ)
    (hArrivalBoundNonneg : 0 ≤ arrivalBound)
    (hArrivalBound : ∀ i, data.externalArrival i ≤ arrivalBound)
    (hColumnBound : ∀ i, ∑ j, data.routing j i ≤ contractivity)
    (hContractivityNonneg : 0 ≤ contractivity)
    (hContractivityLt : contractivity < 1)
    (i : ι) :
    data.constructiveThroughput i < ∞ := by
  exact lt_of_le_of_lt
    (data.constructiveThroughput_le_of_uniform_column_bound
      arrivalBound contractivity
      hArrivalBoundNonneg hArrivalBound hColumnBound hContractivityNonneg hContractivityLt i)
    ENNReal.ofReal_lt_top

theorem constructiveThroughput_stable_of_uniform_column_bound
    (data : JacksonTrafficData (ι := ι))
    (arrivalBound contractivity : ℝ)
    (hArrivalBoundNonneg : 0 ≤ arrivalBound)
    (hArrivalBound : ∀ i, data.externalArrival i ≤ arrivalBound)
    (hColumnBound : ∀ i, ∑ j, data.routing j i ≤ contractivity)
    (hContractivityNonneg : 0 ≤ contractivity)
    (hContractivityLt : contractivity < 1)
    (hServiceBound : ∀ i, arrivalBound / (1 - contractivity) < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput i).toReal < data.serviceRate i := by
  have hDenPos : 0 < 1 - contractivity := sub_pos.mpr hContractivityLt
  have hBoundNonneg : 0 ≤ arrivalBound / (1 - contractivity) :=
    div_nonneg hArrivalBoundNonneg hDenPos.le
  have hLe :
      data.constructiveThroughput i ≤ ENNReal.ofReal (arrivalBound / (1 - contractivity)) :=
    data.constructiveThroughput_le_of_uniform_column_bound
      arrivalBound contractivity
      hArrivalBoundNonneg hArrivalBound hColumnBound hContractivityNonneg hContractivityLt i
  have hToRealLe :
      (data.constructiveThroughput i).toReal ≤ arrivalBound / (1 - contractivity) :=
    ENNReal.toReal_le_of_le_ofReal hBoundNonneg hLe
  exact lt_of_le_of_lt hToRealLe (hServiceBound i)

theorem constructiveThroughput_le_of_maxIncomingRoutingMass_lt_one
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (i : ι) :
    data.constructiveThroughput i ≤
      ENNReal.ofReal (data.maxExternalArrival / (1 - data.maxIncomingRoutingMass)) := by
  exact data.constructiveThroughput_le_of_uniform_column_bound
    data.maxExternalArrival
    data.maxIncomingRoutingMass
    data.maxExternalArrival_nonneg
    data.externalArrival_le_maxExternalArrival
    data.incomingRoutingMass_le_maxIncomingRoutingMass
    data.maxIncomingRoutingMass_nonneg
    hContractive
    i

theorem constructiveThroughput_finite_of_maxIncomingRoutingMass_lt_one
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (i : ι) :
    data.constructiveThroughput i < ∞ := by
  exact lt_of_le_of_lt
    (data.constructiveThroughput_le_of_maxIncomingRoutingMass_lt_one hContractive i)
    ENNReal.ofReal_lt_top

theorem constructiveThroughput_stable_of_maxIncomingRoutingMass_lt_one
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound :
      ∀ i, data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput i).toReal < data.serviceRate i := by
  have hDenPos : 0 < 1 - data.maxIncomingRoutingMass := sub_pos.mpr hContractive
  have hBoundNonneg : 0 ≤ data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) :=
    div_nonneg data.maxExternalArrival_nonneg hDenPos.le
  have hLe :
      data.constructiveThroughput i ≤
        ENNReal.ofReal (data.maxExternalArrival / (1 - data.maxIncomingRoutingMass)) :=
    data.constructiveThroughput_le_of_maxIncomingRoutingMass_lt_one hContractive i
  have hToRealLe :
      (data.constructiveThroughput i).toReal ≤
        data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) :=
    ENNReal.toReal_le_of_le_ofReal hBoundNonneg hLe
  exact lt_of_le_of_lt hToRealLe (hServiceBound i)

theorem constructiveThroughput_toReal_fixed_point
    (data : JacksonTrafficData (ι := ι))
    (hFinite : ∀ i, data.constructiveThroughput i < ∞)
    (i : ι) :
    (data.constructiveThroughput i).toReal =
      data.externalArrival i + ∑ j, (data.constructiveThroughput j).toReal * data.routing j i := by
  have hFixed := data.constructiveThroughput_fixed_point i
  have hSumFinite :
      (∑ j, data.constructiveThroughput j * ENNReal.ofReal (data.routing j i)) < ∞ := by
    exact ENNReal.sum_lt_top.2 fun j _ =>
      ENNReal.mul_lt_top (hFinite j) ENNReal.ofReal_lt_top
  have hFixedReal := congrArg ENNReal.toReal hFixed
  rw [ENNReal.toReal_add ENNReal.ofReal_ne_top hSumFinite.ne,
    ENNReal.toReal_ofReal (data.arrivalNonneg i),
    ENNReal.toReal_sum (fun j _ =>
      (ENNReal.mul_lt_top (hFinite j) ENNReal.ofReal_lt_top).ne)] at hFixedReal
  simp_rw [ENNReal.toReal_mul, ENNReal.toReal_ofReal (data.routingNonneg _ _)] at hFixedReal
  exact hFixedReal

theorem constructiveThroughput_toReal_eq_spectralThroughput
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hFinite : ∀ i, data.constructiveThroughput i < ∞) :
    ∀ i, (data.constructiveThroughput i).toReal = data.spectralThroughput hρ i := by
  intro i
  have hEq :
      (fun j => (data.constructiveThroughput j).toReal) = data.spectralThroughput hρ :=
    data.real_fixed_point_eq_spectralThroughput
      hρ
      (fun j => (data.constructiveThroughput j).toReal)
      (data.constructiveThroughput_toReal_fixed_point hFinite)
  exact congrFun hEq i

theorem spectralThroughput_nonneg_of_constructiveFinite
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hFinite : ∀ i, data.constructiveThroughput i < ∞) :
    ∀ i, 0 ≤ data.spectralThroughput hρ i := by
  intro i
  rw [← data.constructiveThroughput_toReal_eq_spectralThroughput hρ hFinite i]
  exact ENNReal.toReal_nonneg

theorem spectralThroughput_stable_of_constructive
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hFinite : ∀ i, data.constructiveThroughput i < ∞)
    (hStable : ∀ i, (data.constructiveThroughput i).toReal < data.serviceRate i) :
    ∀ i, data.spectralThroughput hρ i < data.serviceRate i := by
  intro i
  rw [← data.constructiveThroughput_toReal_eq_spectralThroughput hρ hFinite i]
  exact hStable i

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

noncomputable def spectralNetworkDataOfConstructive
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hFinite : ∀ i, data.constructiveThroughput i < ∞)
    (hStable : ∀ i, (data.constructiveThroughput i).toReal < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.spectralNetworkData
    hρ
    (data.spectralThroughput_nonneg_of_constructiveFinite hρ hFinite)
    (data.spectralThroughput_stable_of_constructive hρ hFinite hStable)

noncomputable def constructiveNetworkDataOfStrictRowSubstochastic
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : ∀ i, ∑ j, data.routing i j < 1)
    (hNonneg :
      ∀ i, 0 ≤ data.spectralThroughput
        (data.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hContractive) i)
    (hStable :
      ∀ i, data.spectralThroughput
        (data.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hContractive) i <
        data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.constructiveNetworkData
    (data.constructiveThroughput_finite_of_strict_row_substochastic hContractive hNonneg)
    (data.constructiveThroughput_stable_of_strict_row_substochastic hContractive hNonneg hStable)

noncomputable def constructiveNetworkDataOfUniformColumnBound
    (data : JacksonTrafficData (ι := ι))
    (arrivalBound contractivity : ℝ)
    (hArrivalBoundNonneg : 0 ≤ arrivalBound)
    (hArrivalBound : ∀ i, data.externalArrival i ≤ arrivalBound)
    (hColumnBound : ∀ i, ∑ j, data.routing j i ≤ contractivity)
    (hContractivityNonneg : 0 ≤ contractivity)
    (hContractivityLt : contractivity < 1)
    (hServiceBound : ∀ i, arrivalBound / (1 - contractivity) < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.constructiveNetworkData
    (data.constructiveThroughput_finite_of_uniform_column_bound
      arrivalBound contractivity
      hArrivalBoundNonneg hArrivalBound hColumnBound hContractivityNonneg hContractivityLt)
    (data.constructiveThroughput_stable_of_uniform_column_bound
      arrivalBound contractivity
      hArrivalBoundNonneg hArrivalBound hColumnBound hContractivityNonneg hContractivityLt
      hServiceBound)

noncomputable def constructiveNetworkDataOfMaxIncomingRoutingMass
    [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound :
      ∀ i, data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.constructiveNetworkData
    (data.constructiveThroughput_finite_of_maxIncomingRoutingMass_lt_one hContractive)
    (data.constructiveThroughput_stable_of_maxIncomingRoutingMass_lt_one
      hContractive hServiceBound)

noncomputable def spectralNetworkDataOfMaxIncomingRoutingMass
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound :
      ∀ i, data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.spectralNetworkDataOfConstructive
    hρ
    (data.constructiveThroughput_finite_of_maxIncomingRoutingMass_lt_one hContractive)
    (data.constructiveThroughput_stable_of_maxIncomingRoutingMass_lt_one
      hContractive hServiceBound)

noncomputable def spectralNetworkDataOfMaxIncomingRoutingMassAuto
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound :
      ∀ i, data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.spectralNetworkDataOfMaxIncomingRoutingMass
    (data.routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one hContractive)
    hContractive
    hServiceBound

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
theorem constructiveThroughput_le_of_dominating_real_fixed_point
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hFixed : ∀ i, candidate i = dominant.externalArrival i + ∑ j, candidate j * dominant.routing j i)
    (i : ι) :
    data.constructiveThroughput schedule i ≤ ENNReal.ofReal (candidate i) := by
  exact le_trans
    (data.constructiveThroughput_le_of_dominated schedule dominant hArrivalLe hRoutingLe i)
    (dominant.constructiveThroughput_le_of_real_fixed_point candidate hNonneg hFixed i)

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_le_of_dominating_real_postfixed
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hPostfixed :
      ∀ i, dominant.externalArrival i + ∑ j, candidate j * dominant.routing j i ≤ candidate i)
    (i : ι) :
    data.constructiveThroughput schedule i ≤ ENNReal.ofReal (candidate i) := by
  exact le_trans
    (data.constructiveThroughput_le_of_dominated schedule dominant hArrivalLe hRoutingLe i)
    (dominant.constructiveThroughput_le_of_real_postfixed candidate hNonneg hPostfixed i)

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_finite_of_dominating_real_fixed_point
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hFixed : ∀ i, candidate i = dominant.externalArrival i + ∑ j, candidate j * dominant.routing j i)
    (i : ι) :
    data.constructiveThroughput schedule i < ∞ := by
  exact lt_of_le_of_lt
    (data.constructiveThroughput_le_of_dominating_real_fixed_point schedule dominant
      hArrivalLe hRoutingLe candidate hNonneg hFixed i)
    ENNReal.ofReal_lt_top

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_finite_of_dominating_real_postfixed
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hPostfixed :
      ∀ i, dominant.externalArrival i + ∑ j, candidate j * dominant.routing j i ≤ candidate i)
    (i : ι) :
    data.constructiveThroughput schedule i < ∞ := by
  exact lt_of_le_of_lt
    (data.constructiveThroughput_le_of_dominating_real_postfixed schedule dominant
      hArrivalLe hRoutingLe candidate hNonneg hPostfixed i)
    ENNReal.ofReal_lt_top

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_stable_of_dominating_real_fixed_point
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hFixed : ∀ i, candidate i = dominant.externalArrival i + ∑ j, candidate j * dominant.routing j i)
    (hStable : ∀ i, candidate i < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput schedule i).toReal < data.serviceRate i := by
  have hLe :
      data.constructiveThroughput schedule i ≤ ENNReal.ofReal (candidate i) :=
    data.constructiveThroughput_le_of_dominating_real_fixed_point schedule dominant
      hArrivalLe hRoutingLe candidate hNonneg hFixed i
  have hToRealLe :
      (data.constructiveThroughput schedule i).toReal ≤ candidate i :=
    ENNReal.toReal_le_of_le_ofReal (hNonneg i) hLe
  exact lt_of_le_of_lt hToRealLe (hStable i)

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_stable_of_dominating_real_postfixed
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hPostfixed :
      ∀ i, dominant.externalArrival i + ∑ j, candidate j * dominant.routing j i ≤ candidate i)
    (hStable : ∀ i, candidate i < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput schedule i).toReal < data.serviceRate i := by
  have hLe :
      data.constructiveThroughput schedule i ≤ ENNReal.ofReal (candidate i) :=
    data.constructiveThroughput_le_of_dominating_real_postfixed schedule dominant
      hArrivalLe hRoutingLe candidate hNonneg hPostfixed i
  have hToRealLe :
      (data.constructiveThroughput schedule i).toReal ≤ candidate i :=
    ENNReal.toReal_le_of_le_ofReal (hNonneg i) hLe
  exact lt_of_le_of_lt hToRealLe (hStable i)

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

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_le_of_dominating_uniform_column_bound
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (arrivalBound contractivity : ℝ)
    (hArrivalBoundNonneg : 0 ≤ arrivalBound)
    (hDominantArrivalBound : ∀ i, dominant.externalArrival i ≤ arrivalBound)
    (hDominantColumnBound : ∀ i, ∑ j, dominant.routing j i ≤ contractivity)
    (hContractivityNonneg : 0 ≤ contractivity)
    (hContractivityLt : contractivity < 1)
    (i : ι) :
    data.constructiveThroughput schedule i ≤ ENNReal.ofReal (arrivalBound / (1 - contractivity)) := by
  exact le_trans
    (data.constructiveThroughput_le_of_dominated schedule dominant hArrivalLe hRoutingLe i)
    (dominant.constructiveThroughput_le_of_uniform_column_bound
      arrivalBound contractivity
      hArrivalBoundNonneg hDominantArrivalBound hDominantColumnBound
      hContractivityNonneg hContractivityLt i)

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_finite_of_dominating_uniform_column_bound
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (arrivalBound contractivity : ℝ)
    (hArrivalBoundNonneg : 0 ≤ arrivalBound)
    (hDominantArrivalBound : ∀ i, dominant.externalArrival i ≤ arrivalBound)
    (hDominantColumnBound : ∀ i, ∑ j, dominant.routing j i ≤ contractivity)
    (hContractivityNonneg : 0 ≤ contractivity)
    (hContractivityLt : contractivity < 1)
    (i : ι) :
    data.constructiveThroughput schedule i < ∞ := by
  exact lt_of_le_of_lt
    (data.constructiveThroughput_le_of_dominating_uniform_column_bound schedule dominant
      hArrivalLe hRoutingLe
      arrivalBound contractivity
      hArrivalBoundNonneg hDominantArrivalBound hDominantColumnBound
      hContractivityNonneg hContractivityLt i)
    ENNReal.ofReal_lt_top

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_stable_of_dominating_uniform_column_bound
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (arrivalBound contractivity : ℝ)
    (hArrivalBoundNonneg : 0 ≤ arrivalBound)
    (hDominantArrivalBound : ∀ i, dominant.externalArrival i ≤ arrivalBound)
    (hDominantColumnBound : ∀ i, ∑ j, dominant.routing j i ≤ contractivity)
    (hContractivityNonneg : 0 ≤ contractivity)
    (hContractivityLt : contractivity < 1)
    (hServiceBound : ∀ i, arrivalBound / (1 - contractivity) < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput schedule i).toReal < data.serviceRate i := by
  have hLe :
      data.constructiveThroughput schedule i ≤ ENNReal.ofReal (arrivalBound / (1 - contractivity)) :=
    data.constructiveThroughput_le_of_dominating_uniform_column_bound schedule dominant
      hArrivalLe hRoutingLe
      arrivalBound contractivity
      hArrivalBoundNonneg hDominantArrivalBound hDominantColumnBound
      hContractivityNonneg hContractivityLt i
  have hDenPos : 0 < 1 - contractivity := sub_pos.mpr hContractivityLt
  have hBoundNonneg : 0 ≤ arrivalBound / (1 - contractivity) :=
    div_nonneg hArrivalBoundNonneg hDenPos.le
  have hToRealLe :
      (data.constructiveThroughput schedule i).toReal ≤ arrivalBound / (1 - contractivity) :=
    ENNReal.toReal_le_of_le_ofReal hBoundNonneg hLe
  exact lt_of_le_of_lt hToRealLe (hServiceBound i)

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_le_of_dominating_maxIncomingRoutingMass_lt_one
    [Nonempty ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (hContractive : dominant.maxIncomingRoutingMass < 1)
    (i : ι) :
    data.constructiveThroughput schedule i ≤
      ENNReal.ofReal (dominant.maxExternalArrival / (1 - dominant.maxIncomingRoutingMass)) := by
  exact data.constructiveThroughput_le_of_dominating_uniform_column_bound schedule
    dominant
    hArrivalLe
    hRoutingLe
    dominant.maxExternalArrival
    dominant.maxIncomingRoutingMass
    dominant.maxExternalArrival_nonneg
    dominant.externalArrival_le_maxExternalArrival
    dominant.incomingRoutingMass_le_maxIncomingRoutingMass
    dominant.maxIncomingRoutingMass_nonneg
    hContractive
    i

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_finite_of_dominating_maxIncomingRoutingMass_lt_one
    [Nonempty ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (hContractive : dominant.maxIncomingRoutingMass < 1)
    (i : ι) :
    data.constructiveThroughput schedule i < ∞ := by
  exact lt_of_le_of_lt
    (data.constructiveThroughput_le_of_dominating_maxIncomingRoutingMass_lt_one schedule
      dominant hArrivalLe hRoutingLe hContractive i)
    ENNReal.ofReal_lt_top

omit [Fintype σ] [Nonempty σ] in
theorem constructiveThroughput_stable_of_dominating_maxIncomingRoutingMass_lt_one
    [Nonempty ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (dominant : JacksonTrafficData (ι := ι))
    (hArrivalLe : ∀ i, data.externalArrival i ≤ dominant.externalArrival i)
    (hRoutingLe : ∀ s i j, data.routing s i j ≤ dominant.routing i j)
    (hContractive : dominant.maxIncomingRoutingMass < 1)
    (hServiceBound :
      ∀ i, dominant.maxExternalArrival / (1 - dominant.maxIncomingRoutingMass) < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput schedule i).toReal < data.serviceRate i := by
  have hDenPos : 0 < 1 - dominant.maxIncomingRoutingMass := sub_pos.mpr hContractive
  have hBoundNonneg : 0 ≤ dominant.maxExternalArrival / (1 - dominant.maxIncomingRoutingMass) :=
    div_nonneg dominant.maxExternalArrival_nonneg hDenPos.le
  have hLe :
      data.constructiveThroughput schedule i ≤
        ENNReal.ofReal (dominant.maxExternalArrival / (1 - dominant.maxIncomingRoutingMass)) :=
    data.constructiveThroughput_le_of_dominating_maxIncomingRoutingMass_lt_one schedule
      dominant hArrivalLe hRoutingLe hContractive i
  have hToRealLe :
      (data.constructiveThroughput schedule i).toReal ≤
        dominant.maxExternalArrival / (1 - dominant.maxIncomingRoutingMass) :=
    ENNReal.toReal_le_of_le_ofReal hBoundNonneg hLe
  exact lt_of_le_of_lt hToRealLe (hServiceBound i)

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

theorem constructiveThroughput_le_supremumRealPostfixed
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hPostfixed :
      ∀ i,
        (data.supremumTrafficData hSupSubstochastic).externalArrival i +
          ∑ j, candidate j * (data.supremumTrafficData hSupSubstochastic).routing j i ≤
        candidate i)
    (i : ι) :
    data.constructiveThroughput schedule i ≤ ENNReal.ofReal (candidate i) := by
  exact data.constructiveThroughput_le_of_dominating_real_postfixed schedule
    (data.supremumTrafficData hSupSubstochastic)
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    candidate
    hNonneg
    hPostfixed
    i

theorem constructiveThroughput_le_supremumStrictRowSubstochasticSpectral
    [DecidableEq ι] [Nonempty ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (hSupContractive : ∀ i, ∑ j, data.supremumKernel i j < 1)
    (hNonneg : ∀ i, 0 ≤
      let dominant := data.supremumTrafficData hSupSubstochastic
      dominant.spectralThroughput
        (dominant.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hSupContractive) i)
    (i : ι) :
    data.constructiveThroughput schedule i ≤ ENNReal.ofReal (
      let dominant := data.supremumTrafficData hSupSubstochastic
      dominant.spectralThroughput
        (dominant.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hSupContractive) i) := by
  let dominant := data.supremumTrafficData hSupSubstochastic
  exact data.constructiveThroughput_le_of_dominating_spectral schedule
    dominant
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    (dominant.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hSupContractive)
    hNonneg
    i

theorem constructiveThroughput_le_supremumUniformColumnBound
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (arrivalBound contractivity : ℝ)
    (hArrivalBoundNonneg : 0 ≤ arrivalBound)
    (hArrivalBound : ∀ i, data.externalArrival i ≤ arrivalBound)
    (hSupColumnBound : ∀ i, ∑ j, data.supremumKernel j i ≤ contractivity)
    (hContractivityNonneg : 0 ≤ contractivity)
    (hContractivityLt : contractivity < 1)
    (i : ι) :
    data.constructiveThroughput schedule i ≤ ENNReal.ofReal (arrivalBound / (1 - contractivity)) := by
  exact data.constructiveThroughput_le_of_dominating_uniform_column_bound schedule
    (data.supremumTrafficData hSupSubstochastic)
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    arrivalBound
    contractivity
    hArrivalBoundNonneg
    hArrivalBound
    hSupColumnBound
    hContractivityNonneg
    hContractivityLt
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

theorem constructiveThroughput_finite_of_supremumRealPostfixed
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hPostfixed :
      ∀ i,
        (data.supremumTrafficData hSupSubstochastic).externalArrival i +
          ∑ j, candidate j * (data.supremumTrafficData hSupSubstochastic).routing j i ≤
        candidate i)
    (i : ι) :
    data.constructiveThroughput schedule i < ∞ := by
  exact lt_of_le_of_lt
    (data.constructiveThroughput_le_supremumRealPostfixed
      schedule hSupSubstochastic candidate hNonneg hPostfixed i)
    ENNReal.ofReal_lt_top

theorem constructiveThroughput_finite_of_supremumStrictRowSubstochasticSpectral
    [DecidableEq ι] [Nonempty ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (hSupContractive : ∀ i, ∑ j, data.supremumKernel i j < 1)
    (hNonneg : ∀ i, 0 ≤
      let dominant := data.supremumTrafficData hSupSubstochastic
      dominant.spectralThroughput
        (dominant.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hSupContractive) i)
    (i : ι) :
    data.constructiveThroughput schedule i < ∞ := by
  let dominant := data.supremumTrafficData hSupSubstochastic
  exact data.constructiveThroughput_finite_of_dominating_spectral schedule
    dominant
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    (dominant.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hSupContractive)
    hNonneg
    i

theorem constructiveThroughput_finite_of_supremumUniformColumnBound
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (arrivalBound contractivity : ℝ)
    (hArrivalBoundNonneg : 0 ≤ arrivalBound)
    (hArrivalBound : ∀ i, data.externalArrival i ≤ arrivalBound)
    (hSupColumnBound : ∀ i, ∑ j, data.supremumKernel j i ≤ contractivity)
    (hContractivityNonneg : 0 ≤ contractivity)
    (hContractivityLt : contractivity < 1)
    (i : ι) :
    data.constructiveThroughput schedule i < ∞ := by
  exact lt_of_le_of_lt
    (data.constructiveThroughput_le_supremumUniformColumnBound schedule
      hSupSubstochastic
      arrivalBound contractivity
      hArrivalBoundNonneg hArrivalBound hSupColumnBound
      hContractivityNonneg hContractivityLt i)
    ENNReal.ofReal_lt_top

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

theorem constructiveThroughput_stable_of_supremumRealPostfixed
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hPostfixed :
      ∀ i,
        (data.supremumTrafficData hSupSubstochastic).externalArrival i +
          ∑ j, candidate j * (data.supremumTrafficData hSupSubstochastic).routing j i ≤
        candidate i)
    (hStable : ∀ i, candidate i < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput schedule i).toReal < data.serviceRate i := by
  exact data.constructiveThroughput_stable_of_dominating_real_postfixed schedule
    (data.supremumTrafficData hSupSubstochastic)
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    candidate
    hNonneg
    hPostfixed
    hStable
    i

theorem constructiveThroughput_stable_of_supremumStrictRowSubstochasticSpectral
    [DecidableEq ι] [Nonempty ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (hSupContractive : ∀ i, ∑ j, data.supremumKernel i j < 1)
    (hNonneg : ∀ i, 0 ≤
      let dominant := data.supremumTrafficData hSupSubstochastic
      dominant.spectralThroughput
        (dominant.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hSupContractive) i)
    (hStable : ∀ i,
      let dominant := data.supremumTrafficData hSupSubstochastic
      dominant.spectralThroughput
        (dominant.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hSupContractive) i <
      data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput schedule i).toReal < data.serviceRate i := by
  let dominant := data.supremumTrafficData hSupSubstochastic
  exact data.constructiveThroughput_stable_of_dominating_spectral schedule
    dominant
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    (dominant.routingMatrix_spectralRadius_lt_one_of_strict_row_substochastic hSupContractive)
    hNonneg
    hStable
    i

theorem constructiveThroughput_stable_of_supremumUniformColumnBound
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (arrivalBound contractivity : ℝ)
    (hArrivalBoundNonneg : 0 ≤ arrivalBound)
    (hArrivalBound : ∀ i, data.externalArrival i ≤ arrivalBound)
    (hSupColumnBound : ∀ i, ∑ j, data.supremumKernel j i ≤ contractivity)
    (hContractivityNonneg : 0 ≤ contractivity)
    (hContractivityLt : contractivity < 1)
    (hServiceBound : ∀ i, arrivalBound / (1 - contractivity) < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput schedule i).toReal < data.serviceRate i := by
  exact data.constructiveThroughput_stable_of_dominating_uniform_column_bound schedule
    (data.supremumTrafficData hSupSubstochastic)
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    arrivalBound
    contractivity
    hArrivalBoundNonneg
    hArrivalBound
    hSupColumnBound
    hContractivityNonneg
    hContractivityLt
    hServiceBound
    i

theorem constructiveThroughput_le_of_supremumMaxIncomingRoutingMass_lt_one
    [Nonempty ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (hContractive : (data.supremumTrafficData hSupSubstochastic).maxIncomingRoutingMass < 1)
    (i : ι) :
    data.constructiveThroughput schedule i ≤
      ENNReal.ofReal (
        let dominant := data.supremumTrafficData hSupSubstochastic
        dominant.maxExternalArrival / (1 - dominant.maxIncomingRoutingMass)) := by
  let dominant := data.supremumTrafficData hSupSubstochastic
  exact data.constructiveThroughput_le_of_dominating_maxIncomingRoutingMass_lt_one schedule
    dominant
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    hContractive
    i

theorem constructiveThroughput_finite_of_supremumMaxIncomingRoutingMass_lt_one
    [Nonempty ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (hContractive : (data.supremumTrafficData hSupSubstochastic).maxIncomingRoutingMass < 1)
    (i : ι) :
    data.constructiveThroughput schedule i < ∞ := by
  exact lt_of_le_of_lt
    (data.constructiveThroughput_le_of_supremumMaxIncomingRoutingMass_lt_one
      schedule hSupSubstochastic hContractive i)
    ENNReal.ofReal_lt_top

theorem constructiveThroughput_stable_of_supremumMaxIncomingRoutingMass_lt_one
    [Nonempty ι]
    (data : AdaptiveJacksonTrafficData (ι := ι) (σ := σ))
    (schedule : ℕ → σ)
    (hSupSubstochastic : ∀ i, ∑ j, data.supremumKernel i j ≤ 1)
    (hContractive : (data.supremumTrafficData hSupSubstochastic).maxIncomingRoutingMass < 1)
    (hServiceBound : ∀ i,
      let dominant := data.supremumTrafficData hSupSubstochastic
      dominant.maxExternalArrival / (1 - dominant.maxIncomingRoutingMass) < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput schedule i).toReal < data.serviceRate i := by
  let dominant := data.supremumTrafficData hSupSubstochastic
  exact data.constructiveThroughput_stable_of_dominating_maxIncomingRoutingMass_lt_one schedule
    dominant
    (fun _ => le_rfl)
    (fun s i j => data.routing_le_supremumKernel s i j)
    hContractive
    hServiceBound
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

noncomputable def JacksonTrafficData.spectralNetworkMeasureOfConstructive
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hFinite : ∀ i, data.constructiveThroughput i < ∞)
    (hStable : ∀ i, (data.constructiveThroughput i).toReal < data.serviceRate i) :
    ProbabilityMeasure (ι → ℕ) :=
  jacksonNetworkMeasure (data.spectralNetworkDataOfConstructive hρ hFinite hStable)

noncomputable def JacksonTrafficData.spectralNetworkMeasureOfMaxIncomingRoutingMass
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound :
      ∀ i, data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) < data.serviceRate i) :
    ProbabilityMeasure (ι → ℕ) :=
  jacksonNetworkMeasure (data.spectralNetworkDataOfMaxIncomingRoutingMass hρ hContractive hServiceBound)

noncomputable def JacksonTrafficData.spectralNetworkMeasureOfMaxIncomingRoutingMassAuto
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound :
      ∀ i, data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) < data.serviceRate i) :
    ProbabilityMeasure (ι → ℕ) :=
  jacksonNetworkMeasure (data.spectralNetworkDataOfMaxIncomingRoutingMassAuto hContractive hServiceBound)

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

theorem JacksonTrafficData.spectral_network_mean_total_occupancy_of_constructive
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hFinite : ∀ i, data.constructiveThroughput i < ∞)
    (hStable : ∀ i, (data.constructiveThroughput i).toReal < data.serviceRate i) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂ (data.spectralNetworkMeasureOfConstructive hρ hFinite hStable).toMeasure =
      ∑ i, data.spectralThroughput hρ i /
        (data.serviceRate i - data.spectralThroughput hρ i) := by
  simpa [JacksonTrafficData.spectralNetworkMeasureOfConstructive,
    JacksonTrafficData.spectralNetworkDataOfConstructive] using
    jackson_network_mean_total_occupancy (data.spectralNetworkDataOfConstructive hρ hFinite hStable)

theorem JacksonTrafficData.spectral_network_mean_total_occupancy_of_maxIncomingRoutingMass
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound :
      ∀ i, data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) < data.serviceRate i) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂
        (data.spectralNetworkMeasureOfMaxIncomingRoutingMass hρ hContractive hServiceBound).toMeasure =
      ∑ i, data.spectralThroughput hρ i /
        (data.serviceRate i - data.spectralThroughput hρ i) := by
  simpa [JacksonTrafficData.spectralNetworkMeasureOfMaxIncomingRoutingMass,
    JacksonTrafficData.spectralNetworkDataOfMaxIncomingRoutingMass] using
    jackson_network_mean_total_occupancy
      (data.spectralNetworkDataOfMaxIncomingRoutingMass hρ hContractive hServiceBound)

theorem JacksonTrafficData.spectral_network_mean_total_occupancy_of_maxIncomingRoutingMassAuto
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound :
      ∀ i, data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) < data.serviceRate i) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂
        (data.spectralNetworkMeasureOfMaxIncomingRoutingMassAuto hContractive hServiceBound).toMeasure =
      ∑ i, data.spectralThroughput
          (data.routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one hContractive) i /
        (data.serviceRate i -
          data.spectralThroughput
            (data.routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one hContractive) i) := by
  simpa [JacksonTrafficData.spectralNetworkMeasureOfMaxIncomingRoutingMassAuto,
    JacksonTrafficData.spectralNetworkDataOfMaxIncomingRoutingMassAuto] using
    jackson_network_mean_total_occupancy
      (data.spectralNetworkDataOfMaxIncomingRoutingMassAuto hContractive hServiceBound)

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

theorem JacksonTrafficData.spectral_network_lintegral_balance_of_constructive
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hFinite : ∀ i, data.constructiveThroughput i < ∞)
    (hStable : ∀ i, (data.constructiveThroughput i).toReal < data.serviceRate i)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂
        (data.spectralNetworkMeasureOfConstructive hρ hFinite hStable).toMeasure =
      ∫⁻ state, law.sojournTime state ∂
          (data.spectralNetworkMeasureOfConstructive hρ hFinite hStable).toMeasure +
        ∫⁻ state, law.openAge state ∂
          (data.spectralNetworkMeasureOfConstructive hρ hFinite hStable).toMeasure := by
  simpa [JacksonTrafficData.spectralNetworkMeasureOfConstructive,
    JacksonTrafficData.spectralNetworkDataOfConstructive] using
    jackson_network_lintegral_balance (data.spectralNetworkDataOfConstructive hρ hFinite hStable) law

theorem JacksonTrafficData.spectral_network_lintegral_balance_of_maxIncomingRoutingMass
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound :
      ∀ i, data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) < data.serviceRate i)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂
        (data.spectralNetworkMeasureOfMaxIncomingRoutingMass hρ hContractive hServiceBound).toMeasure =
      ∫⁻ state, law.sojournTime state ∂
          (data.spectralNetworkMeasureOfMaxIncomingRoutingMass hρ hContractive hServiceBound).toMeasure +
        ∫⁻ state, law.openAge state ∂
          (data.spectralNetworkMeasureOfMaxIncomingRoutingMass hρ hContractive hServiceBound).toMeasure := by
  simpa [JacksonTrafficData.spectralNetworkMeasureOfMaxIncomingRoutingMass,
    JacksonTrafficData.spectralNetworkDataOfMaxIncomingRoutingMass] using
    jackson_network_lintegral_balance
      (data.spectralNetworkDataOfMaxIncomingRoutingMass hρ hContractive hServiceBound) law

theorem JacksonTrafficData.spectral_network_lintegral_balance_of_maxIncomingRoutingMassAuto
    [DecidableEq ι] [Nonempty ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound :
      ∀ i, data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) < data.serviceRate i)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂
        (data.spectralNetworkMeasureOfMaxIncomingRoutingMassAuto hContractive hServiceBound).toMeasure =
      ∫⁻ state, law.sojournTime state ∂
          (data.spectralNetworkMeasureOfMaxIncomingRoutingMassAuto hContractive hServiceBound).toMeasure +
        ∫⁻ state, law.openAge state ∂
          (data.spectralNetworkMeasureOfMaxIncomingRoutingMassAuto hContractive hServiceBound).toMeasure := by
  simpa [JacksonTrafficData.spectralNetworkMeasureOfMaxIncomingRoutingMassAuto,
    JacksonTrafficData.spectralNetworkDataOfMaxIncomingRoutingMassAuto] using
    jackson_network_lintegral_balance
      (data.spectralNetworkDataOfMaxIncomingRoutingMassAuto hContractive hServiceBound) law

end JacksonProduct

end ForkRaceFoldTheorems
