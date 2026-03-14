import ForkRaceFoldTheorems.JacksonExactClosure
import ForkRaceFoldTheorems.StateDependentQueueFamilies

open Filter MeasureTheory
open scoped BigOperators ENNReal Matrix

namespace ForkRaceFoldTheorems

namespace TwoNodeAdaptiveRoutingParameters

variable (params : TwoNodeAdaptiveRoutingParameters)

theorem ceilingRoutingMatrix_sq_eq_zero :
    params.ceilingTrafficData.routingMatrix ^ 2 = 0 := by
  ext i j
  fin_cases i <;> fin_cases j <;>
    simp [pow_two, Matrix.mul_apply, ceilingTrafficData, ceilingRouting, Fintype.univ_bool]

theorem ceiling_spectralRadius_eq_zero :
    spectralRadius ℝ params.ceilingTrafficData.routingMatrix = 0 := by
  have hPower : (2 : Nat) ≠ 0 := by decide
  have hle :
      spectralRadius ℝ params.ceilingTrafficData.routingMatrix ^ 2 ≤
        spectralRadius ℝ (params.ceilingTrafficData.routingMatrix ^ 2) :=
    spectrum.spectralRadius_pow_le (𝕜 := ℝ) params.ceilingTrafficData.routingMatrix 2 hPower
  have hPowZero :
      spectralRadius ℝ params.ceilingTrafficData.routingMatrix ^ 2 = 0 := by
    refine le_antisymm ?_ bot_le
    simpa [params.ceilingRoutingMatrix_sq_eq_zero] using hle
  by_cases hRadius : spectralRadius ℝ params.ceilingTrafficData.routingMatrix = 0
  · exact hRadius
  · exfalso
    exact (pow_ne_zero 2 hRadius) hPowZero

theorem candidate_eq_constructiveThroughput_toReal :
    ∀ i, (params.ceilingTrafficData.constructiveThroughput i).toReal = params.candidate i := by
  intro i
  exact params.ceilingTrafficData.constructiveThroughput_toReal_eq_real_fixed_point
    params.ceiling_spectralRadius_lt_one
    params.candidate
    params.candidate_nonneg
    params.candidate_fixed_point
    i

noncomputable def ceilingConstructiveNetworkData : JacksonNetworkData (ι := Bool) :=
  params.ceilingTrafficData.constructiveNetworkDataOfRealFixedPoint
    params.candidate
    params.candidate_nonneg
    params.candidate_fixed_point
    params.candidate_stable

noncomputable def ceilingConstructiveNetworkMeasure : ProbabilityMeasure (Bool → ℕ) :=
  jacksonNetworkMeasure params.ceilingConstructiveNetworkData

theorem ceiling_constructive_network_lintegral_balance
    (law : MeasureQueueLaw (Bool → ℕ)) :
    ∫⁻ state, law.customerTime state ∂ params.ceilingConstructiveNetworkMeasure.toMeasure =
      ∫⁻ state, law.sojournTime state ∂ params.ceilingConstructiveNetworkMeasure.toMeasure +
        ∫⁻ state, law.openAge state ∂ params.ceilingConstructiveNetworkMeasure.toMeasure := by
  simpa [ceilingConstructiveNetworkMeasure, ceilingConstructiveNetworkData] using
    params.ceilingTrafficData.constructive_network_lintegral_balance_of_real_fixed_point
      (candidate := params.candidate)
      params.candidate_nonneg
      params.candidate_fixed_point
      params.candidate_stable
      law

theorem ceiling_constructive_network_mean_total_occupancy :
    ∫ state : Bool → ℕ, ∑ i, (state i : ℝ) ∂ params.ceilingConstructiveNetworkMeasure.toMeasure =
      params.arrivalLeft / (params.serviceLeft - params.arrivalLeft) +
        (params.arrivalRight + params.arrivalLeft * params.rerouteProb) /
          (params.serviceRight - (params.arrivalRight + params.arrivalLeft * params.rerouteProb)) := by
  simpa [ceilingConstructiveNetworkMeasure, ceilingConstructiveNetworkData, candidate, service,
    arrival, Fintype.univ_bool, add_comm, add_left_comm, add_assoc] using
    params.ceilingTrafficData.constructive_network_mean_total_occupancy_of_real_fixed_point
      params.ceiling_spectralRadius_lt_one
      (candidate := params.candidate)
      params.candidate_nonneg
      params.candidate_fixed_point
      params.candidate_stable

end TwoNodeAdaptiveRoutingParameters

end ForkRaceFoldTheorems
