// Combines the aggregated flick + tracking metrics from a completed
// sensitivity-discovery test into one of three verdicts (increase/
// decrease/keep), or "inconclusive" when the sample is too small to trust.
//
// Sign convention used throughout: a positive score/bias means "too fast"
// (overshoot) -> suggests DECREASING sens; negative means "too slow"
// (undershoot) -> suggests INCREASING it. Flick carries more weight than
// tracking per the spec ("peso maior"); tracking degrades to neutral when a
// caller doesn't supply it (e.g. a flick-only synthetic test), which is a
// deliberate, tested behavior — not a gap.
import { clamp, median } from './mathUtils.js'
import { zoneForCm } from '../../services/sensitivityZones.js'
import { calcLocal } from '../../services/sensitivityMath.js'

export const MIN_VALID_FLICKS = 15
export const RATIO_OVERSHOOT = 1.05
export const RATIO_UNDERSHOOT = 0.95
export const MAX_STEP = 15

const FLICK_WEIGHT = 0.65
const TRACKING_WEIGHT = 0.35
const FLICK_SCORE_SPAN = 0.30    // |ratio - 1| that saturates the flick score to +-1
const OSCILLATION_NEUTRAL_HZ = 2 // crossings/sec considered "normal" — above this reads as overshoot
const OSCILLATION_SPAN_HZ = 3
const LAG_SPAN_DEG = 6
// Generous dead zone around neutral so test-to-test noise never flips the
// verdict — roughly corresponds to the flick ratio alone sitting within
// [0.95, 1.05], the same bounds used per-shot for the overshoot/undershoot rate.
const DEAD_ZONE = 0.12

export const VERDICT = {
  INCREASE: 'aumentar',
  DECREASE: 'diminuir',
  KEEP: 'manter',
  INCONCLUSIVE: 'inconclusivo',
}

export function computeVerdict({
  flickRatios,
  correctionTimesMs = [],
  trackingOscillationsHz = [],
  trackingLagBiasDeg = [],
  currentSens,
  dpi,
}) {
  const sampleSize = flickRatios ? flickRatios.length : 0
  if (sampleSize < MIN_VALID_FLICKS) {
    return { verdict: VERDICT.INCONCLUSIVE, sampleSize }
  }

  const medianRatio = median(flickRatios)
  const medianCorrectionMs = correctionTimesMs.length ? median(correctionTimesMs) : null
  const overshootRatePct = (flickRatios.filter((r) => r > RATIO_OVERSHOOT).length / sampleSize) * 100
  const undershootRatePct = (flickRatios.filter((r) => r < RATIO_UNDERSHOOT).length / sampleSize) * 100

  const flickScore = clamp((medianRatio - 1) / FLICK_SCORE_SPAN, -1, 1)

  const medianOscillation = trackingOscillationsHz.length ? median(trackingOscillationsHz) : OSCILLATION_NEUTRAL_HZ
  const medianLagBias = trackingLagBiasDeg.length ? median(trackingLagBiasDeg) : 0
  const oscillationScore = clamp((medianOscillation - OSCILLATION_NEUTRAL_HZ) / OSCILLATION_SPAN_HZ, -1, 1)
  const lagScore = clamp(medianLagBias / LAG_SPAN_DEG, -1, 1)
  const trackingScore = clamp(oscillationScore - lagScore, -1, 1)

  const combined = FLICK_WEIGHT * flickScore + TRACKING_WEIGHT * trackingScore

  const base = {
    sampleSize,
    medianRatio,
    medianCorrectionMs,
    overshootRatePct: +overshootRatePct.toFixed(1),
    undershootRatePct: +undershootRatePct.toFixed(1),
  }

  if (Math.abs(combined) < DEAD_ZONE) {
    return { ...base, verdict: VERDICT.KEEP }
  }

  const direction = combined > 0 ? -1 : 1 // combined>0 = overshoot tendency -> decrease
  const step = Math.min(MAX_STEP, Math.round(Math.abs(combined) * MAX_STEP))
  const suggestedSens = clamp(currentSens + direction * step, -100, 100)

  const currentZone = zoneForCm(calcLocal(currentSens, dpi).cm_per_360)
  const suggestedZone = zoneForCm(calcLocal(suggestedSens, dpi).cm_per_360)

  return {
    ...base,
    verdict: direction > 0 ? VERDICT.INCREASE : VERDICT.DECREASE,
    currentSens,
    suggestedSens,
    step: Math.abs(suggestedSens - currentSens),
    currentZoneId: currentZone.id,
    suggestedZoneId: suggestedZone.id,
  }
}
