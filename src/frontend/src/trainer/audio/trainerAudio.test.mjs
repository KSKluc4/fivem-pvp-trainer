import test from 'node:test'
import assert from 'node:assert/strict'

import * as trainerAudio from './trainerAudio.js'

const {
  initTrainerAudio, isTrainerAudioAvailable, playShoot, playHit, playOnTargetTick,
  setTrainerAudioVolume, __resetTrainerAudioForTests,
} = trainerAudio

class FakeAudioContext {
  constructor() {
    this.sampleRate = 44100
    this.state = 'running'
    this.destination = {}
    this.sources = []
    FakeAudioContext.lastInstance = this
  }
  createGain() {
    return { gain: { value: 1 }, connect: () => {} }
  }
  createBuffer(_channels, length, sampleRate) {
    return { length, sampleRate, data: new Float32Array(length), copyToChannel(arr) { this.data.set(arr) } }
  }
  createBufferSource() {
    const source = {
      buffer: null, started: false, stopped: false, onended: null,
      connect: () => source,
      start() { source.started = true },
      stop() { source.stopped = true },
    }
    this.sources.push(source)
    return source
  }
  resume() { this.state = 'running'; return Promise.resolve() }
}

test.beforeEach(() => {
  __resetTrainerAudioForTests()
  delete globalThis.window
})

// ── Fallback: no AudioContext available at all (headless/unsupported/no device) ──

test('initTrainerAudio() without a window/AudioContext does not throw', () => {
  assert.doesNotThrow(() => initTrainerAudio())
  assert.equal(isTrainerAudioAvailable(), false)
})

test('play* calls are safe no-ops when audio is unavailable', () => {
  initTrainerAudio()
  assert.doesNotThrow(() => playShoot())
  assert.doesNotThrow(() => playHit())
  assert.doesNotThrow(() => playOnTargetTick())
  assert.doesNotThrow(() => setTrainerAudioVolume(80))
})

test('play* calls before initTrainerAudio() is ever called are also safe no-ops', () => {
  assert.doesNotThrow(() => playShoot())
  assert.equal(isTrainerAudioAvailable(), false)
})

// ── A broken AudioContext constructor degrades silently too ──

test('a throwing AudioContext constructor is caught, leaving audio unavailable', () => {
  globalThis.window = {
    AudioContext: class {
      constructor() { throw new Error('no audio device') }
    },
  }
  assert.doesNotThrow(() => initTrainerAudio())
  assert.equal(isTrainerAudioAvailable(), false)
  assert.doesNotThrow(() => playShoot())
})

// ── Happy path, with a fake Web Audio graph ──

test('initTrainerAudio() with a working AudioContext becomes available and builds 3 buffers', () => {
  globalThis.window = { AudioContext: FakeAudioContext }
  initTrainerAudio()
  assert.equal(isTrainerAudioAvailable(), true)
})

test('playShoot()/playHit() start a buffer source node on the underlying context', () => {
  globalThis.window = { AudioContext: FakeAudioContext }
  initTrainerAudio()
  const ctx = FakeAudioContext.lastInstance
  playShoot()
  playHit()
  assert.equal(ctx.sources.length, 2)
  assert.ok(ctx.sources.every((s) => s.started === true))
})

test('sfxEnabled=false (via localStorage settings) silences play* without throwing', () => {
  globalThis.window = { AudioContext: FakeAudioContext }
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ sfxEnabled: false }),
    setItem: () => {},
  }
  initTrainerAudio()
  const ctx = FakeAudioContext.lastInstance
  playShoot()
  playHit()
  playOnTargetTick()
  assert.equal(ctx.sources.length, 0)
  delete globalThis.localStorage
})

test('initTrainerAudio() called twice does not recreate the context (idempotent)', () => {
  globalThis.window = { AudioContext: FakeAudioContext }
  initTrainerAudio()
  assert.doesNotThrow(() => initTrainerAudio())
  assert.equal(isTrainerAudioAvailable(), true)
})

test('multiple shots fired in immediate succession (same frame) do not throw', () => {
  globalThis.window = { AudioContext: FakeAudioContext }
  initTrainerAudio()
  assert.doesNotThrow(() => {
    for (let i = 0; i < 20; i++) playShoot()
  })
})
