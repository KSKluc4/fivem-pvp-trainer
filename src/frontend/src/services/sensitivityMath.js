// Shared GTA V → aim-trainer sensitivity math — single source of truth so the
// in-app 3D trainer and the "Minha Sensibilidade" screen (and the backend,
// api/routes/sensitivity.py, kept in sync manually since it's Python) all
// agree on the same numbers. Training now happens 100% in our own trainer,
// so cm/360° is the only conversion that matters — no more KovaaK's/Aim Lab
// yaw values to convert to.
//
// Community-validated yaw value (degrees/count per sensitivity unit).
// Source: mouse-sensitivity.com — verified against community posts on
// r/FPSAimTrainer.
export const GTA_YAW = 0.0009 // GTA V, sensitivity scale 0–100 (in-game slider)

// The -100..+100 slider is a single continuous SPEED dial, not a
// magnitude+axis-invert pair — negative values are genuinely slower turning,
// never an inverted Y axis (there is no axis-invert concept anywhere in this
// app). effectiveSensMagnitude() maps the signed slider value to a strictly
// increasing, always-positive "effective sensitivity" so cm/360 stays
// finite and strictly monotonic (slower left, faster right) across the
// *entire* range, including through zero — the old `Math.abs(gtaSens)`
// formula collapsed -30 and +30 to the same speed, which was the bug.
//
// Linear map `magnitude = SENS_BASE + SENS_SLOPE * gtaSens`, solved from two
// anchor points:
//   - (ANCHOR_SENS, ANCHOR_MAGNITUDE): preserves the community-validated
//     reference — sens=50, 800 dpi must still read 25.4 cm/360.
//   - sens=-100 (the slider's slowest extreme) lands on MIN_MAGNITUDE, a
//     small-but-positive floor — never zero/negative, so cm/360 never
//     degenerates to infinity even at the most extreme "slow" setting.
// Recalibrating: pick new ANCHOR_MAGNITUDE/MIN_MAGNITUDE values and
// re-derive SENS_SLOPE/SENS_BASE the same way; everything downstream
// (calcLocal, degPerCountFromGtaSens, the zone gauge) follows automatically.
const ANCHOR_SENS       = 50
const ANCHOR_MAGNITUDE  = 50  // sens=50 behaves exactly as before (25.4cm @ 800dpi)
const MIN_SENS          = -100
const MIN_MAGNITUDE     = 5   // magnitude at the slowest extreme (sens=-100)

export const SENS_SLOPE = (ANCHOR_MAGNITUDE - MIN_MAGNITUDE) / (ANCHOR_SENS - MIN_SENS)
export const SENS_BASE  = ANCHOR_MAGNITUDE - SENS_SLOPE * ANCHOR_SENS

export function effectiveSensMagnitude(gtaSens) {
  return SENS_BASE + SENS_SLOPE * gtaSens
}

export function calcLocal(gtaSens, dpi) {
  const magnitude = effectiveSensMagnitude(gtaSens)
  const cm = (360 / (dpi * magnitude * GTA_YAW)) * 2.54
  return {
    cm_per_360: +cm.toFixed(4),
  }
}

// Degrees the trainer's 3D camera should rotate per raw mouse "count"
// (movementX/movementY), derived from the same yaw constant as GTA V itself.
//
// DPI cancels out mathematically: cm_per_360 (in inches) = 360 / (dpi *
// magnitude * GTA_YAW), so degrees-per-inch = dpi * magnitude * GTA_YAW, and
// dividing by dpi (counts-per-inch) to get degrees-per-count leaves just
// magnitude * GTA_YAW. Raw mouse counts are already DPI-scaled by the OS for
// a given physical mouse, so the trainer doesn't need the user's DPI at all —
// only their GTA sensitivity value reproduces the exact in-game feel.
export function degPerCountFromGtaSens(gtaSens) {
  return effectiveSensMagnitude(gtaSens) * GTA_YAW
}
