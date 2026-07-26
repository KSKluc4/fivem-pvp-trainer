import { DRILLS, SESSION_DURATION_S, modeOf } from '../catalog.js'
import { createDrillSession } from '../engine2d/drillSession.js'

// Normalizes every catalog drill behind one shape so TrainerView/
// ExercisePlayer never touch a specific drill directly. Since 3.1.0 the
// per-drill scenario modules are gone — every entry is the generic
// engine2d/drillSession.js parameterized by trainer/catalog.js, and this
// file is just the id → scenario lookup. `mode` decides which loop logic
// runs in the player: 'continuous' (tracking drills — hover scoring) or
// 'click' (everything else — click-to-hit).
export const SCENARIOS = Object.fromEntries(DRILLS.map((drill) => [drill.id, {
  id:               drill.id,
  category:         drill.category,
  mode:             modeOf(drill),
  sessionDurationS: SESSION_DURATION_S,
  difficulties:     drill.params,
  createSession:    (width, height, difficultyKey, getCursorPos) =>
    createDrillSession(drill, difficultyKey, width, height, getCursorPos),
}]))

export const EXERCISE_IDS = Object.keys(SCENARIOS)
