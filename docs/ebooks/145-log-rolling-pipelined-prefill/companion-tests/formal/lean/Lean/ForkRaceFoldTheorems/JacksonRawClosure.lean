import ForkRaceFoldTheorems.JacksonQueueing

open MeasureTheory

namespace ForkRaceFoldTheorems

section JacksonProduct

variable {ι : Type*} [Fintype ι] [Nonempty ι]

noncomputable def JacksonTrafficData.rawEnvelopeBound
    (data : JacksonTrafficData (ι := ι)) : ℝ :=
  data.maxExternalArrival / (1 - data.maxIncomingRoutingMass)

theorem JacksonTrafficData.rawEnvelopeBound_nonneg
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1) :
    0 ≤ data.rawEnvelopeBound := by
  unfold JacksonTrafficData.rawEnvelopeBound
  have hDenPos : 0 < 1 - data.maxIncomingRoutingMass := sub_pos.mpr hContractive
  exact div_nonneg data.maxExternalArrival_nonneg hDenPos.le

theorem JacksonTrafficData.rawEnvelopeBound_lt_serviceRate
    (data : JacksonTrafficData (ι := ι))
    (hMinService : data.rawEnvelopeBound < data.minServiceRate) :
    ∀ i, data.rawEnvelopeBound < data.serviceRate i := by
  have hMinService' :
      data.maxExternalArrival / (1 - data.maxIncomingRoutingMass) < data.minServiceRate := by
    simpa [JacksonTrafficData.rawEnvelopeBound] using hMinService
  simpa [JacksonTrafficData.rawEnvelopeBound] using
    data.serviceBound_of_maxIncomingRoutingMass_lt_minServiceRate hMinService'

noncomputable def JacksonTrafficData.constructiveNetworkDataOfRawEnvelope
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hMinService : data.rawEnvelopeBound < data.minServiceRate) :
    JacksonNetworkData (ι := ι) :=
  data.constructiveNetworkDataOfMaxIncomingRoutingMassMinService hContractive (by
    simpa [JacksonTrafficData.rawEnvelopeBound] using hMinService)

noncomputable def JacksonTrafficData.spectralNetworkDataOfRawEnvelope
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hMinService : data.rawEnvelopeBound < data.minServiceRate) :
    JacksonNetworkData (ι := ι) :=
  data.spectralNetworkDataOfMaxIncomingRoutingMassMinServiceAuto hContractive (by
    simpa [JacksonTrafficData.rawEnvelopeBound] using hMinService)

theorem JacksonTrafficData.raw_jackson_product_mean_total_occupancy
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hMinService : data.rawEnvelopeBound < data.minServiceRate) :
    ∫ state : ι → ℕ, ∑ i, (state i : ℝ) ∂
        (jacksonNetworkMeasure (data.spectralNetworkDataOfRawEnvelope hContractive hMinService)).toMeasure =
      ∑ i, data.spectralThroughput
          (data.routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one hContractive) i /
        (data.serviceRate i -
          data.spectralThroughput
            (data.routingMatrix_spectralRadius_lt_one_of_maxIncomingRoutingMass_lt_one hContractive) i) := by
  simpa [JacksonTrafficData.spectralNetworkDataOfRawEnvelope] using
    data.spectral_network_mean_total_occupancy_of_maxIncomingRoutingMassMinServiceAuto
      hContractive
      (by simpa [JacksonTrafficData.rawEnvelopeBound] using hMinService)

theorem JacksonTrafficData.raw_jackson_lintegral_balance
    [DecidableEq ι]
    (data : JacksonTrafficData (ι := ι))
    (hContractive : data.maxIncomingRoutingMass < 1)
    (hMinService : data.rawEnvelopeBound < data.minServiceRate)
    (law : MeasureQueueLaw (ι → ℕ)) :
    ∫⁻ state, law.customerTime state ∂
        (jacksonNetworkMeasure (data.spectralNetworkDataOfRawEnvelope hContractive hMinService)).toMeasure =
      ∫⁻ state, law.sojournTime state ∂
          (jacksonNetworkMeasure (data.spectralNetworkDataOfRawEnvelope hContractive hMinService)).toMeasure +
        ∫⁻ state, law.openAge state ∂
          (jacksonNetworkMeasure (data.spectralNetworkDataOfRawEnvelope hContractive hMinService)).toMeasure := by
  simpa [JacksonTrafficData.spectralNetworkDataOfRawEnvelope] using
    data.spectral_network_lintegral_balance_of_maxIncomingRoutingMassMinServiceAuto
      hContractive
      (by simpa [JacksonTrafficData.rawEnvelopeBound] using hMinService)
      law

end JacksonProduct

end ForkRaceFoldTheorems
