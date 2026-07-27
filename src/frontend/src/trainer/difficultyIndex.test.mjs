import test from 'node:test'
import assert from 'node:assert/strict'
import { DRILLS } from './catalog.js'
import { difficultyIndex, drillDifficultyIndices, MIN_STEP } from './difficultyIndex.js'

const DIFFICULTIES = ['facil', 'medio', 'dificil']

function mid(range) {
  return range ? (range[0] + range[1]) / 2 : null
}

// ── The rule this whole file locks in ───────────────────────────────────────
// Every drill's difficulty index must strictly increase facil < medio <
// dificil, by at least MIN_STEP each step — not just "increase by any
// amount." A drill that clears facil < medio < dificil by half a point is,
// for a player, indistinguishable from a flat or inverted one; this is what
// actually catches "Difícil não é perceptivelmente mais difícil que Fácil."
test('every catalog drill: facil < medio < dificil by at least MIN_STEP', () => {
  for (const drill of DRILLS) {
    const idx = drillDifficultyIndices(drill)
    const step1 = idx.medio - idx.facil
    const step2 = idx.dificil - idx.medio
    assert.ok(
      step1 >= MIN_STEP,
      `${drill.id}: facil→medio step is only ${step1.toFixed(1)} (need >= ${MIN_STEP}) — facil=${idx.facil.toFixed(1)}, medio=${idx.medio.toFixed(1)}`,
    )
    assert.ok(
      step2 >= MIN_STEP,
      `${drill.id}: medio→dificil step is only ${step2.toFixed(1)} (need >= ${MIN_STEP}) — medio=${idx.medio.toFixed(1)}, dificil=${idx.dificil.toFixed(1)}`,
    )
  }
})

// ── Anti-anulação: verified parameter by parameter, not just on the total ──
// A weighted sum can net out an "easier" change in one parameter against a
// "harder" change in another and still report a healthy total step — the
// exact anulação (e.g. smaller-but-slower target) the index alone can't
// catch. Every field below must move in its harder direction (or stay put)
// on EVERY facil→medio and medio→dificil step, independent of what the
// total index says.
//
// spawnDelayMs is intentionally NOT checked here — see the note in
// difficultyIndex.js: the catalog uses it with two legitimate, opposite-sign
// design intents (reacao_rajada_2d speeds up/narrows; the other 4 reaction
// drills widen from a fixed floor for anticipation-proofing), so no single
// direction is "correct" for the field itself. Those drills' difficulty is
// still fully covered by their (unambiguous) radiusFrac/timeoutMs checks.
const DIRECTIONAL_FIELDS = [
  ['radiusFrac',            (c) => c.radiusFrac,       'smaller_is_harder'],
  ['speedFrac',              (c) => c.speedFrac,        'bigger_is_harder'],
  ['turnRate',               (c) => c.turnRate,         'bigger_is_harder'],
  ['turnInterval (midpoint)', (c) => mid(c.turnInterval), 'smaller_is_harder'],
  ['pauseEvery (midpoint)',  (c) => mid(c.pauseEvery),  'smaller_is_harder'],
  ['pauseFor (midpoint)',    (c) => mid(c.pauseFor),    'smaller_is_harder'],
  ['timeoutMs',              (c) => c.timeoutMs,        'smaller_is_harder'],
  ['distanceRangeFrac (midpoint)', (c) => mid(c.distanceRangeFrac), 'bigger_is_harder'],
  ['simultaneous',           (c) => c.simultaneous,     'bigger_is_harder'],
  ['noGoChance',             (c) => c.noGoChance,       'bigger_is_harder'],
  ['shrink.minScale',        (c) => c.shrink?.minScale, 'smaller_is_harder'],
  ['shrink.fromMs',          (c) => c.shrink?.fromMs,   'smaller_is_harder'],
  ['shrink.overMs',          (c) => c.shrink?.overMs,   'smaller_is_harder'],
  ['jump.afterMs',           (c) => c.jump?.afterMs,    'smaller_is_harder'],
  ['jump.distanceFrac',      (c) => c.jump?.distanceFrac, 'bigger_is_harder'],
  ['rings.innerFrac',        (c) => c.rings?.innerFrac, 'smaller_is_harder'],
  ['aspect.x',               (c) => c.aspect?.x,        'smaller_is_harder'],
  ['grid cell count',        (c) => (c.grid ? c.grid.cols * c.grid.rows : null), 'bigger_is_harder'],
]

test('no drill parameter moves in the easier direction on any facil→medio or medio→dificil step (anti-anulação)', () => {
  for (const drill of DRILLS) {
    const blocks = DIFFICULTIES.map((key) => drill.params[key])
    for (const [name, get, direction] of DIRECTIONAL_FIELDS) {
      const values = blocks.map(get)
      // Only enforced when the drill uses this field at every tier — a field
      // absent everywhere is irrelevant, and a field only present at SOME
      // tiers is a different (shape) problem, not a direction problem.
      if (values.some((v) => v == null)) continue
      for (let i = 1; i < values.length; i++) {
        const prev = values[i - 1]
        const cur = values[i]
        const ok = direction === 'smaller_is_harder' ? cur <= prev : cur >= prev
        assert.ok(
          ok,
          `${drill.id}: ${name} moved the EASIER way from ${DIFFICULTIES[i - 1]} (${prev}) to ${DIFFICULTIES[i]} (${cur}) — expected ${direction.replace('_', ' ')}`,
        )
      }
    }
  }
})

test('difficultyIndex is a pure function of a params block, not the drill it came from', () => {
  const cfg = { radiusFrac: 0.05, timeoutMs: 900, spawn: 'random' }
  assert.equal(difficultyIndex(cfg), difficultyIndex({ ...cfg }))
})

test('a smaller target alone raises the index (sanity check on the model direction)', () => {
  const bigger = difficultyIndex({ radiusFrac: 0.06 })
  const smaller = difficultyIndex({ radiusFrac: 0.03 })
  assert.ok(smaller > bigger, 'a smaller radiusFrac must score as harder')
})
