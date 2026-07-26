import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  CATEGORIES, DRILLS, DRILLS_BY_ID, DRILL_IDS,
  drillsInCategory, modeOf,
} from './catalog.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
const pt = JSON.parse(readFileSync(path.join(dir, '..', 'locales', 'pt', 'translation.json'), 'utf8'))
const en = JSON.parse(readFileSync(path.join(dir, '..', 'locales', 'en', 'translation.json'), 'utf8'))

// catalog.js promises "adding a drill = adding an entry here + i18n keys ...
// never a new implementation file" — this is what actually enforces the i18n
// half of that promise, since the pt/en parity test only diffs the two
// locale files against EACH OTHER, not against the catalog.
test('every catalog drill has trainer.exercicios.<id>.nome/descricao in both locales', () => {
  const missing = []
  for (const id of DRILL_IDS) {
    for (const [lang, dict] of [['pt', pt], ['en', en]]) {
      const entry = dict.trainer?.exercicios?.[id]
      if (!entry || !entry.nome || !entry.descricao) missing.push(`${lang}:trainer.exercicios.${id}`)
    }
  }
  assert.deepEqual(missing, [], `Missing i18n keys: ${missing.join(', ')}`)
})

// ── Catalog shape ─────────────────────────────────────────────────────────

test('DRILLS_BY_ID/DRILL_IDS mirror the DRILLS list', () => {
  assert.deepEqual(DRILL_IDS, DRILLS.map((d) => d.id))
  for (const drill of DRILLS) {
    assert.equal(DRILLS_BY_ID[drill.id], drill)
  }
})

test('drill ids are unique', () => {
  assert.equal(new Set(DRILL_IDS).size, DRILL_IDS.length)
})

test('every drill belongs to a known category and has facil/medio/dificil params', () => {
  for (const drill of DRILLS) {
    assert.ok(CATEGORIES.includes(drill.category), `${drill.id} has an unknown category "${drill.category}"`)
    assert.deepEqual(Object.keys(drill.params).sort(), ['dificil', 'facil', 'medio'])
  }
})

test('drillsInCategory returns exactly the drills tagged with that category', () => {
  for (const category of CATEGORIES) {
    const expected = DRILLS.filter((d) => d.category === category)
    assert.deepEqual(drillsInCategory(category), expected)
  }
})

test('modeOf is defined for every drill', () => {
  for (const drill of DRILLS) {
    assert.ok(['continuous', 'click'].includes(modeOf(drill)))
  }
})

test('tracking is the only continuous category, everything else is click', () => {
  for (const drill of DRILLS) {
    assert.equal(modeOf(drill), drill.category === 'tracking' ? 'continuous' : 'click')
  }
})
