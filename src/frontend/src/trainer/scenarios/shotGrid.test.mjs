import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { EXERCISE_ID, SESSION_DURATION_S, DIFFICULTIES, createTarget } from './shotGrid.js'
import { ARENA_BOUNDS } from '../engine/scene.js'

test('exercise metadata', () => {
  assert.equal(EXERCISE_ID, 'shot_grid')
  assert.equal(SESSION_DURATION_S, 60)
  assert.deepEqual(Object.keys(DIFFICULTIES), ['facil', 'medio', 'dificil'])
})

test('no timeout at any difficulty — waits for the click', () => {
  for (const key of Object.keys(DIFFICULTIES)) {
    assert.equal(DIFFICULTIES[key].timeoutMs, null)
  }
})

test('target radius shrinks as difficulty increases', () => {
  assert.ok(DIFFICULTIES.facil.radius > DIFFICULTIES.medio.radius)
  assert.ok(DIFFICULTIES.medio.radius > DIFFICULTIES.dificil.radius)
})

test('createTarget spawns inside ARENA_BOUNDS at a fixed depth', () => {
  const scene = new THREE.Scene()
  for (let i = 0; i < 30; i++) {
    const target = createTarget(scene, 'medio')
    const p = target.mesh.position
    assert.ok(p.x >= ARENA_BOUNDS.x[0] && p.x <= ARENA_BOUNDS.x[1])
    assert.ok(p.y >= ARENA_BOUNDS.y[0] && p.y <= ARENA_BOUNDS.y[1])
    assert.ok(p.z >= ARENA_BOUNDS.z[0] && p.z <= ARENA_BOUNDS.z[1])
    target.dispose(scene)
  }
})

test('createTarget respawn keeps the target on the same fixed Z depth', () => {
  const scene = new THREE.Scene()
  const target = createTarget(scene, 'medio')
  const z1 = target.mesh.position.z
  target.respawn()
  const z2 = target.mesh.position.z
  assert.equal(z1, z2)
})
