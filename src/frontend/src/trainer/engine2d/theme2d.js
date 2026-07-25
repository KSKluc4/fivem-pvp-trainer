// Color constants for the 2D drill canvas — mirrors engine/scene.js's
// palette (same dark background/grid hex values) so the 2D arena reads as
// "same brand, new plane" rather than a different product, plus one accent
// color per drill matching TrainerView's EXERCISE_COLORS so the canvas glow
// and the selection-card icon agree.
export const BG_COLOR    = '#080810' // theme.js dark[9]
export const GRID_MAIN   = '#33334d' // theme.js dark[5]
export const GRID_THIN   = '#1c1c30'
export const TARGET_COLOR = '#ff4757'

export const DRILL_ACCENTS = {
  tracking_2d: '#00d4ff', // brandCyan
  grid_2d:     '#ff922b', // orange[5]
  flick_2d:    '#7b2fd4', // brandPurple
  micro_2d:    '#51cf66', // green[5]
}
