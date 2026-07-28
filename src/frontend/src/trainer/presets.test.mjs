import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { DRILLS_BY_ID, CATEGORIES } from './catalog.js'
import {
  PRESETS, PRESETS_BY_ID, CATEGORY_TO_PRESET, estimatedMinutes, resolvePresetItems,
} from './presets.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
const pt = JSON.parse(readFileSync(path.join(dir, '..', 'locales', 'pt', 'translation.json'), 'utf8'))
const en = JSON.parse(readFileSync(path.join(dir, '..', 'locales', 'en', 'translation.json'), 'utf8'))

// Same promise catalog.test.mjs enforces for drills: adding/renaming a
// preset id here without touching the locale files should fail loudly,
// not silently render a raw key string in the UI.
test('every preset has rotina.presets.catalogo.<id>.nome/descricao in both locales', () => {
  const missing = []
  for (const preset of PRESETS) {
    for (const [lang, dict] of [['pt', pt], ['en', en]]) {
      const entry = dict.rotina?.presets?.catalogo?.[preset.id]
      if (!entry || !entry.nome || !entry.descricao) missing.push(`${lang}:rotina.presets.catalogo.${preset.id}`)
    }
  }
  assert.deepEqual(missing, [], `Missing i18n keys: ${missing.join(', ')}`)
})

test('every preset has a unique id, at least 2 items, and only real catalog drills', () => {
  const ids = new Set()
  for (const preset of PRESETS) {
    assert.ok(!ids.has(preset.id), `duplicate preset id: ${preset.id}`)
    ids.add(preset.id)
    assert.ok(preset.items.length >= 2, `${preset.id}: needs at least 2 drills`)
    for (const item of preset.items) {
      assert.ok(DRILLS_BY_ID[item.exercise], `${preset.id}: unknown drill "${item.exercise}"`)
      assert.ok(Number.isInteger(item.rounds) && item.rounds > 0, `${preset.id}/${item.exercise}: rounds must be a positive integer`)
    }
  }
})

test('there are exactly 6 presets, matching the requested lineup', () => {
  assert.deepEqual(
    [...PRESETS.map((p) => p.id)].sort(),
    ['aquecimento_rapido', 'foco_clique', 'foco_flick', 'foco_precisao_reacao', 'foco_tracking', 'treino_completo'].sort(),
  )
})

test('PRESETS_BY_ID mirrors PRESETS', () => {
  for (const preset of PRESETS) assert.equal(PRESETS_BY_ID[preset.id], preset)
})

test('each preset only lists drills from the categories it declares', () => {
  for (const preset of PRESETS) {
    for (const item of preset.items) {
      const drill = DRILLS_BY_ID[item.exercise]
      assert.ok(preset.categories.includes(drill.category),
        `${preset.id}: drill ${item.exercise} is category ${drill.category}, not in declared categories ${preset.categories}`)
    }
  }
})

test('CATEGORY_TO_PRESET covers every trainer category with a real preset id', () => {
  for (const category of CATEGORIES) {
    const presetId = CATEGORY_TO_PRESET[category]
    assert.ok(presetId, `no preset mapped for category ${category}`)
    assert.ok(PRESETS_BY_ID[presetId], `CATEGORY_TO_PRESET[${category}] points at a non-existent preset ${presetId}`)
  }
})

test('precision and reaction share the combined preset (no dedicated single-category preset for either)', () => {
  assert.equal(CATEGORY_TO_PRESET.precision, 'foco_precisao_reacao')
  assert.equal(CATEGORY_TO_PRESET.reaction, 'foco_precisao_reacao')
})

// ── estimatedMinutes ─────────────────────────────────────────────────────────

test('the warmup and full-session presets land close to their advertised ~15min/~60min feel', () => {
  const warmup = estimatedMinutes(PRESETS_BY_ID.aquecimento_rapido)
  const full   = estimatedMinutes(PRESETS_BY_ID.treino_completo)
  assert.ok(Math.abs(warmup - 15) <= 3, `aquecimento_rapido estimate is ${warmup}min, expected close to ~15min`)
  assert.ok(Math.abs(full - 60) <= 5, `treino_completo estimate is ${full}min, expected close to ~60min`)
})

test('estimatedMinutes grows with total rounds', () => {
  const short = { items: [{ exercise: 'grid_2d', rounds: 1 }] }
  const long  = { items: [{ exercise: 'grid_2d', rounds: 10 }] }
  assert.ok(estimatedMinutes(long) > estimatedMinutes(short))
})

// ── resolvePresetItems — drill selection is fixed, difficulty follows level ──

test('resolvePresetItems never changes WHICH drills a preset contains', () => {
  const preset = PRESETS_BY_ID.foco_tracking
  const atLowLevel  = resolvePresetItems(preset, { tracking: 1 })
  const atHighLevel = resolvePresetItems(preset, { tracking: 5 })
  assert.deepEqual(atLowLevel.map((i) => i.exercise), preset.items.map((i) => i.exercise))
  assert.deepEqual(atLowLevel.map((i) => i.exercise), atHighLevel.map((i) => i.exercise))
  assert.deepEqual(atLowLevel.map((i) => i.rounds), atHighLevel.map((i) => i.rounds))
})

test('resolvePresetItems maps category level to the recommended difficulty tier', () => {
  const preset = PRESETS_BY_ID.foco_tracking // all-tracking, so one level controls every item
  assert.ok(resolvePresetItems(preset, { tracking: 1 }).every((i) => i.difficulty === 'facil'))
  assert.ok(resolvePresetItems(preset, { tracking: 3 }).every((i) => i.difficulty === 'medio'))
  assert.ok(resolvePresetItems(preset, { tracking: 5 }).every((i) => i.difficulty === 'dificil'))
})

test('resolvePresetItems defaults to medio for a category with no level yet (new player)', () => {
  const preset = PRESETS_BY_ID.foco_tracking
  assert.ok(resolvePresetItems(preset, { tracking: null }).every((i) => i.difficulty === 'medio'))
  assert.ok(resolvePresetItems(preset, {}).every((i) => i.difficulty === 'medio'))
  assert.ok(resolvePresetItems(preset, undefined).every((i) => i.difficulty === 'medio'))
})

test('resolvePresetItems resolves each item against its OWN category independently (mixed-category preset)', () => {
  const preset = PRESETS_BY_ID.foco_precisao_reacao // precision + reaction
  const items = resolvePresetItems(preset, { precision: 5, reaction: 1 })
  const byCategory = Object.fromEntries(items.map((i) => [i.exercise, i]))
  assert.equal(byCategory.precisao_mosca_2d.difficulty, 'dificil')
  assert.equal(byCategory.precisao_salto_2d.difficulty, 'dificil')
  assert.equal(byCategory.reacao_gatilho_2d.difficulty, 'facil')
  assert.equal(byCategory.reacao_rajada_2d.difficulty, 'facil')
})

test('resolvePresetItems tags each item with its category', () => {
  const items = resolvePresetItems(PRESETS_BY_ID.aquecimento_rapido, {})
  for (const item of items) {
    assert.equal(item.category, DRILLS_BY_ID[item.exercise].category)
  }
})
