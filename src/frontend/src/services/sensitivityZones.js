// Classifies a cm/360° value into one of 5 named "feel" zones for the
// result panel on the "Minha Sensibilidade" screen. Thresholds are rough,
// commonly-cited cutoffs from the FPS aim-training community (mouse-
// sensitivity.com / r/FPSAimTrainer style guidance) — not a precise
// scientific boundary, just a reasonable, easy-to-recalibrate split.
//
// Recalibrating: this is the ONLY place these cutoffs (and colors) live —
// change the `maxCm`/`color` values below and every consumer (active-zone
// label, zone chip strip) follows automatically, since they all read
// `zone.color` from here rather than keeping their own parallel color
// list. Zones are ordered fastest-first (smallest cm/360) to slowest-last
// (largest cm/360); `maxCm: null` marks the open-ended last bucket.
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

// [minCm, maxCm) this zone covers, in true (unclamped) cm/360 terms — 0 and
// Infinity at the open ends.
export function zoneCmRange(zone) {
  const idx = ZONES.indexOf(zone)
  const lower = idx <= 0 ? 0 : ZONES[idx - 1].maxCm
  const upper = zone.maxCm == null ? Infinity : zone.maxCm
  return [lower, upper]
}
