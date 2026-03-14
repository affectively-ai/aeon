import ForkRaceFoldTheorems.JacksonQueueing

open Filter MeasureTheory
open scoped BigOperators ENNReal

namespace ForkRaceFoldTheorems

namespace JacksonTrafficData

variable {ι : Type*} [Fintype ι]

theorem exact_real_fixed_point_unique
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (candidate : ι → ℝ)
    (hFixed :
      ∀ i,
        candidate i =
          data.externalArrival i + ∑ j, candidate j * data.routing j i) :
    candidate = data.spectralThroughput hρ :=
  data.real_fixed_point_eq_spectralThroughput hρ candidate hFixed

theorem constructiveThroughput_finite_of_real_fixed_point
    (data : JacksonTrafficData (ι := ι))
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hFixed :
      ∀ i,
        candidate i =
          data.externalArrival i + ∑ j, candidate j * data.routing j i)
    (i : ι) :
    data.constructiveThroughput i < ∞ := by
  exact lt_of_le_of_lt
    (data.constructiveThroughput_le_of_real_fixed_point candidate hNonneg hFixed i)
    ENNReal.ofReal_lt_top

theorem constructiveThroughput_stable_of_real_fixed_point
    (data : JacksonTrafficData (ι := ι))
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hFixed :
      ∀ i,
        candidate i =
          data.externalArrival i + ∑ j, candidate j * data.routing j i)
    (hStable : ∀ i, candidate i < data.serviceRate i)
    (i : ι) :
    (data.constructiveThroughput i).toReal < data.serviceRate i := by
  have hLe :
      data.constructiveThroughput i ≤ ENNReal.ofReal (candidate i) :=
    data.constructiveThroughput_le_of_real_fixed_point candidate hNonneg hFixed i
  have hToRealLe :
      (data.constructiveThroughput i).toReal ≤ candidate i :=
    ENNReal.toReal_le_of_le_ofReal (hNonneg i) hLe
  exact lt_of_le_of_lt hToRealLe (hStable i)

theorem constructiveThroughput_toReal_eq_real_fixed_point
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hFixed :
      ∀ i,
        candidate i =
          data.externalArrival i + ∑ j, candidate j * data.routing j i) :
    ∀ i, (data.constructiveThroughput i).toReal = candidate i := by
  have hFinite :
      ∀ i, data.constructiveThroughput i < ∞ :=
    data.constructiveThroughput_finite_of_real_fixed_point candidate hNonneg hFixed
  have hConstructiveEqSpectral :
      (fun i => (data.constructiveThroughput i).toReal) = data.spectralThroughput hρ := by
    funext i
    exact data.constructiveThroughput_toReal_eq_spectralThroughput hρ hFinite i
  have hCandidateEqSpectral :
      candidate = data.spectralThroughput hρ :=
    data.exact_real_fixed_point_unique hρ candidate hFixed
  intro i
  calc
    (data.constructiveThroughput i).toReal = data.spectralThroughput hρ i := by
      exact congrFun hConstructiveEqSpectral i
    _ = candidate i := by
      rw [← hCandidateEqSpectral]

noncomputable def constructiveNetworkDataOfRealFixedPoint
    (data : JacksonTrafficData (ι := ι))
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hFixed :
      ∀ i,
        candidate i =
          data.externalArrival i + ∑ j, candidate j * data.routing j i)
    (hStable : ∀ i, candidate i < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.constructiveNetworkData
    (data.constructiveThroughput_finite_of_real_fixed_point candidate hNonneg hFixed)
    (data.constructiveThroughput_stable_of_real_fixed_point candidate hNonneg hFixed hStable)

noncomputable def constructiveNetworkMeasureOfRealFixedPoint
    (data : JacksonTrafficData (ι := ι))
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hFixed :
      ∀ i,
        candidate i =
          data.externalArrival i + ∑ j, candidate j * data.routing j i)
    (hStable : ∀ i, candidate i < data.serviceRate i) :
    ProbabilityMeasure (ι → ℕ) :=
  jacksonNetworkMeasure
    (data.constructiveNetworkDataOfRealFixedPoint candidate hNonneg hFixed hStable)

theorem constructive_network_lintegral_balance_of_real_fixed_point
    (data : JacksonTrafficData (ι := ι))
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hFixed :
      ∀ i,
        candidate i =
          data.externalArrival i + ∑ j, candidate j * data.routing j i)
    (hStable : ∀ i, candidate i < data.serviceRate i)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂
        (data.constructiveNetworkMeasureOfRealFixedPoint
          candidate
          hNonneg
          hFixed
          hStable).toMeasure =
      ∫⁻ state, law.sojournTime state ∂
          (data.constructiveNetworkMeasureOfRealFixedPoint
            candidate
            hNonneg
            hFixed
            hStable).toMeasure +
        ∫⁻ state, law.openAge state ∂
          (data.constructiveNetworkMeasureOfRealFixedPoint
            candidate
            hNonneg
            hFixed
            hStable).toMeasure := by
  simpa
    [JacksonTrafficData.constructiveNetworkMeasureOfRealFixedPoint,
      JacksonTrafficData.constructiveNetworkDataOfRealFixedPoint] using
    jackson_network_lintegral_balance
      (data.constructiveNetworkDataOfRealFixedPoint candidate hNonneg hFixed hStable)
      law

theorem constructive_network_mean_total_occupancy_of_real_fixed_point
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (candidate : ι → ℝ)
    (hNonneg : ∀ i, 0 ≤ candidate i)
    (hFixed :
      ∀ i,
        candidate i =
          data.externalArrival i + ∑ j, candidate j * data.routing j i)
    (hStable : ∀ i, candidate i < data.serviceRate i) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂
        (data.constructiveNetworkMeasureOfRealFixedPoint
          candidate
          hNonneg
          hFixed
          hStable).toMeasure =
      ∑ i, candidate i / (data.serviceRate i - candidate i) := by
  calc
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂
        (data.constructiveNetworkMeasureOfRealFixedPoint
          candidate
          hNonneg
          hFixed
          hStable).toMeasure
      = ∑ i, (data.constructiveThroughput i).toReal /
          (data.serviceRate i - (data.constructiveThroughput i).toReal) := by
          simpa
            [JacksonTrafficData.constructiveNetworkMeasureOfRealFixedPoint,
              JacksonTrafficData.constructiveNetworkDataOfRealFixedPoint] using
            jackson_network_mean_total_occupancy
              (data.constructiveNetworkDataOfRealFixedPoint candidate hNonneg hFixed hStable)
    _ = ∑ i, candidate i / (data.serviceRate i - candidate i) := by
          apply Finset.sum_congr rfl
          intro i hi
          rw [data.constructiveThroughput_toReal_eq_real_fixed_point hρ candidate hNonneg hFixed i]

noncomputable def constructiveNetworkDataOfExactSpectral
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (hStable : ∀ i, data.spectralThroughput hρ i < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.constructiveNetworkDataOfRealFixedPoint
    (data.spectralThroughput hρ)
    hNonneg
    (data.spectralThroughput_fixed_point hρ)
    hStable

noncomputable def constructiveNetworkMeasureOfExactSpectral
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (hStable : ∀ i, data.spectralThroughput hρ i < data.serviceRate i) :
    ProbabilityMeasure (ι → ℕ) :=
  jacksonNetworkMeasure
    (data.constructiveNetworkDataOfExactSpectral hρ hNonneg hStable)

theorem constructive_network_lintegral_balance_of_exact_spectral
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (hStable : ∀ i, data.spectralThroughput hρ i < data.serviceRate i)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂
        (data.constructiveNetworkMeasureOfExactSpectral hρ hNonneg hStable).toMeasure =
      ∫⁻ state, law.sojournTime state ∂
          (data.constructiveNetworkMeasureOfExactSpectral hρ hNonneg hStable).toMeasure +
        ∫⁻ state, law.openAge state ∂
          (data.constructiveNetworkMeasureOfExactSpectral hρ hNonneg hStable).toMeasure := by
  simpa
    [JacksonTrafficData.constructiveNetworkMeasureOfExactSpectral,
      JacksonTrafficData.constructiveNetworkDataOfExactSpectral] using
    data.constructive_network_lintegral_balance_of_real_fixed_point
      (candidate := data.spectralThroughput hρ)
      hNonneg
      (data.spectralThroughput_fixed_point hρ)
      hStable
      law

theorem constructive_network_mean_total_occupancy_of_exact_spectral
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hρ : spectralRadius ℝ data.routingMatrix < 1)
    (hNonneg : ∀ i, 0 ≤ data.spectralThroughput hρ i)
    (hStable : ∀ i, data.spectralThroughput hρ i < data.serviceRate i) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂
        (data.constructiveNetworkMeasureOfExactSpectral hρ hNonneg hStable).toMeasure =
      ∑ i, data.spectralThroughput hρ i /
        (data.serviceRate i - data.spectralThroughput hρ i) := by
  simpa
    [JacksonTrafficData.constructiveNetworkMeasureOfExactSpectral,
      JacksonTrafficData.constructiveNetworkDataOfExactSpectral] using
    data.constructive_network_mean_total_occupancy_of_real_fixed_point
      hρ
      (candidate := data.spectralThroughput hρ)
      hNonneg
      (data.spectralThroughput_fixed_point hρ)
      hStable

end JacksonTrafficData

end ForkRaceFoldTheorems
