// Difficulty index — a single numeric estimate of how hard one drill's
// difficulty block actually is to play, built purely from the runtime
// parameters that drive perceived difficulty (see catalog.js's parameter
// reference at the top of that file). Not a physics-accurate model — a
// monotonic, explainable proxy good enough to (a) audit the catalog for
// flattened/inverted facil→medio→dificil progressions and (b) recalibrate
// aimLevel.js's CALIBRATION denominators so scoring reflects how hard a
// difficulty actually IS, not just its label.
//
// ── Design ───────────────────────────────────────────────────────────────
// Every factor becomes a RAW "pressure" sub-score on a roughly-0-100 scale
// (bigger = harder; a value at the REF constant below lands at ~100). The
// index is the SUM of raw_i * WEIGHT_i over every factor a drill's params
// actually use (a field the drill doesn't set contributes 0). Sums, not
// products, on purpose: every term's effect on the total stays visible and
// linear, so recalibrating one WEIGHT can't silently distort another
// factor's behavior, and the whole thing stays a spreadsheet-legible model
// instead of a black box.
//
// [min,max] ranges (distanceRangeFrac, turnInterval, pauseEvery) collapse to
// their midpoint — the expected value of randRange()'s uniform draw
// (engine/spawn.js) — nothing in the engine biases toward either end, so the
// midpoint is the faithful single-number reduction.
//
// spawnDelayMs is deliberately NOT a factor here. It encodes two genuinely
// different, opposite-sign design intents in the catalog: reacao_rajada_2d
// narrows AND shortens its range as difficulty rises (raw speed/tempo —
// shorter average IS harder), while reacao_gatilho_2d/dupla/espera/semaforo
// widen it from a fixed low floor (anticipation/vigilance — a wider spread
// is harder to settle into a rhythm against, even though the AVERAGE grows).
// There's no single sign convention on [min,max] that's correct for both
// patterns, so folding it in would silently score 4 of 5 reaction drills'
// facil→dificil step as partly self-cancelling against their (unambiguous)
// radiusFrac/timeoutMs progression — an artifact of the model, not a real
// anulação in the catalog. Those two fields alone already carry reaction
// drills' difficulty faithfully; verified against every reaction drill in
// difficultyIndex.test.mjs's per-parameter direction check.
//
// Recalibrating: every dial is either in REF (what a "typical" catalog value
// looks like, scored ~100) or WEIGHTS (how much that factor should count
// relative to the others). Nothing else needs to change.

function midpoint(range) {
  if (!range) return null
  const [min, max] = range
  return (min + max) / 2
}

// "What a typical/medium value looks like across the catalog" for each
// factor — NOT a hard cap, a drill can score well above 100 on any one of
// these. Picked from eyeballing the catalog's medio-tier values.
export const REF = {
  RADIUS_FRAC:     0.045, // target radius, fraction of min(canvas w,h)
  SPEED_FRAC:      0.30,  // tracking target speed, minDim-units/s
  TURN_RATE:       1.6,   // tracking heading-blend rate
  TURN_INTERVAL_S: 1.1,   // seconds between heading changes
  TIMEOUT_MS:      1000,  // click-target time-to-live
  DISTANCE_FRAC:   0.30,  // flick/spawn distance from cursor
  PAUSE_EVERY_S:   1.3,   // tracking stop-and-go cadence
  SHRINK_ONSET_MS: 150,   // ms before a shrinking target starts shrinking
  JUMP_AFTER_MS:   400,   // ms before a jump-correction target relocates
  GRID_CELLS:      12,    // fixed-grid cell count (4x3)
}

// movers.js never reads `turnRate` when `snapTurns` is true — direction
// snaps straight to the new heading instead of blending toward it, so
// whatever turnRate the catalog entry happens to carry is dead data at
// runtime (a scaling multiplier on it would silently score an unused
// number). A snap drill's actual difficulty from this mechanic is a fixed
// "instant beats blended" step, applied once, independent of turnRate.
const SNAP_TURN_FLAT_EQUIVALENT = 2.4 // = the highest blended turnRate in the catalog (tracking_velocista_2d/dificil)

// How much each raw (~0-100) sub-score counts toward the total. `size` is
// weighted highest because target size is the single most universal driver
// of hit difficulty — every click-based drill has it, and it's the factor
// players feel most directly.
export const WEIGHTS = {
  size:           1.00,
  moveSpeed:      0.35,
  moveTurnRate:   0.25,
  moveTurnFreq:   0.20,
  movePause:      0.15,
  timePressure:   0.35,
  distance:       0.20,
  simultaneous:   0.30, // per extra concurrent target beyond the first
  decoy:          0.20, // flat: a same-size lookalike you must NOT click
  noGo:           0.30, // scaled by the fraction of targets that are no-go
  shrinkFinalize: 0.21, // 0.7 of the 0.30 "shrink" weight — how small it ends up
  shrinkOnset:    0.09, // 0.3 of the 0.30 "shrink" weight — how soon it starts
  jumpDistance:   0.12, // 0.6 of the 0.20 "jump" weight — how far it relocates
  jumpTiming:     0.08, // 0.4 of the 0.20 "jump" weight — how little warning
  rings:          0.12,
  gridDensity:    0.08,
}

// Each factor function takes a difficulty block (drill.params.facil, etc)
// and returns a RAW, unweighted 0-100ish pressure score — 0 if the drill
// doesn't use that mechanic at all.
const FACTORS = {
  // Ellipse aspect (precisao_fresta_2d) shrinks the effective hit target on
  // one axis even though radiusFrac itself doesn't change — the geometric
  // mean of the two multipliers captures that without a separate term.
  size(cfg) {
    const aspectX = cfg.aspect?.x ?? 1
    const aspectY = cfg.aspect?.y ?? 1
    const effectiveRadiusFrac = cfg.radiusFrac * Math.sqrt(aspectX * aspectY)
    return 100 * REF.RADIUS_FRAC / effectiveRadiusFrac
  },
  moveSpeed(cfg) {
    return cfg.speedFrac != null ? 100 * cfg.speedFrac / REF.SPEED_FRAC : 0
  },
  moveTurnRate(cfg) {
    if (cfg.snapTurns) return 100 * SNAP_TURN_FLAT_EQUIVALENT / REF.TURN_RATE
    return cfg.turnRate != null ? 100 * cfg.turnRate / REF.TURN_RATE : 0
  },
  moveTurnFreq(cfg) {
    const turnIntervalS = midpoint(cfg.turnInterval)
    return turnIntervalS ? 100 * REF.TURN_INTERVAL_S / turnIntervalS : 0
  },
  movePause(cfg) {
    const pauseEveryS = midpoint(cfg.pauseEvery)
    return pauseEveryS ? 100 * REF.PAUSE_EVERY_S / pauseEveryS : 0
  },
  timePressure(cfg) {
    return cfg.timeoutMs ? 100 * REF.TIMEOUT_MS / cfg.timeoutMs : 0
  },
  distance(cfg) {
    const distance = midpoint(cfg.distanceRangeFrac)
    return distance ? 100 * distance / REF.DISTANCE_FRAC : 0
  },
  simultaneous(cfg) {
    const extra = (cfg.simultaneous || 1) - 1
    return extra > 0 ? 100 * extra : 0
  },
  decoy(cfg) {
    return cfg.decoy ? 100 : 0
  },
  noGo(cfg) {
    return cfg.noGoChance ? 100 * cfg.noGoChance : 0
  },
  shrinkFinalize(cfg) {
    return cfg.shrink ? 100 * (1 - cfg.shrink.minScale) : 0
  },
  shrinkOnset(cfg) {
    return cfg.shrink ? 100 * REF.SHRINK_ONSET_MS / cfg.shrink.fromMs : 0
  },
  jumpDistance(cfg) {
    return cfg.jump ? 100 * cfg.jump.distanceFrac / REF.DISTANCE_FRAC : 0
  },
  jumpTiming(cfg) {
    return cfg.jump ? 100 * REF.JUMP_AFTER_MS / cfg.jump.afterMs : 0
  },
  rings(cfg) {
    return cfg.rings ? 100 * (1 - cfg.rings.innerFrac) : 0
  },
  gridDensity(cfg) {
    return cfg.grid ? 100 * (cfg.grid.cols * cfg.grid.rows) / REF.GRID_CELLS : 0
  },
}

export const FACTOR_NAMES = Object.keys(FACTORS)

// Full breakdown for one difficulty block — {total, factors: {name: {raw,
// weight, weighted}}} — the audit table and any "why is this harder" UI use
// this instead of the bare number.
export function difficultyBreakdown(cfg) {
  const factors = {}
  let total = 0
  for (const name of FACTOR_NAMES) {
    const raw = FACTORS[name](cfg)
    const weight = WEIGHTS[name]
    const weighted = raw * weight
    factors[name] = { raw, weight, weighted }
    total += weighted
  }
  return { total, factors }
}

// The single number — what most callers want.
export function difficultyIndex(cfg) {
  return difficultyBreakdown(cfg).total
}

// {facil, medio, dificil} indices for one catalog drill entry.
export function drillDifficultyIndices(drill) {
  return Object.fromEntries(
    Object.entries(drill.params).map(([key, cfg]) => [key, difficultyIndex(cfg)]),
  )
}

// Minimum required index gain from one difficulty tier to the next —
// enforced by difficultyIndex.test.mjs against every catalog drill so no
// drill can ship (or regress into) a flattened or inverted progression.
//
// Fixed at 20 — ~15% of the catalog's own median facil-tier index (130 at
// the time this was written: 25 drills' facil scores, midpoint). That tie
// to the model's natural scale is what makes it non-arbitrary: it's "each
// tier must add at least a modest fraction of what a typical drill's WHOLE
// baseline difficulty is," not a number picked to let today's catalog pass.
// It's still a fixed constant, not a live recomputation from DRILLS — a
// locked threshold needs to stay put so a test failure means a drill
// regressed, not that unrelated catalog edits silently moved the bar.
// Revisit this number (not just the catalog) if REF/WEIGHTS are ever
// materially retuned, since that would shift the whole scale it's a
// fraction of.
export const MIN_STEP = 20
