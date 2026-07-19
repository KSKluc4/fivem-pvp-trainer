import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { EXERCISE_ID, SESSION_DURATION_S, DIFFICULTIES, createTarget } from './quickFlick.js'
import { ARENA_BOUNDS } from '../engine/scene.js'

function makeCamera() {
  const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 100)
  camera.position.set(0, 1.7, 0)
  camera.rotation.order = 'YXZ'
  return camera
}

test('exercise metadata', () => {
  assert.equal(EXERCISE_ID, 'quick_flick')
  assert.equal(SESSION_DURATION_S, 60)
  assert.deepEqual(Object.keys(DIFFICULTIES), ['facil', 'medio', 'dificil'])
})

test('timeout is fixed at 1.2s across all difficulties', () => {
  for (const key of Object.keys(DIFFICULTIES)) {
    assert.equal(DIFFICULTIES[key].timeoutMs, 1200)
  }
})

test('radius shrinks and flick distance grows as difficulty increases', () => {
  assert.ok(DIFFICULTIES.facil.radius > DIFFICULTIES.medio.radius)
  assert.ok(DIFFICULTIES.medio.radius > DIFFICULTIES.dificil.radius)
  assert.ok(DIFFICULTIES.facil.distanceRange[1] < DIFFICULTIES.dificil.distanceRange[1])
})

test('createTarget spawns inside ARENA_BOUNDS regardless of camera orientation', () => {
  const scene = new THREE.Scene()
  const camera = makeCamera()
  for (let i = 0; i < 30; i++) {
    camera.rotation.y = (Math.random() - 0.5) * Math.PI * 2
    const target = createTarget(scene, 'dificil', camera)
    const p = target.mesh.position
    assert.ok(p.x >= ARENA_BOUNDS.x[0] && p.x <= ARENA_BOUNDS.x[1])
    assert.ok(p.y >= ARENA_BOUNDS.y[0] && p.y <= ARENA_BOUNDS.y[1])
    assert.ok(p.z >= ARENA_BOUNDS.z[0] && p.z <= ARENA_BOUNDS.z[1])
    target.dispose(scene)
  }
})
