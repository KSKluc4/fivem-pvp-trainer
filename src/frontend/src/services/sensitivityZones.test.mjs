// Regression guard for the gauge color-consistency bug: the needle
// (angleForCm) and the arc segments (zoneAngleRange) used to be computed by
// two independent, uncoordinated formulas — a value could visually point
// into one zone's segment while the label/chip highlighted a different
// zone. Both are now derived from the exact same gaugePercent()/angleForCm()
// functions, so this file asserts they can never drift apart again.
import test from 'node:test'
import assert from 'node:assert/strict'

import { ZONES, zoneForCm, angleForCm, zoneAngleRange, zoneCmRange } from './sensitivityZones.js'

test('zone -> color mapping is a single source of truth (no duplicate colors to mix up)', () => {
  const colors = ZONES.map((z) => z.color)
  assert.equal(new Set(colors).size, ZONES.length)
})

test('needle angle for any cm value falls within its own zone\'s segment angle range', () => {
  for (let cm = 8; cm <= 300; cm += 2) {
    const zone = zoneForCm(cm)
    const needle = angleForCm(cm)
    const [start, end] = zoneAngleRange(zone)
    assert.ok(
      needle >= start - 1e-6 && needle <= end + 1e-6,
      `cm=${cm} zone=${zone.id} needleAngle=${needle} not within [${start}, ${end}]`,
    )
  }
})

test('segments are contiguous, left(slow) to right(fast), with no gaps or overlaps', () => {
  const slowToFast = [...ZONES].reverse()
  for (let i = 0; i < slowToFast.length - 1; i++) {
    const [, endOfSlower] = zoneAngleRange(slowToFast[i])
    const [startOfFaster] = zoneAngleRange(slowToFast[i + 1])
    assert.ok(
      Math.abs(endOfSlower - startOfFaster) < 1e-6,
      `gap/overlap between ${slowToFast[i].id} and ${slowToFast[i + 1].id}`,
    )
  }
  assert.ok(Math.abs(zoneAngleRange(slowToFast[0])[0] - -90) < 1e-6, 'slowest zone should start at the left edge (-90°)')
  assert.ok(Math.abs(zoneAngleRange(slowToFast[slowToFast.length - 1])[1] - 90) < 1e-6, 'fastest zone should end at the right edge (+90°)')
})

test('zone cm ranges are contiguous (no gap between one zone\'s max and the next\'s min)', () => {
  for (let i = 1; i < ZONES.length; i++) {
    const [, prevMax] = zoneCmRange(ZONES[i - 1])
    const [curMin] = zoneCmRange(ZONES[i])
    assert.equal(curMin, prevMax)
  }
})

// ── The 3 example values from the bug report — pointer, segment, label and
// chip must all agree on the same zone/color for each. ──────────────────────
test('cm=70 (muito_lenta), cm=48 (controlada), cm=18 (agil) resolve consistently', () => {
  const cases = [
    { cm: 70, id: 'muito_lenta', color: 'grape' },
    { cm: 48, id: 'controlada',  color: 'brandPurple' },
    { cm: 18, id: 'agil',        color: 'orange' },
  ]
  for (const { cm, id, color } of cases) {
    const zone = zoneForCm(cm)
    assert.equal(zone.id, id, `cm=${cm} should classify as ${id}, got ${zone.id}`)
    assert.equal(zone.color, color)

    const needle = angleForCm(cm)
    const [start, end] = zoneAngleRange(zone)
    assert.ok(needle >= start - 1e-6 && needle <= end + 1e-6, `cm=${cm} needle should land inside its own ${id} segment`)
  }
})
