// Declarative drill catalog — the single source of truth for every 2D drill
// the trainer offers. Each entry is pure data: id, category, base mechanic
// and per-difficulty parameters; the actual behavior lives in the generic
// engine (engine2d/drillSession.js + engine2d/movers.js), which interprets
// these parameters. Adding a drill = adding an entry here (+ i18n keys
// trainer.exercicios.<id>.nome/descricao in BOTH locales — enforced by
// catalog.test.mjs), never a new implementation file.
//
// Mirrored (ids + categories only, not params) in api/services/aim_level.py's
// CATEGORY_DRILLS so the routine generator can pick drills per category —
// keep the two in sync when adding/removing drills.
//
// The 4 pre-3.1.0 drills (tracking_2d/grid_2d/flick_2d/micro_2d) keep their
// exercise ids and exact parameters — old trainer_scores rows keep matching
// them, so no data migration is needed and old records stay valid.

export const SESSION_DURATION_S = 60

// Catalog/UI order — also the tie-break order the routine generator mirrors.
export const CATEGORIES = ['tracking', 'clicking', 'flicking', 'precision', 'reaction']

// ── Parameter reference (all sizes/distances are fractions of
//    min(canvasWidth, canvasHeight); all times in ms unless noted) ──────────
//
// Shared (click mechanics):
//   radiusFrac        target radius
//   timeoutMs         target expires unhit after this long (null = never)
//   simultaneous      how many targets are alive at once (default 1)
//   spawn             'random' | 'nearCursor' | 'grid' | 'chain' | 'duo' | 'center'
//   distanceRangeFrac [min,max] spawn offset for 'nearCursor'/'chain'
//   spawnDelayMs      [min,max] blank gap before each target appears (reaction)
//   grid              {cols, rows} fixed spawn cells for spawn:'grid'
//   alternate         true → 'nearCursor' spawns flip sides left/right (pendulum)
//   decoy             true → each target comes with a same-size decoy that must NOT be clicked
//   noGoChance        0..1 → that fraction of targets are "don't shoot" (blue); clicking one counts as a miss
//   shrink            {fromMs, overMs, minScale} target shrinks over its lifetime
//   jump              {afterMs, distanceFrac} target relocates once mid-life (correction drill)
//   aspect            {x, y} ellipse radius multipliers (narrow targets)
//   rings             {innerFrac, innerPoints, outerPoints} center-weighted scoring
//
// Tracking (continuous): radiusFrac, speedFrac (units/s), turnInterval [s,s],
//   turnRate (blend speed), snapTurns (instant direction changes),
//   pauseEvery [s,s] + pauseFor [s,s] (sudden full stops).

export const DRILLS = [
  // ── TRACKING — keep the crosshair glued to a moving target ───────────────
  {
    // Pre-3.1.0 drill, params untouched.
    id: 'tracking_2d', category: 'tracking',
    params: {
      facil:   { radiusFrac: 0.055, speedFrac: 0.20, turnInterval: [1.3, 2.2], turnRate: 1.2 },
      medio:   { radiusFrac: 0.042, speedFrac: 0.32, turnInterval: [0.9, 1.6], turnRate: 1.6 },
      dificil: { radiusFrac: 0.032, speedFrac: 0.46, turnInterval: [0.6, 1.1], turnRate: 2.2 },
    },
  },
  {
    // Erratic: direction snaps instead of blending, on a short clock.
    id: 'tracking_zigzag_2d', category: 'tracking',
    params: {
      facil:   { radiusFrac: 0.055, speedFrac: 0.22, turnInterval: [0.7, 1.2], turnRate: 6, snapTurns: true },
      medio:   { radiusFrac: 0.042, speedFrac: 0.32, turnInterval: [0.5, 0.9], turnRate: 6, snapTurns: true },
      dificil: { radiusFrac: 0.032, speedFrac: 0.44, turnInterval: [0.35, 0.65], turnRate: 6, snapTurns: true },
    },
  },
  {
    // Slow AND small — patience/steadiness, not speed.
    id: 'tracking_paciente_2d', category: 'tracking',
    params: {
      facil:   { radiusFrac: 0.038, speedFrac: 0.12, turnInterval: [1.4, 2.4], turnRate: 1.1 },
      medio:   { radiusFrac: 0.028, speedFrac: 0.16, turnInterval: [1.1, 1.9], turnRate: 1.3 },
      dificil: { radiusFrac: 0.020, speedFrac: 0.20, turnInterval: [0.9, 1.5], turnRate: 1.5 },
    },
  },
  {
    // Fast but big — raw arm speed over fine precision.
    id: 'tracking_velocista_2d', category: 'tracking',
    params: {
      facil:   { radiusFrac: 0.075, speedFrac: 0.42, turnInterval: [1.1, 1.9], turnRate: 1.6 },
      medio:   { radiusFrac: 0.062, speedFrac: 0.58, turnInterval: [0.9, 1.5], turnRate: 2.0 },
      dificil: { radiusFrac: 0.050, speedFrac: 0.74, turnInterval: [0.7, 1.2], turnRate: 2.4 },
    },
  },
  {
    // Smooth drift interrupted by sudden full stops.
    id: 'tracking_pare_siga_2d', category: 'tracking',
    params: {
      facil:   { radiusFrac: 0.050, speedFrac: 0.26, turnInterval: [1.2, 2.0], turnRate: 1.4, pauseEvery: [1.2, 2.2], pauseFor: [0.35, 0.7] },
      medio:   { radiusFrac: 0.040, speedFrac: 0.36, turnInterval: [0.9, 1.6], turnRate: 1.8, pauseEvery: [0.9, 1.8], pauseFor: [0.3, 0.6] },
      dificil: { radiusFrac: 0.030, speedFrac: 0.48, turnInterval: [0.7, 1.2], turnRate: 2.2, pauseEvery: [0.7, 1.4], pauseFor: [0.25, 0.5] },
    },
  },

  // ── CLICKING — static targets, click fast and clean ──────────────────────
  {
    // Pre-3.1.0 drill, params untouched (one target, no timeout).
    id: 'grid_2d', category: 'clicking',
    params: {
      facil:   { radiusFrac: 0.065, timeoutMs: null, spawn: 'random' },
      medio:   { radiusFrac: 0.048, timeoutMs: null, spawn: 'random' },
      dificil: { radiusFrac: 0.034, timeoutMs: null, spawn: 'random' },
    },
  },
  {
    // Three targets alive at once — pick your own order.
    id: 'clicking_trio_2d', category: 'clicking',
    params: {
      facil:   { radiusFrac: 0.055, timeoutMs: null, spawn: 'random', simultaneous: 3 },
      medio:   { radiusFrac: 0.042, timeoutMs: null, spawn: 'random', simultaneous: 3 },
      dificil: { radiusFrac: 0.030, timeoutMs: null, spawn: 'random', simultaneous: 3 },
    },
  },
  {
    // Fixed grid cells — muscle memory over search.
    id: 'clicking_tabuleiro_2d', category: 'clicking',
    params: {
      facil:   { radiusFrac: 0.055, timeoutMs: null, spawn: 'grid', grid: { cols: 3, rows: 3 } },
      medio:   { radiusFrac: 0.042, timeoutMs: null, spawn: 'grid', grid: { cols: 4, rows: 3 } },
      dificil: { radiusFrac: 0.030, timeoutMs: null, spawn: 'grid', grid: { cols: 5, rows: 4 } },
    },
  },
  {
    // Targets vanish on their own — hesitation costs the point.
    id: 'clicking_fugaz_2d', category: 'clicking',
    params: {
      facil:   { radiusFrac: 0.058, timeoutMs: 1300, spawn: 'random' },
      medio:   { radiusFrac: 0.045, timeoutMs: 1050, spawn: 'random' },
      dificil: { radiusFrac: 0.032, timeoutMs: 800,  spawn: 'random' },
    },
  },
  {
    // Tiny static targets — clean clicks only.
    id: 'clicking_alfinete_2d', category: 'clicking',
    params: {
      facil:   { radiusFrac: 0.024, timeoutMs: null, spawn: 'random' },
      medio:   { radiusFrac: 0.017, timeoutMs: null, spawn: 'random' },
      dificil: { radiusFrac: 0.012, timeoutMs: null, spawn: 'random' },
    },
  },

  // ── FLICKING — fast reorientation onto off-center targets ────────────────
  {
    // Pre-3.1.0 drill, params untouched (varied distances).
    id: 'flick_2d', category: 'flicking',
    params: {
      facil:   { radiusFrac: 0.058, distanceRangeFrac: [0.12, 0.30], timeoutMs: 1200, spawn: 'nearCursor' },
      medio:   { radiusFrac: 0.045, distanceRangeFrac: [0.18, 0.42], timeoutMs: 1200, spawn: 'nearCursor' },
      dificil: { radiusFrac: 0.032, distanceRangeFrac: [0.24, 0.54], timeoutMs: 1200, spawn: 'nearCursor' },
    },
  },
  {
    // Long-range flicks — the target spawns far, always.
    id: 'flick_longo_2d', category: 'flicking',
    params: {
      facil:   { radiusFrac: 0.055, distanceRangeFrac: [0.35, 0.55], timeoutMs: 1400, spawn: 'nearCursor' },
      medio:   { radiusFrac: 0.042, distanceRangeFrac: [0.40, 0.62], timeoutMs: 1300, spawn: 'nearCursor' },
      dificil: { radiusFrac: 0.030, distanceRangeFrac: [0.45, 0.70], timeoutMs: 1200, spawn: 'nearCursor' },
    },
  },
  {
    // Pendulum: spawns alternate strictly left/right of the cursor.
    id: 'flick_pendulo_2d', category: 'flicking',
    params: {
      facil:   { radiusFrac: 0.052, distanceRangeFrac: [0.22, 0.38], timeoutMs: 1300, spawn: 'nearCursor', alternate: true },
      medio:   { radiusFrac: 0.040, distanceRangeFrac: [0.26, 0.44], timeoutMs: 1150, spawn: 'nearCursor', alternate: true },
      dificil: { radiusFrac: 0.029, distanceRangeFrac: [0.30, 0.50], timeoutMs: 1000, spawn: 'nearCursor', alternate: true },
    },
  },
  {
    // Every real target comes with a blue decoy — flick past the bait.
    id: 'flick_isca_2d', category: 'flicking',
    params: {
      facil:   { radiusFrac: 0.052, distanceRangeFrac: [0.16, 0.36], timeoutMs: 1500, spawn: 'nearCursor', decoy: true },
      medio:   { radiusFrac: 0.040, distanceRangeFrac: [0.20, 0.44], timeoutMs: 1350, spawn: 'nearCursor', decoy: true },
      dificil: { radiusFrac: 0.029, distanceRangeFrac: [0.24, 0.52], timeoutMs: 1200, spawn: 'nearCursor', decoy: true },
    },
  },
  {
    // Chain: each target spawns relative to the PREVIOUS one, not the cursor.
    id: 'flick_corrente_2d', category: 'flicking',
    params: {
      facil:   { radiusFrac: 0.052, distanceRangeFrac: [0.18, 0.38], timeoutMs: 1400, spawn: 'chain' },
      medio:   { radiusFrac: 0.040, distanceRangeFrac: [0.22, 0.46], timeoutMs: 1250, spawn: 'chain' },
      dificil: { radiusFrac: 0.029, distanceRangeFrac: [0.26, 0.54], timeoutMs: 1100, spawn: 'chain' },
    },
  },

  // ── PRECISION — micro-adjustments and clean placement ────────────────────
  {
    // Pre-3.1.0 drill, params untouched (tiny near targets, short window).
    id: 'micro_2d', category: 'precision',
    params: {
      facil:   { radiusFrac: 0.036, distanceRangeFrac: [0.02, 0.06], timeoutMs: 900, spawn: 'nearCursor' },
      medio:   { radiusFrac: 0.026, distanceRangeFrac: [0.02, 0.07], timeoutMs: 700, spawn: 'nearCursor' },
      dificil: { radiusFrac: 0.019, distanceRangeFrac: [0.02, 0.08], timeoutMs: 550, spawn: 'nearCursor' },
    },
  },
  {
    // The target shrinks from full size toward nothing — hit it early.
    id: 'precisao_minguante_2d', category: 'precision',
    params: {
      facil:   { radiusFrac: 0.060, timeoutMs: 1800, spawn: 'random', shrink: { fromMs: 200, overMs: 1600, minScale: 0.25 } },
      medio:   { radiusFrac: 0.048, timeoutMs: 1500, spawn: 'random', shrink: { fromMs: 150, overMs: 1350, minScale: 0.22 } },
      dificil: { radiusFrac: 0.038, timeoutMs: 1200, spawn: 'random', shrink: { fromMs: 100, overMs: 1100, minScale: 0.20 } },
    },
  },
  {
    // Bullseye: the inner ring is worth double — placement over volume.
    id: 'precisao_mosca_2d', category: 'precision',
    params: {
      facil:   { radiusFrac: 0.062, timeoutMs: null, spawn: 'random', rings: { innerFrac: 0.42, innerPoints: 2, outerPoints: 1 } },
      medio:   { radiusFrac: 0.050, timeoutMs: null, spawn: 'random', rings: { innerFrac: 0.38, innerPoints: 2, outerPoints: 1 } },
      dificil: { radiusFrac: 0.040, timeoutMs: null, spawn: 'random', rings: { innerFrac: 0.34, innerPoints: 2, outerPoints: 1 } },
    },
  },
  {
    // The target hops once shortly after appearing — land the correction.
    id: 'precisao_salto_2d', category: 'precision',
    params: {
      facil:   { radiusFrac: 0.045, timeoutMs: 1600, spawn: 'random', jump: { afterMs: 450, distanceFrac: 0.07 } },
      medio:   { radiusFrac: 0.035, timeoutMs: 1400, spawn: 'random', jump: { afterMs: 400, distanceFrac: 0.09 } },
      dificil: { radiusFrac: 0.026, timeoutMs: 1200, spawn: 'random', jump: { afterMs: 350, distanceFrac: 0.11 } },
    },
  },
  {
    // Narrow vertical sliver — horizontal precision is everything.
    id: 'precisao_fresta_2d', category: 'precision',
    params: {
      facil:   { radiusFrac: 0.055, timeoutMs: null, spawn: 'random', aspect: { x: 0.38, y: 1.35 } },
      medio:   { radiusFrac: 0.045, timeoutMs: null, spawn: 'random', aspect: { x: 0.30, y: 1.35 } },
      dificil: { radiusFrac: 0.036, timeoutMs: null, spawn: 'random', aspect: { x: 0.24, y: 1.35 } },
    },
  },

  // ── REACTION — respond to the target APPEARING, not to its motion ────────
  {
    // Blank screen, then a target pops somewhere random — measured reaction.
    id: 'reacao_gatilho_2d', category: 'reaction',
    params: {
      facil:   { radiusFrac: 0.055, timeoutMs: 1100, spawn: 'random', spawnDelayMs: [400, 1300] },
      medio:   { radiusFrac: 0.044, timeoutMs: 900,  spawn: 'random', spawnDelayMs: [400, 1400] },
      dificil: { radiusFrac: 0.033, timeoutMs: 700,  spawn: 'random', spawnDelayMs: [400, 1500] },
    },
  },
  {
    // Two fixed posts — the live one switches; snap to whichever lit up.
    id: 'reacao_dupla_2d', category: 'reaction',
    params: {
      facil:   { radiusFrac: 0.055, timeoutMs: 1100, spawn: 'duo', spawnDelayMs: [300, 900] },
      medio:   { radiusFrac: 0.044, timeoutMs: 900,  spawn: 'duo', spawnDelayMs: [300, 1000] },
      dificil: { radiusFrac: 0.033, timeoutMs: 700,  spawn: 'duo', spawnDelayMs: [300, 1100] },
    },
  },
  {
    // One fixed center spot, unpredictable delay — pure reaction time.
    id: 'reacao_espera_2d', category: 'reaction',
    params: {
      facil:   { radiusFrac: 0.055, timeoutMs: 1000, spawn: 'center', spawnDelayMs: [600, 2000] },
      medio:   { radiusFrac: 0.044, timeoutMs: 800,  spawn: 'center', spawnDelayMs: [600, 2200] },
      dificil: { radiusFrac: 0.033, timeoutMs: 650,  spawn: 'center', spawnDelayMs: [600, 2400] },
    },
  },
  {
    // Rapid-fire sequence: barely any gap, short windows — keep up.
    id: 'reacao_rajada_2d', category: 'reaction',
    params: {
      facil:   { radiusFrac: 0.055, timeoutMs: 1000, spawn: 'random', spawnDelayMs: [120, 350] },
      medio:   { radiusFrac: 0.044, timeoutMs: 850,  spawn: 'random', spawnDelayMs: [120, 300] },
      dificil: { radiusFrac: 0.033, timeoutMs: 700,  spawn: 'random', spawnDelayMs: [120, 250] },
    },
  },
  {
    // Go/no-go: red targets are shot, blue ones must be left alone.
    id: 'reacao_semaforo_2d', category: 'reaction',
    params: {
      facil:   { radiusFrac: 0.055, timeoutMs: 1200, spawn: 'random', spawnDelayMs: [300, 900], noGoChance: 0.3 },
      medio:   { radiusFrac: 0.044, timeoutMs: 1000, spawn: 'random', spawnDelayMs: [300, 1000], noGoChance: 0.35 },
      dificil: { radiusFrac: 0.033, timeoutMs: 850,  spawn: 'random', spawnDelayMs: [300, 1100], noGoChance: 0.4 },
    },
  },
]

export const DRILLS_BY_ID = Object.fromEntries(DRILLS.map((d) => [d.id, d]))
export const DRILL_IDS = DRILLS.map((d) => d.id)

export function drillsInCategory(category) {
  return DRILLS.filter((d) => d.category === category)
}

// 'continuous' drills score by hover time (no clicks); everything else is
// click-to-hit. Mirrors what the player/HUD/results need to branch on.
export function modeOf(drill) {
  return drill.category === 'tracking' ? 'continuous' : 'click'
}
