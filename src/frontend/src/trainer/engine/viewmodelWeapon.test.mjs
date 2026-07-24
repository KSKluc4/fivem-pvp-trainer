import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createViewmodelWeapon } from './viewmodelWeapon.js'

test('createViewmodelWeapon returns a Group with a handful of low-poly parts', () => {
  const weapon = createViewmodelWeapon()
  assert.ok(weapon.group instanceof THREE.Group)
  assert.ok(weapon.group.children.length > 0)
  assert.ok(weapon.group.children.length <= 8) // deliberately low-poly
  for (const child of weapon.group.children) {
    assert.ok(child instanceof THREE.Mesh)
    assert.equal(child.castShadow, false)
    assert.equal(child.receiveShadow, false)
  }
})

test('the group sits in the bottom-right, close to the camera (fixed viewmodel offset)', () => {
  const weapon = createViewmodelWeapon()
  assert.ok(weapon.group.position.x > 0) // right
  assert.ok(weapon.group.position.y < 0) // bottom
  assert.ok(weapon.group.position.z < 0) // in front of the camera
})

test('attaching to a camera makes the weapon follow its rotation for free (no per-frame code)', () => {
  const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 100)
  const weapon = createViewmodelWeapon()
  camera.add(weapon.group)
  camera.rotation.set(0.3, 0.5, 0)
  camera.updateMatrixWorld(true)

  const worldPos = new THREE.Vector3()
  weapon.group.getWorldPosition(worldPos)
  // World position should differ from the local offset once the parent
  // camera is rotated — proof the child inherits the transform.
  assert.notEqual(worldPos.x, weapon.group.position.x)
})

test('setVisible toggles group.visible ("Mostrar arma" setting)', () => {
  const weapon = createViewmodelWeapon()
  assert.equal(weapon.group.visible, true)
  weapon.setVisible(false)
  assert.equal(weapon.group.visible, false)
  weapon.setVisible(true)
  assert.equal(weapon.group.visible, true)
})

test('dispose() cleans up geometries/materials without throwing', () => {
  const weapon = createViewmodelWeapon()
  assert.doesNotThrow(() => weapon.dispose())
})

test('no mesh casts or receives shadows (deliberately no shadow rendering cost)', () => {
  const weapon = createViewmodelWeapon()
  const anyShadow = weapon.group.children.some((c) => c.castShadow || c.receiveShadow)
  assert.equal(anyShadow, false)
})
