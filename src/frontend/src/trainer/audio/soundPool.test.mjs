import test from 'node:test'
import assert from 'node:assert/strict'
import { SoundPool } from './soundPool.js'

// A minimal fake Web Audio graph — just enough surface for SoundPool to
// drive (createBufferSource/createGain/connect/start/stop/onended) without
// a real AudioContext.
function fakeContext() {
  const created = []
  return {
    created,
    createBufferSource() {
      const node = {
        buffer: null,
        connect: () => node,
        started: false,
        stopped: false,
        onended: null,
        start() { node.started = true },
        stop() {
          if (node.stopped) throw new Error('already stopped')
          node.stopped = true
        },
      }
      created.push(node)
      return node
    },
    createGain() {
      return { gain: { value: 1 }, connect: () => {} }
    },
  }
}

const fakeBuffer = { length: 100 }
const fakeDestination = {}

test('play() starts a buffer source node connected through a gain node', () => {
  const ctx = fakeContext()
  const pool = new SoundPool(ctx, fakeBuffer, fakeDestination)
  const voice = pool.play()
  assert.equal(voice.buffer, fakeBuffer)
  assert.equal(voice.started, true)
})

test('play() with no buffer is a safe no-op', () => {
  const ctx = fakeContext()
  const pool = new SoundPool(ctx, null, fakeDestination)
  assert.doesNotThrow(() => pool.play())
  assert.equal(ctx.created.length, 0)
})

test('concurrent voices are bounded by maxVoices — multiple shots in the same frame do not grow unbounded', () => {
  const ctx = fakeContext()
  const pool = new SoundPool(ctx, fakeBuffer, fakeDestination, { maxVoices: 3 })
  for (let i = 0; i < 10; i++) pool.play()
  assert.ok(pool.voices.length <= 3)
  assert.equal(ctx.created.length, 10) // still creates a node per shot...
})

test('exceeding maxVoices stops the oldest voice (voice-stealing) rather than throwing', () => {
  const ctx = fakeContext()
  const pool = new SoundPool(ctx, fakeBuffer, fakeDestination, { maxVoices: 2 })
  const first = pool.play()
  pool.play()
  assert.doesNotThrow(() => pool.play())
  assert.equal(first.stopped, true)
})

test('a voice removes itself from the pool when onended fires', () => {
  const ctx = fakeContext()
  const pool = new SoundPool(ctx, fakeBuffer, fakeDestination)
  const voice = pool.play()
  assert.equal(pool.voices.length, 1)
  voice.onended()
  assert.equal(pool.voices.length, 0)
})

test('dispose() stops all active voices without throwing even if already ended', () => {
  const ctx = fakeContext()
  const pool = new SoundPool(ctx, fakeBuffer, fakeDestination)
  pool.play()
  const voice2 = pool.play()
  voice2.stop() // simulate one that already ended naturally
  assert.doesNotThrow(() => pool.dispose())
  assert.equal(pool.voices.length, 0)
})
