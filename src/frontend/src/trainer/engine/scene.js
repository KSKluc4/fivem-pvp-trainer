import * as THREE from 'three'

// Arena bounds the moving target is confined to — roughly in front of the
// fixed camera position, never behind or too close.
export const ARENA_BOUNDS = {
  x: [-5, 5],
  y: [0.8, 3.6],
  z: [-11, -4],
}

const BG_COLOR   = '#080810' // theme.js dark[9]
const WALL_COLOR = '#10101c' // theme.js dark[8]
const GRID_MAIN   = '#33334d' // theme.js dark[5]
const GRID_THIN   = '#1c1c30'
const ACCENT      = '#00d4ff' // brandCyan

// Renderer/scene/camera setup for the tracking arena. Deliberately minimal —
// no shadows, no post-processing, one directional + one ambient light — so
// a mid-range GPU comfortably clears 144fps.
export function createArenaScene(canvas, { antialias = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias,
    powerPreference: 'high-performance',
    alpha: false,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = false

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG_COLOR)
  scene.fog = new THREE.Fog(BG_COLOR, 14, 26)

  const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 100)
  camera.position.set(0, 1.7, 0)
  camera.rotation.order = 'YXZ'

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 1, metalness: 0 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  const floorGrid = new THREE.GridHelper(40, 40, GRID_MAIN, GRID_THIN)
  floorGrid.position.y = 0.01
  scene.add(floorGrid)

  // Back wall, positioned just beyond the arena's far Z bound
  const wallZ = ARENA_BOUNDS.z[0] - 4
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 16),
    new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 1, metalness: 0 }),
  )
  wall.position.set(0, 8, wallZ)
  scene.add(wall)

  const wallGrid = new THREE.GridHelper(40, 40, GRID_MAIN, GRID_THIN)
  wallGrid.rotation.x = Math.PI / 2
  wallGrid.position.set(0, 8, wallZ + 0.02)
  scene.add(wallGrid)

  // Subtle accent strip on the wall to mark the arena's "center" — a visual
  // anchor, purely decorative.
  const accentStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 0.05),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.35 }),
  )
  accentStrip.position.set(0, 1.7, wallZ + 0.03)
  scene.add(accentStrip)

  scene.add(new THREE.AmbientLight('#8892a4', 0.7))
  const dirLight = new THREE.DirectionalLight('#ffffff', 0.9)
  dirLight.position.set(4, 10, 6)
  scene.add(dirLight)

  function resize(width, height) {
    camera.aspect = width / Math.max(height, 1)
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  function dispose() {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
        else obj.material.dispose()
      }
    })
    renderer.dispose()
  }

  return { renderer, scene, camera, resize, dispose }
}
