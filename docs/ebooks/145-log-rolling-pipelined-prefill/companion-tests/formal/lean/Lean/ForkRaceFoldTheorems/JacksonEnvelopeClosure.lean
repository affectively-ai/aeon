import ForkRaceFoldTheorems.JacksonRawClosure

open MeasureTheory

namespace ForkRaceFoldTheorems

section JacksonEnvelopeLadder

variable {ι : Type*} [Fintype ι] [Nonempty ι]

theorem JacksonTrafficData.throughputEnvelopeApprox_zero_eq_rawEnvelopeBound
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (i : ι) :
    data.throughputEnvelopeApprox hContractive 0 i = data.rawEnvelopeBound := by
  simp [JacksonTrafficData.throughputEnvelopeApprox, JacksonTrafficData.rawEnvelopeBound]

theorem JacksonTrafficData.throughputEnvelopeApprox_one_eq_localEnvelope
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (i : ι) :
    data.throughputEnvelopeApprox hContractive 1 i = data.localThroughputEnvelope i := by
  simpa using data.throughputEnvelopeApprox_one_eq_localThroughputEnvelope hContractive i

theorem JacksonTrafficData.throughputEnvelopeApprox_two_eq_secondOrderEnvelope
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (i : ι) :
    data.throughputEnvelopeApprox hContractive 2 i = data.secondOrderThroughputEnvelope i := by
  simpa using data.throughputEnvelopeApprox_two_eq_secondOrderThroughputEnvelope hContractive i

theorem JacksonTrafficData.envelope_ladder_descends
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (n : ℕ)
    (i : ι) :
    data.throughputEnvelopeApprox hContractive (n + 1) i ≤
      data.throughputEnvelopeApprox hContractive n i := by
  exact data.throughputEnvelopeApprox_succ_le hContractive n i

theorem JacksonTrafficData.trafficApprox_toReal_le_envelopeApprox
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (lowerStep upperStep : ℕ)
    (i : ι) :
    (data.trafficApprox lowerStep i).toReal ≤
      data.throughputEnvelopeApprox hContractive upperStep i := by
  exact data.trafficApprox_toReal_le_throughputEnvelopeApprox_of_maxIncomingRoutingMass_lt_one
    hContractive lowerStep upperStep i

noncomputable def JacksonTrafficData.constructiveNetworkDataOfLocalEnvelope
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound : ∀ i, data.localThroughputEnvelope i < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.constructiveNetworkDataOfLocalThroughputEnvelopeOfMaxIncomingRoutingMass
    hContractive
    hServiceBound

noncomputable def JacksonTrafficData.spectralNetworkDataOfLocalEnvelope
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound : ∀ i, data.localThroughputEnvelope i < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.spectralNetworkDataOfLocalThroughputEnvelopeOfMaxIncomingRoutingMassAuto
    hContractive
    hServiceBound

noncomputable def JacksonTrafficData.constructiveNetworkDataOfSecondOrderEnvelope
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound : ∀ i, data.secondOrderThroughputEnvelope i < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.constructiveNetworkDataOfSecondOrderThroughputEnvelopeOfMaxIncomingRoutingMass
    hContractive
    hServiceBound

noncomputable def JacksonTrafficData.spectralNetworkDataOfSecondOrderEnvelope
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound : ∀ i, data.secondOrderThroughputEnvelope i < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.spectralNetworkDataOfSecondOrderThroughputEnvelopeOfMaxIncomingRoutingMassAuto
    hContractive
    hServiceBound

noncomputable def JacksonTrafficData.constructiveNetworkDataOfEnvelopeApprox
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (n : ℕ)
    (hServiceBound : ∀ i, data.throughputEnvelopeApprox hContractive n i < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.constructiveNetworkDataOfThroughputEnvelopeApproxOfMaxIncomingRoutingMass
    hContractive
    n
    hServiceBound

noncomputable def JacksonTrafficData.spectralNetworkDataOfEnvelopeApprox
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (n : ℕ)
    (hServiceBound : ∀ i, data.throughputEnvelopeApprox hContractive n i < data.serviceRate i) :
    JacksonNetworkData (ι := ι) :=
  data.spectralNetworkDataOfThroughputEnvelopeApproxOfMaxIncomingRoutingMassAuto
    hContractive
    n
    hServiceBound

theorem JacksonTrafficData.local_jackson_product_mean_total_occupancy
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound : ∀ i, data.localThroughputEnvelope i < data.serviceRate i) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂
        (jacksonNetworkMeasure (data.spectralNetworkDataOfLocalEnvelope hContractive hServiceBound)).toMeasure =
      ∑ i, data.spectralThroughput
          (data.routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one hContractive) i /
        (data.serviceRate i -
          data.spectralThroughput
            (data.routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one hContractive) i) := by
  simpa [JacksonTrafficData.spectralNetworkDataOfLocalEnvelope] using
    jackson_network_mean_total_occupancy
      (data.spectralNetworkDataOfLocalThroughputEnvelopeOfMaxIncomingRoutingMassAuto
        hContractive hServiceBound)

theorem JacksonTrafficData.second_order_jackson_product_mean_total_occupancy
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound : ∀ i, data.secondOrderThroughputEnvelope i < data.serviceRate i) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂
        (jacksonNetworkMeasure
          (data.spectralNetworkDataOfSecondOrderEnvelope hContractive hServiceBound)).toMeasure =
      ∑ i, data.spectralThroughput
          (data.routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one hContractive) i /
        (data.serviceRate i -
          data.spectralThroughput
            (data.routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one hContractive) i) := by
  simpa [JacksonTrafficData.spectralNetworkDataOfSecondOrderEnvelope] using
    jackson_network_mean_total_occupancy
      (data.spectralNetworkDataOfSecondOrderThroughputEnvelopeOfMaxIncomingRoutingMassAuto
        hContractive hServiceBound)

theorem JacksonTrafficData.nth_envelope_jackson_product_mean_total_occupancy
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (n : ℕ)
    (hServiceBound : ∀ i, data.throughputEnvelopeApprox hContractive n i < data.serviceRate i) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂
        (jacksonNetworkMeasure (data.spectralNetworkDataOfEnvelopeApprox hContractive n hServiceBound)).toMeasure =
      ∑ i, data.spectralThroughput
          (data.routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one hContractive) i /
        (data.serviceRate i -
          data.spectralThroughput
            (data.routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one hContractive) i) := by
  simpa [JacksonTrafficData.spectralNetworkDataOfEnvelopeApprox] using
    jackson_network_mean_total_occupancy
      (data.spectralNetworkDataOfThroughputEnvelopeApproxOfMaxIncomingRoutingMassAuto
        hContractive n hServiceBound)

theorem JacksonTrafficData.local_jackson_lintegral_balance
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound : ∀ i, data.localThroughputEnvelope i < data.serviceRate i)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂
        (jacksonNetworkMeasure (data.spectralNetworkDataOfLocalEnvelope hContractive hServiceBound)).toMeasure =
      ∫⁻ state, law.sojournTime state ∂
          (jacksonNetworkMeasure (data.spectralNetworkDataOfLocalEnvelope hContractive hServiceBound)).toMeasure +
        ∫⁻ state, law.openAge state ∂
          (jacksonNetworkMeasure (data.spectralNetworkDataOfLocalEnvelope hContractive hServiceBound)).toMeasure := by
  simpa [JacksonTrafficData.spectralNetworkDataOfLocalEnvelope] using
    jackson_network_lintegral_balance
      (data.spectralNetworkDataOfLocalThroughputEnvelopeOfMaxIncomingRoutingMassAuto
        hContractive hServiceBound)
      law

theorem JacksonTrafficData.second_order_jackson_lintegral_balance
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hServiceBound : ∀ i, data.secondOrderThroughputEnvelope i < data.serviceRate i)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂
        (jacksonNetworkMeasure
          (data.spectralNetworkDataOfSecondOrderEnvelope hContractive hServiceBound)).toMeasure =
      ∫⁻ state, law.sojournTime state ∂
          (jacksonNetworkMeasure
            (data.spectralNetworkDataOfSecondOrderEnvelope hContractive hServiceBound)).toMeasure +
        ∫⁻ state, law.openAge state ∂
          (jacksonNetworkMeasure
            (data.spectralNetworkDataOfSecondOrderEnvelope hContractive hServiceBound)).toMeasure := by
  simpa [JacksonTrafficData.spectralNetworkDataOfSecondOrderEnvelope] using
    jackson_network_lintegral_balance
      (data.spectralNetworkDataOfSecondOrderThroughputEnvelopeOfMaxIncomingRoutingMassAuto
        hContractive hServiceBound)
      law

theorem JacksonTrafficData.nth_envelope_jackson_lintegral_balance
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (n : ℕ)
    (hServiceBound : ∀ i, data.throughputEnvelopeApprox hContractive n i < data.serviceRate i)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂
        (jacksonNetworkMeasure (data.spectralNetworkDataOfEnvelopeApprox hContractive n hServiceBound)).toMeasure =
      ∫⁻ state, law.sojournTime state ∂
          (jacksonNetworkMeasure
            (data.spectralNetworkDataOfEnvelopeApprox hContractive n hServiceBound)).toMeasure +
        ∫⁻ state, law.openAge state ∂
          (jacksonNetworkMeasure
            (data.spectralNetworkDataOfEnvelopeApprox hContractive n hServiceBound)).toMeasure := by
  simpa [JacksonTrafficData.spectralNetworkDataOfEnvelopeApprox] using
    jackson_network_lintegral_balance
      (data.spectralNetworkDataOfThroughputEnvelopeApproxOfMaxIncomingRoutingMassAuto
        hContractive n hServiceBound)
      law

end JacksonEnvelopeLadder

end ForkRaceFoldTheorems
