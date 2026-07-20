// Classifies a cm/360° value into one of 5 named "feel" zones for the
// result gauge on the "Minha Sensibilidade" screen. Thresholds are rough,
// commonly-cited cutoffs from the FPS aim-training community (mouse-
// sensitivity.com / r/FPSAimTrainer style guidance) — not a precise
// scientific boundary, just a reasonable, easy-to-recalibrate split.
//
// Recalibrating: this is the ONLY place these cutoffs live — change the
// `maxCm` values below and every consumer (gauge position, active-zone
// highlight, summary copy) follows automatically. Zones are ordered
// slowest-first (largest cm/360) to fastest-last (smallest cm/360);
// `maxCm: null` marks the open-ended last bucket.
export const ZONES = [
  { id: 'muito_rapida', color: 'red',       maxCm: 15 },
  { id: 'agil',         color: 'orange',    maxCm: 25 },
  { id: 'equilibrada',  color: 'brandCyan', maxCm: 40 },
  { id: 'controlada',   color: 'brandPurple', maxCm: 60 },
  { id: 'muito_lenta',  color: 'grape',     maxCm: null },
]

export function zoneForCm(cm) {
  return ZONES.find((z) => z.maxCm == null || cm <= z.maxCm) || ZONES[ZONES.length - 1]
}

export function zoneIndex(cm) {
  return ZONES.indexOf(zoneForCm(cm))
}

// Gauge fill position (0-100) — log scale because cm/360 spans roughly
// 15-250cm and a linear scale would crush the fast end into an unreadably
// thin sliver. Clamped so extreme inputs still land on the visible track.
const GAUGE_MIN_CM = 10
const GAUGE_MAX_CM = 260

export function gaugePercent(cm) {
  const clamped = Math.min(GAUGE_MAX_CM, Math.max(GAUGE_MIN_CM, cm))
  const pct = (Math.log(clamped / GAUGE_MIN_CM) / Math.log(GAUGE_MAX_CM / GAUGE_MIN_CM)) * 100
  return Math.min(100, Math.max(0, pct))
}
