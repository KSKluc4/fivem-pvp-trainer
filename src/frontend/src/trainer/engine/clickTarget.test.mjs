import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { ClickTarget, ClickScorer } from './clickTarget.js'

function fixedSpawn(point) {
  return () => point.clone()
}

test('ClickTarget spawns at the position returned by spawnPosition', () => {
  const scene = new THREE.Scene()
  const p = new THREE.Vector3(1, 2, -3)
  const target = new ClickTarget(scene, { spawnPosition: fixedSpawn(p), radius: 0.3 })
  assert.equal(target.mesh.position.x, 1)
  assert.equal(target.mesh.position.y, 2)
  assert.equal(target.mesh.position.z, -3)
  assert.equal(scene.children.includes(target.mesh), true)
})

test('ClickTarget.update accumulates timeAliveMs', () => {
  const scene = new THREE.Scene()
  const target = new ClickTarget(scene, { spawnPosition: fixedSpawn(new THREE.Vector3()), radius: 0.3 })
  target.update(16)
  target.update(16)
  assert.equal(target.timeAliveMs, 32)
})

test('ClickTarget.respawn resets timeAliveMs and moves to a new spawnPosition', () => {
  const scene = new THREE.Scene()
  let call = 0
  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 5, -5)]
  const target = new ClickTarget(scene, { spawnPosition: () => points[call++], radius: 0.3 })
  target.update(500)
  target.respawn()
  assert.equal(target.timeAliveMs, 0)
  assert.equal(target.mesh.position.x, 5)
  assert.equal(target.mesh.position.z, -5)
})

test('ClickTarget.dispose removes the mesh from the scene', () => {
  const scene = new THREE.Scene()
  const target = new ClickTarget(scene, { spawnPosition: fixedSpawn(new THREE.Vector3()), radius: 0.3 })
  target.dispose(scene)
  assert.equal(scene.children.includes(target.mesh), false)
})

test('ClickScorer starts at zero score/accuracy with no shots fired', () => {
  const scorer = new ClickScorer()
  assert.equal(scorer.score, 0)
  assert.equal(scorer.accuracyPct, 0)
  assert.equal(scorer.avgReactionMs, 0)
  assert.equal(scorer.bestStreakMs, 0)
})

test('ClickScorer.score counts only hits, accuracy is hits/shotsFired', () => {
  const scorer = new ClickScorer()
  scorer.registerShot(true, 200)
  scorer.registerShot(false, 0)
  scorer.registerShot(true, 400)
  scorer.registerShot(false, 0)
  assert.equal(scorer.score, 2)
  assert.equal(scorer.shotsFired, 4)
  assert.equal(scorer.accuracyPct, 50)
})

test('ClickScorer.avgReactionMs only averages reaction times from hits', () => {
  const scorer = new ClickScorer()
  scorer.registerShot(true, 100)
  scorer.registerShot(false, 999) // miss — reaction time not counted
  scorer.registerShot(true, 300)
  assert.equal(scorer.avgReactionMs, 200)
})
