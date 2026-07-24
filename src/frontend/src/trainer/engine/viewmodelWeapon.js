import * as THREE from 'three'

// A static, low-poly pistol viewmodel attached to the camera in the bottom
// right of the view. Deliberately minimal — 5 flat-shaded boxes, no
// animation, no shadows (MeshBasicMaterial skips lighting entirely) — FPS
// impact is indistinguishable from zero. Being a child of the camera means
// it inherits the camera's rotation for free every frame, no per-frame code
// needed to "follow" the view.
//
// 100% procedural geometry — no third-party model, see assets/CREDITS.md.
const BODY_COLOR = '#2a2a30'
const SLIDE_COLOR = '#3c3c46'
const ACCENT_COLOR = '#00d4ff'

export function createViewmodelWeapon() {
  const group = new THREE.Group()
  group.name = 'viewmodel-weapon'

  const bodyMat = new THREE.MeshBasicMaterial({ color: BODY_COLOR })
  const slideMat = new THREE.MeshBasicMaterial({ color: SLIDE_COLOR })
  const accentMat = new THREE.MeshBasicMaterial({ color: ACCENT_COLOR })
  const materials = [bodyMat, slideMat, accentMat]
  const geometries = []

  function addPart(geometry, material, position, rotation) {
    geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.position.set(position[0], position[1], position[2])
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2])
    group.add(mesh)
    return mesh
  }

  addPart(new THREE.BoxGeometry(0.05, 0.05, 0.22), slideMat, [0, 0.04, -0.11])       // slide/barrel
  addPart(new THREE.BoxGeometry(0.045, 0.06, 0.14), bodyMat, [0, 0, -0.05])          // frame
  addPart(new THREE.BoxGeometry(0.04, 0.11, 0.05), bodyMat, [0, -0.07, 0.02], [0.25, 0, 0]) // grip
  addPart(new THREE.BoxGeometry(0.035, 0.02, 0.06), bodyMat, [0, -0.015, -0.01])     // trigger guard
  addPart(new THREE.BoxGeometry(0.008, 0.012, 0.008), accentMat, [0, 0.075, -0.2])   // front sight accent

  // Fixed offset from the camera — bottom-right of the view, deliberately
  // never animated (no recoil/sway, out of scope).
  group.position.set(0.16, -0.16, -0.32)
  group.rotation.set(0, THREE.MathUtils.degToRad(-6), 0)

  // Sitting this close to the camera, default frustum-sphere culling can pop
  // it out near screen edges when looking around fast — it's 5 tiny boxes,
  // never culling it costs nothing.
  group.traverse((obj) => { obj.frustumCulled = false })

  function setVisible(visible) {
    group.visible = visible
  }

  function dispose() {
    geometries.forEach((g) => g.dispose())
    materials.forEach((m) => m.dispose())
  }

  return { group, setVisible, dispose }
}
