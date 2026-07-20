// Classifies a cm/360° value into one of 5 named "feel" zones for the
// result gauge on the "Minha Sensibilidade" screen. Thresholds are rough,
// commonly-cited cutoffs from the FPS aim-training community (mouse-
// sensitivity.com / r/FPSAimTrainer style guidance) — not a precise
// scientific boundary, just a reasonable, easy-to-recalibrate split.
//
// Recalibrating: this is the ONLY place these cutoffs (and colors) live —
// change the `maxCm`/`color` values below and every consumer (gauge
// segment, needle position, active-zone label, legend chip) follows
// automatically, since they all read `zone.color` from here rather than
// keeping their own parallel color list. Zones are ordered fastest-first
// (smallest cm/360) to slowest-last (largest cm/360); `maxCm: null` marks
// the open-ended last bucket.
export const ZONES = [
  { id: 'muito_rapida', color: 'red',         maxCm: 15 },
  { id: 'agil',         color: 'orange',      maxCm: 25 },
  { id: 'equilibrada',  color: 'brandCyan',   maxCm: 40 },
  { id: 'controlada',   color: 'brandPurple', maxCm: 60 },
  { id: 'muito_lenta',  color: 'grape',       maxCm: null },
]

export function zoneForCm(cm) {
  return ZONES.find((z) => z.maxCm == null || cm <= z.maxCm) || ZONES[ZONES.length - 1]
}

export function zoneIndex(cm) {
  return ZONES.indexOf(zoneForCm(cm))
}

// Gauge span (cm/360 values are clamped to this range for positioning) —
// log scale because cm/360 spans roughly 15-250cm and a linear scale would
// crush the fast end into an unreadably thin sliver.
export const GAUGE_MIN_CM = 10
export const GAUGE_MAX_CM = 260

// 0% = slowest end (GAUGE_MAX_CM) .. 100% = fastest end (GAUGE_MIN_CM) — the
// gauge/legend read left-to-right as slow-to-fast (see SensitivityGauge),
// so a *smaller* cm/360 (faster) must produce a *larger* percent (further
// right). This is the single position function every visual element (arc
// segment boundaries AND the needle) is computed from — that shared origin
// is what guarantees the needle always lands inside its own zone's segment.
export function gaugePercent(cm) {
  const clamped = Math.min(GAUGE_MAX_CM, Math.max(GAUGE_MIN_CM, cm))
  const pct = 100 - (Math.log(clamped / GAUGE_MIN_CM) / Math.log(GAUGE_MAX_CM / GAUGE_MIN_CM)) * 100
  return Math.min(100, Math.max(0, pct))
}

// -90° = far left (slowest) .. 0° = top .. +90° = far right (fastest).
export function angleForCm(cm) {
  return -90 + (gaugePercent(cm) / 100) * 180
}

// [minCm, maxCm) this zone covers, clamped to the gauge's visible span —
// derived from the *previous* zone's own cutoff, so ranges are always
// contiguous with no gaps/overlaps regardless of how ZONES is edited.
export function zoneCmRange(zone) {
  const idx = ZONES.indexOf(zone)
  const lower = idx <= 0 ? GAUGE_MIN_CM : ZONES[idx - 1].maxCm
  const upper = zone.maxCm == null ? GAUGE_MAX_CM : zone.maxCm
  return [lower, upper]
}

// The angle range (start=left, end=right) this zone's arc segment must
// occupy — computed through the exact same angleForCm() the needle uses,
// so the segment a zone draws and the angle its own cm values resolve to
// can never drift apart.
export function zoneAngleRange(zone) {
  const [lowerCm, upperCm] = zoneCmRange(zone)
  return [angleForCm(upperCm), angleForCm(lowerCm)]
}
