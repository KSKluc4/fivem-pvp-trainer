import { randRange } from '../engine/spawn.js'

// Generic, exercise-agnostic spawn-position helpers shared by every 2D
// scenario in scenarios2d/ — the 2D analogue of engine/spawn.js.
//
// Bounds are NOT a fixed fraction of the canvas — every function here takes
// an explicit pixel margin (marginX, marginY) that the caller (DrillSession)
// derives from the TARGET'S OWN radius (times its aspect multiplier) plus a
// small slack constant. This is what guarantees a target can never spawn
// partially outside the visible/clickable field regardless of how big or
// small that particular drill's targets are — a fixed universal fraction
// can't do that once radiusFrac ranges from 0.012 (clicking_alfinete_2d) to
// 0.075 (tracking_velocista_2d) across the catalog.
export function clampToArenaBounds2D(x, y, width, height, marginX, marginY) {
  // Degenerate guard: if a margin would invert the safe range (a target
  // bigger than the canvas itself, or a canvas resized below the target's
  // own size mid-session), fall back to the exact center rather than
  // producing an inverted min>max range.
  const safeMarginX = Math.min(marginX, width / 2)
  const safeMarginY = Math.min(marginY, height / 2)
  return {
    x: Math.min(width - safeMarginX, Math.max(safeMarginX, x)),
    y: Math.min(height - safeMarginY, Math.max(safeMarginY, y)),
  }
}

// A uniformly random point anywhere in the safe field — used by drills
// whose targets should appear regardless of where the cursor currently is.
export function randomPointInBounds2D(width, height, marginX, marginY) {
  const safeMarginX = Math.min(marginX, width / 2)
  const safeMarginY = Math.min(marginY, height / 2)
  return {
    x: randRange([safeMarginX, width - safeMarginX]),
    y: randRange([safeMarginY, height - safeMarginY]),
  }
}

// A point offset from the CURRENT cursor position by a random angle and a
// radius sampled from distanceRangeFrac (a fraction of min(width,height)) —
// the 2D substitute for engine/spawn.js's pointNearForward: with a free
// cursor and no camera, "where the player is aiming" IS the cursor position,
// so a target spawning relative to it is what makes flick/micro-adjust
// drills a flick/correction in the first place. Clamped into the safe field
// so it's always a valid, visible, clickable spawn.
export function pointNearCursor2D(cursorPos, distanceRangeFrac, width, height, marginX, marginY) {
  const minDim = Math.min(width, height)
  const r      = randRange(distanceRangeFrac) * minDim
  const theta  = Math.random() * Math.PI * 2
  return clampToArenaBounds2D(
    cursorPos.x + Math.cos(theta) * r,
    cursorPos.y + Math.sin(theta) * r,
    width, height, marginX, marginY,
  )
}
