// Color constants for the 2D drill canvas — mirrors engine/scene.js's
// palette (same dark background/grid hex values) so the 2D arena reads as
// "same brand, new plane" rather than a different product, plus one accent
// color per drill CATEGORY so the in-canvas target glow, the HUD's score/
// badge accent, and the selection-card icon/chip all agree.
export const BG_COLOR    = '#080810' // theme.js dark[9]
export const GRID_MAIN   = '#33334d' // theme.js dark[5]
export const GRID_THIN   = '#1c1c30'
export const TARGET_COLOR = '#ff4757'

// Decoys and "don't shoot" targets share one cold blue — the whole visual
// language is binary: red = shoot, blue = never shoot.
export const AVOID_COLOR = '#5c7cfa'
export const AVOID_GLOW  = '#3b5bdb'

// Raw hex, for canvas drawing (target glow, field border glow).
export const CATEGORY_ACCENTS = {
  tracking:  '#00d4ff', // brandCyan
  clicking:  '#ff922b', // orange[5]
  flicking:  '#7b2fd4', // brandPurple
  precision: '#51cf66', // green[5]
  reaction:  '#fcc419', // yellow[5]
}

// Same 5 hues as CATEGORY_ACCENTS, as Mantine theme color names — for DOM
// elements (Badge/ThemeIcon/Text `color`/`c` props) that can't take a raw
// hex. Single source of truth so the canvas accent and the DOM accent can
// never drift apart the way two hand-kept-in-sync tables eventually would.
export const CATEGORY_COLORS = {
  tracking:  'brandCyan',
  clicking:  'orange',
  flicking:  'brandPurple',
  precision: 'green',
  reaction:  'yellow',
}

// Alpha-blended category accent, for DOM elements that need a soft tint
// (chip backgrounds/borders) rather than the solid hex or a Mantine color
// name — e.g. the trainer category filter chips.
export function categoryRgba(category, alpha) {
  const hex = CATEGORY_ACCENTS[category]
  if (!hex) return `rgba(255, 255, 255, ${alpha})`
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
