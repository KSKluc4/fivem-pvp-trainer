import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { randRange, clampToArenaBounds, randomPointInBounds, pointNearForward } from './spawn.js'
import { ARENA_BOUNDS } from './scene.js'

function inBounds(v) {
  return v.x >= ARENA_BOUNDS.x[0] && v.x <= ARENA_BOUNDS.x[1]
      && v.y >= ARENA_BOUNDS.y[0] && v.y <= ARENA_BOUNDS.y[1]
      && v.z >= ARENA_BOUNDS.z[0] && v.z <= ARENA_BOUNDS.z[1]
}

test('randRange stays within [min, max]', () => {
  for (let i = 0; i < 200; i++) {
    const v = randRange([2, 5])
    assert.ok(v >= 2 && v <= 5)
  }
})

test('clampToArenaBounds pulls an out-of-bounds point back to the nearest edge', () => {
  const v = clampToArenaBounds(new THREE.Vector3(999, -999, 999))
  assert.equal(v.x, ARENA_BOUNDS.x[1])
  assert.equal(v.y, ARENA_BOUNDS.y[0])
  assert.equal(v.z, ARENA_BOUNDS.z[1])
})

test('clampToArenaBounds leaves an already-valid point untouched', () => {
  const v = clampToArenaBounds(new THREE.Vector3(0, 2, -7))
  assert.equal(v.x, 0)
  assert.equal(v.y, 2)
  assert.equal(v.z, -7)
})

test('randomPointInBounds always lands inside ARENA_BOUNDS', () => {
  for (let i = 0; i < 200; i++) {
    assert.ok(inBounds(randomPointInBounds()))
  }
})

test('pointNearForward always lands inside ARENA_BOUNDS regardless of camera orientation', () => {
  const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 100)
  camera.position.set(0, 1.7, 0)
  camera.rotation.order = 'YXZ'
  for (let i = 0; i < 50; i++) {
    camera.rotation.y = (Math.random() - 0.5) * Math.PI * 2
    camera.rotation.x = (Math.random() - 0.5) * 1.4
    const p = pointNearForward(camera, [1, 3])
    assert.ok(inBounds(p), `point out of bounds: ${JSON.stringify(p)}`)
  }
})

test('pointNearForward moves further from the forward base point as distanceRange grows', () => {
  const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 100)
  camera.position.set(0, 1.7, 0)
  camera.rotation.order = 'YXZ'
  camera.rotation.set(0, 0, 0)

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  const base = camera.position.clone().addScaledVector(forward, 7.5)

  const near = pointNearForward(camera, [0.1, 0.15])
  const far  = pointNearForward(camera, [3.5, 4])

  // Both are unclamped here (well within ARENA_BOUNDS from the arena's
  // center), so the distance-from-base ordering holds directly.
  assert.ok(near.distanceTo(base) < far.distanceTo(base))
})
