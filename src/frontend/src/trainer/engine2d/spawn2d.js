import { randRange } from '../engine/spawn.js'

// Generic, exercise-agnostic spawn-position helpers shared by every 2D
// scenario in scenarios2d/ — the 2D analogue of engine/spawn.js. Bounds are
// expressed as FRACTIONS of the canvas's current CSS size (not fixed world
// units), so a spawn always lands in a sane spot regardless of the panel's
// actual resolution/aspect ratio.
export const ARENA_BOUNDS_2D = {
  x: [0.06, 0.94],
  y: [0.10, 0.90],
}

export function clampToArenaBounds2D(x, y, width, height) {
  const [xMinF, xMaxF] = ARENA_BOUNDS_2D.x
  const [yMinF, yMaxF] = ARENA_BOUNDS_2D.y
  return {
    x: Math.min(width * xMaxF, Math.max(width * xMinF, x)),
    y: Math.min(height * yMaxF, Math.max(height * yMinF, y)),
  }
}

// A uniformly random point anywhere in the arena — used by Grade de Tiro,
// whose targets should appear regardless of where the cursor currently is.
export function randomPointInBounds2D(width, height) {
  return {
    x: randRange([width * ARENA_BOUNDS_2D.x[0], width * ARENA_BOUNDS_2D.x[1]]),
    y: randRange([height * ARENA_BOUNDS_2D.y[0], height * ARENA_BOUNDS_2D.y[1]]),
  }
}

// A point offset from the CURRENT cursor position by a random angle and a
// radius sampled from distanceRangeFrac (a fraction of min(width,height)) —
// the 2D substitute for engine/spawn.js's pointNearForward: with a free
// cursor and no camera, "where the player is aiming" IS the cursor position,
// so a target spawning relative to it is what makes flick/micro-adjust
// drills a flick/correction in the first place. Clamped into
// ARENA_BOUNDS_2D so it's always a valid, visible spawn.
export function pointNearCursor2D(cursorPos, distanceRangeFrac, width, height) {
  const minDim = Math.min(width, height)
  const r      = randRange(distanceRangeFrac) * minDim
  const theta  = Math.random() * Math.PI * 2
  return clampToArenaBounds2D(
    cursorPos.x + Math.cos(theta) * r,
    cursorPos.y + Math.sin(theta) * r,
    width, height,
  )
}
