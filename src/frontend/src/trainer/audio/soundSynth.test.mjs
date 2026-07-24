import test from 'node:test'
import assert from 'node:assert/strict'
import { synthesizeShoot, synthesizeHit, synthesizeOnTargetTick } from './soundSynth.js'

const SAMPLE_RATE = 44100
const SYNTHESIZERS = {
  shoot: synthesizeShoot,
  hit:   synthesizeHit,
  tick:  synthesizeOnTargetTick,
}

for (const [name, synth] of Object.entries(SYNTHESIZERS)) {
  test(`${name}: returns a Float32Array shorter than 300ms (spec requirement)`, () => {
    const samples = synth(SAMPLE_RATE)
    assert.ok(samples instanceof Float32Array)
    assert.ok(samples.length > 0)
    assert.ok(samples.length / SAMPLE_RATE < 0.3)
  })

  test(`${name}: contains only finite values, no NaN/Infinity`, () => {
    const samples = synth(SAMPLE_RATE)
    for (const s of samples) assert.ok(Number.isFinite(s))
  })

  test(`${name}: is normalized — peak absolute amplitude is exactly 1`, () => {
    const samples = synth(SAMPLE_RATE)
    let peak = 0
    for (const s of samples) peak = Math.max(peak, Math.abs(s))
    assert.ok(Math.abs(peak - 1) < 1e-9)
  })

  test(`${name}: is deterministic across calls (reproducible, no unseeded randomness)`, () => {
    const a = synth(SAMPLE_RATE)
    const b = synth(SAMPLE_RATE)
    assert.deepEqual(Array.from(a), Array.from(b))
  })

  test(`${name}: scales sample count with sample rate`, () => {
    const at44k = synth(44100)
    const at48k = synth(48000)
    assert.ok(at48k.length > at44k.length)
  })
}

test('the three sounds are audibly distinguishable (not identical waveforms)', () => {
  const shoot = synthesizeShoot(SAMPLE_RATE)
  const hit = synthesizeHit(SAMPLE_RATE)
  const tick = synthesizeOnTargetTick(SAMPLE_RATE)
  assert.notEqual(shoot.length, hit.length)
  assert.notEqual(hit.length, tick.length)
})
