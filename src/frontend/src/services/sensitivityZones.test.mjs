// Zone classification (cm/360 -> named "feel" zone) — the source of truth
// for the active-zone label, summary copy, and legend chips on the "Minha
// Sensibilidade" screen. The gauge ARC's own coordinate system (sens-based,
// DPI-aware) lives in sensitivityGaugeAxis.js and is tested separately.
import test from 'node:test'
import assert from 'node:assert/strict'

import { ZONES, zoneForCm, zoneCmRange } from './sensitivityZones.js'

test('zone -> color mapping is a single source of truth (no duplicate colors to mix up)', () => {
  const colors = ZONES.map((z) => z.color)
  assert.equal(new Set(colors).size, ZONES.length)
})

test('zone cm ranges are contiguous (no gap between one zone\'s max and the next\'s min)', () => {
  for (let i = 1; i < ZONES.length; i++) {
    const [, prevMax] = zoneCmRange(ZONES[i - 1])
    const [curMin] = zoneCmRange(ZONES[i])
    assert.equal(curMin, prevMax)
  }
  assert.equal(zoneCmRange(ZONES[0])[0], 0)
  assert.equal(zoneCmRange(ZONES[ZONES.length - 1])[1], Infinity)
})

test('cm=70 (muito_lenta), cm=48 (controlada), cm=18 (agil) classify as expected', () => {
  const cases = [
    { cm: 70, id: 'muito_lenta', color: 'grape' },
    { cm: 48, id: 'controlada',  color: 'brandPurple' },
    { cm: 18, id: 'agil',        color: 'orange' },
  ]
  for (const { cm, id, color } of cases) {
    const zone = zoneForCm(cm)
    assert.equal(zone.id, id, `cm=${cm} should classify as ${id}, got ${zone.id}`)
    assert.equal(zone.color, color)
  }
})
