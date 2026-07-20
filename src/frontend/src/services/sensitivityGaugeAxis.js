// Gauge ARC coordinate system for "Minha Sensibilidade" (v2.2.0+).
//
// The arc's domain is the literal GTA V sens slider, -100 (far left) ..
// 0 (top) .. +100 (far right), LINEAR and symmetric — it is NOT proportional
// to cm/360 anymore. The old cm-proportional arc made segments wildly
// disproportionate (the open-ended "slow" zone dwarfed the others) and left
// the needle far from the tip even at the slider's extreme (+100).
//
// The needle sits at whatever sens is currently configured — no DPI
// involved (angleForSens is a pure function of sens). Zone SEGMENTS,
// however, are DPI-dependent: a zone is defined by cm/360 thresholds
// (sensitivityZones.js, unchanged), and the sens value that produces a given
// cm/360 depends on DPI. So segment boundaries are recomputed live from
// sensForCm() (the inverse of sensitivityMath.js's calcLocal) every time DPI
// changes, then clipped to the -100..100 domain. A zone whose entire cm/360
// range falls outside what's reachable at the current DPI simply isn't
// drawn — an honest gauge, not one stretched to always show every zone.
import { sensForCm } from './sensitivityMath.js'
import { zoneCmRange } from './sensitivityZones.js'

export const AXIS_MIN = -100
export const AXIS_MAX = 100

// -90° = far left (sens -100) .. 0° = top (sens 0) .. +90° = far right (sens +100).
export function angleForSens(sens) {
  const clamped = Math.min(AXIS_MAX, Math.max(AXIS_MIN, sens))
  return -90 + ((clamped - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * 180
}

// Converts a zone's cm/360 boundaries (sensitivityZones.js) into sens values
// at the given DPI — the inverse of calcLocal()/sensForCm — then clips to
// the visible -100..100 domain. Returns null when the whole zone falls
// outside that domain at this DPI (e.g. a high enough DPI can make "Muito
// lenta" unreachable at any legal sens value).
export function zoneSensRangeForDpi(zone, dpi) {
  const [lowerCm, upperCm] = zoneCmRange(zone)
  // cm/360 strictly decreases as sens increases, so the zone's *larger* cm
  // bound maps to the *lower* sens bound, and vice versa.
  const lower = Math.max(AXIS_MIN, sensForCm(upperCm, dpi))
  const upper = Math.min(AXIS_MAX, sensForCm(lowerCm, dpi))
  if (lower >= upper) return null
  return [lower, upper]
}

// The angle range (start=left, end=right) this zone's arc segment occupies
// at the given DPI — computed through the exact same angleForSens() the
// needle uses, so a segment and the sens values it represents can never
// drift apart. Null propagates from zoneSensRangeForDpi (zone not drawn).
export function zoneAngleRangeForDpi(zone, dpi) {
  const range = zoneSensRangeForDpi(zone, dpi)
  if (!range) return null
  const [lowerSens, upperSens] = range
  return [angleForSens(lowerSens), angleForSens(upperSens)]
}
