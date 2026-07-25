import { randomPointInBounds2D } from '../engine2d/spawn2d.js'
import { Target2D } from '../engine2d/target2d.js'
import { ClickScorer2D } from '../engine2d/clickScorer2d.js'
import { DRILL_ACCENTS, TARGET_COLOR } from '../engine2d/theme2d.js'

// "Grade de Tiro" (2D) — static targets appear one at a time anywhere in the
// canvas; hit it and another spawns immediately. No timeout: hesitation
// isn't punished here, only misses are. New key (grid_2d) — replaces the 3D
// shot_grid, own scoring scale.
export const EXERCISE_ID = 'grid_2d'
export const SESSION_DURATION_S = 60

// Difficulty only shrinks the target — spawn spread stays the same.
export const DIFFICULTIES = {
  facil:   { radiusFrac: 0.065, timeoutMs: null },
  medio:   { radiusFrac: 0.048, timeoutMs: null },
  dificil: { radiusFrac: 0.034, timeoutMs: null },
}

export function createTarget(width, height, difficultyKey = 'medio') {
  const cfg    = DIFFICULTIES[difficultyKey] || DIFFICULTIES.medio
  const radius = cfg.radiusFrac * Math.min(width, height)
  return new Target2D({
    spawnPosition: () => randomPointInBounds2D(width, height),
    radius,
    color: TARGET_COLOR,
    glowColor: DRILL_ACCENTS.grid_2d,
  })
}

export { ClickScorer2D as Scorer }
