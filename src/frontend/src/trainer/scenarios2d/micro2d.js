import { pointNearCursor2D } from '../engine2d/spawn2d.js'
import { Target2D } from '../engine2d/target2d.js'
import { ClickScorer2D } from '../engine2d/clickScorer2d.js'
import { DRILL_ACCENTS, TARGET_COLOR } from '../engine2d/theme2d.js'

// "Micro Ajuste" (2D) — small targets spawn very close to the current
// cursor position (small corrections, not flicks) with a short window
// before they expire. New key (micro_2d) — replaces the 3D micro_adjust,
// own scoring scale.
export const EXERCISE_ID = 'micro_2d'
export const SESSION_DURATION_S = 60

// Both target size AND the reaction window shrink with difficulty (unlike
// Flick Rápido, where only size/distance scale and the timeout is fixed) —
// this is what the spec calls out as this drill's "janela curta" axis.
export const DIFFICULTIES = {
  facil:   { radiusFrac: 0.036, distanceRangeFrac: [0.02, 0.06], timeoutMs: 900 },
  medio:   { radiusFrac: 0.026, distanceRangeFrac: [0.02, 0.07], timeoutMs: 700 },
  dificil: { radiusFrac: 0.019, distanceRangeFrac: [0.02, 0.08], timeoutMs: 550 },
}

export function createTarget(width, height, difficultyKey = 'medio', getCursorPos) {
  const cfg    = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medio
  const radius = cfg.radiusFrac * Math.min(width, height)
  return new Target2D({
    spawnPosition: () => pointNearCursor2D(getCursorPos(), cfg.distanceRangeFrac, width, height),
    radius,
    color: TARGET_COLOR,
    glowColor: DRILL_ACCENTS.micro_2d,
  })
}

export { ClickScorer2D as Scorer }
