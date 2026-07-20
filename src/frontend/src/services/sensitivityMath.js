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

export function calcLocal(gtaSens, dpi) {
  const abs = Math.abs(gtaSens)
  const cm  = (360 / (dpi * abs * GTA_YAW)) * 2.54
  return {
    cm_per_360: +cm.toFixed(4),
    inverted:   gtaSens < 0,
  }
}

// Degrees the trainer's 3D camera should rotate per raw mouse "count"
// (movementX/movementY), derived from the same yaw constant as GTA V itself.
//
// DPI cancels out mathematically: cm_per_360 (in inches) = 360 / (dpi * |sens|
// * GTA_YAW), so degrees-per-inch = dpi * |sens| * GTA_YAW, and dividing by
// dpi (counts-per-inch) to get degrees-per-count leaves just |sens| *
// GTA_YAW. Raw mouse counts are already DPI-scaled by the OS for a given
// physical mouse, so the trainer doesn't need the user's DPI at all — only
// their GTA sensitivity value reproduces the exact in-game feel.
export function degPerCountFromGtaSens(gtaSens) {
  return Math.abs(gtaSens) * GTA_YAW
}
