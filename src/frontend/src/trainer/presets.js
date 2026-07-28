// Declarative routine-preset catalog — same philosophy as catalog.js: pure
// data, no React/JSX here, so it stays testable in plain node:test and the
// UI (RoutinePresets.jsx) is the only place that maps its string keys to
// actual icon components/colors.
//
// A preset is a fixed, curated list of {exercise, rounds} — WHICH drills run
// is fixed per preset (hand-picked for variety within its theme), but the
// DIFFICULTY of each is never stored here: it's resolved at play time from
// the player's current per-category aim level (recommendedDifficulty in
// aimLevel.js), via resolvePresetItems() below. Completing a preset uses the
// exact same drill/session/scoring machinery as picking a drill by hand from
// TrainerView — it's just a curated shortlist, not a new game mode.
//
// Duration is an ESTIMATE, not a cap — PRESET_ROUND_SECONDS mirrors the
// backend's own SLOT_SECONDS (routine_generator.py): ~60s of play plus
// ~15s of countdown/results/transition per round. Rounds per drill were
// hand-picked so the estimate lands close to each preset's target feel
// (~15min for the warmup, ~60min for the full session) — not forced to hit
// those numbers exactly, since actual pace depends on the player.

import { categoryOfExercise, recommendedDifficulty } from './aimLevel.js'

export const PRESET_ROUND_SECONDS = 75

export const PRESETS = [
  {
    id: 'aquecimento_rapido',
    icon: 'flame',
    accentColor: 'orange',
    categories: ['tracking', 'clicking', 'flicking', 'precision', 'reaction'],
    items: [
      { exercise: 'tracking_2d',       rounds: 3 },
      { exercise: 'grid_2d',           rounds: 2 },
      { exercise: 'flick_2d',          rounds: 2 },
      { exercise: 'micro_2d',          rounds: 3 },
      { exercise: 'reacao_gatilho_2d', rounds: 2 },
    ],
  },
  {
    id: 'foco_tracking',
    icon: 'focus',
    accentColor: 'brandCyan',
    categories: ['tracking'],
    items: [
      { exercise: 'tracking_2d',           rounds: 3 },
      { exercise: 'tracking_zigzag_2d',    rounds: 3 },
      { exercise: 'tracking_velocista_2d', rounds: 3 },
    ],
  },
  {
    id: 'foco_clique',
    icon: 'grid',
    accentColor: 'brandPurple',
    categories: ['clicking'],
    items: [
      { exercise: 'grid_2d',              rounds: 3 },
      { exercise: 'clicking_trio_2d',     rounds: 3 },
      { exercise: 'clicking_alfinete_2d', rounds: 3 },
    ],
  },
  {
    id: 'foco_flick',
    icon: 'bolt',
    accentColor: 'yellow',
    categories: ['flicking'],
    items: [
      { exercise: 'flick_2d',          rounds: 3 },
      { exercise: 'flick_pendulo_2d',  rounds: 3 },
      { exercise: 'flick_corrente_2d', rounds: 3 },
    ],
  },
  {
    id: 'foco_precisao_reacao',
    icon: 'target',
    accentColor: 'teal',
    categories: ['precision', 'reaction'],
    items: [
      { exercise: 'precisao_mosca_2d', rounds: 2 },
      { exercise: 'precisao_salto_2d', rounds: 2 },
      { exercise: 'reacao_gatilho_2d', rounds: 2 },
      { exercise: 'reacao_rajada_2d',  rounds: 2 },
    ],
  },
  {
    id: 'treino_completo',
    icon: 'trophy',
    accentColor: 'red',
    categories: ['tracking', 'clicking', 'flicking', 'precision', 'reaction'],
    items: [
      { exercise: 'tracking_2d',        rounds: 5 },
      { exercise: 'tracking_zigzag_2d', rounds: 4 },
      { exercise: 'grid_2d',            rounds: 5 },
      { exercise: 'clicking_fugaz_2d',  rounds: 5 },
      { exercise: 'flick_2d',           rounds: 5 },
      { exercise: 'flick_pendulo_2d',   rounds: 4 },
      { exercise: 'micro_2d',           rounds: 5 },
      { exercise: 'precisao_salto_2d',  rounds: 5 },
      { exercise: 'reacao_gatilho_2d',  rounds: 5 },
      { exercise: 'reacao_rajada_2d',   rounds: 5 },
    ],
  },
]

export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]))

// "Repetir foco" / "Variar para X" (welcome-back card) trigger a preset by
// CATEGORY, not by preset id — precision and reaction share one preset
// (there's no dedicated single-category preset for either), so both map to
// the same combined one.
export const CATEGORY_TO_PRESET = {
  tracking:  'foco_tracking',
  clicking:  'foco_clique',
  flicking:  'foco_flick',
  precision: 'foco_precisao_reacao',
  reaction:  'foco_precisao_reacao',
}

// Total rounds -> a rough minutes estimate (see PRESET_ROUND_SECONDS above).
export function estimatedMinutes(preset) {
  const totalRounds = preset.items.reduce((sum, item) => sum + item.rounds, 0)
  return Math.round((totalRounds * PRESET_ROUND_SECONDS) / 60)
}

// The preset's fixed drill list resolved against the player's CURRENT
// per-category aim levels (aimLevel.js's perCategoryLevels output) — WHICH
// drills never changes, only how hard each one starts. `perCategoryLevels`
// may be `{}`/partial/all-null (new player, no data yet): recommendedDifficulty
// already defaults to 'medio' in that case, so this never throws or needs
// its own fallback.
export function resolvePresetItems(preset, perCategoryLevels) {
  return preset.items.map(({ exercise, rounds }) => {
    const category = categoryOfExercise(exercise)
    const difficulty = recommendedDifficulty((perCategoryLevels || {})[category])
    return { exercise, rounds, difficulty, category }
  })
}
