// Color constants for the 2D drill canvas — mirrors engine/scene.js's
// palette (same dark background/grid hex values) so the 2D arena reads as
// "same brand, new plane" rather than a different product, plus one accent
// color per drill CATEGORY matching TrainerView's CATEGORY_COLORS so the
// in-canvas target glow and the selection-card icon/chip agree.
export const BG_COLOR    = '#080810' // theme.js dark[9]
export const GRID_MAIN   = '#33334d' // theme.js dark[5]
export const GRID_THIN   = '#1c1c30'
export const TARGET_COLOR = '#ff4757'

// Decoys and "don't shoot" targets share one cold blue — the whole visual
// language is binary: red = shoot, blue = never shoot.
export const AVOID_COLOR = '#5c7cfa'
export const AVOID_GLOW  = '#3b5bdb'

export const CATEGORY_ACCENTS = {
  tracking:  '#00d4ff', // brandCyan
  clicking:  '#ff922b', // orange[5]
  flicking:  '#7b2fd4', // brandPurple
  precision: '#51cf66', // green[5]
  reaction:  '#fcc419', // yellow[5]
}
