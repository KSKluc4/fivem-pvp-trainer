// Raw, unsmoothed mouse-look: applies movementX/movementY directly to camera
// rotation every mousemove event — no lerp/easing/acceleration curve. This
// is deliberate: any smoothing would break 1:1 fidelity with the sensitivity
// the player is used to from GTA V. There is no axis-invert concept here —
// the GTA sensitivity value is a speed dial (negative = slower, positive =
// faster), never a Y-axis flip; see services/sensitivityMath.js.
const PITCH_LIMIT = Math.PI / 2 - 0.01 // just under 90° — avoids gimbal flip at the poles

// getDegPerCount is a function (not a fixed number) so a live fine-tune
// slider can change sensitivity mid-session without re-attaching listeners.
//
// onSample is an optional zero-arg callback fired after camera.rotation is
// updated on every mousemove event — added so the sensitivity-discovery
// test can sample the camera's actual orientation at native mouse-event
// resolution (higher than the render loop's frame rate) for its flick/
// tracking instrumentation. It never changes what gets written to
// camera.rotation, so every existing caller that omits it behaves
// byte-for-byte as before.
export function createPointerLook(camera, { getDegPerCount, onSample } = {}) {
  let yaw   = 0
  let pitch = 0

  function onMouseMove(e) {
    const radPerCount = getDegPerCount() * (Math.PI / 180)

    yaw   -= e.movementX * radPerCount
    pitch -= e.movementY * radPerCount
    pitch  = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch))

    camera.rotation.x = pitch
    camera.rotation.y = yaw

    if (onSample) onSample()
  }

  function attach() {
    document.addEventListener('mousemove', onMouseMove)
  }

  function detach() {
    document.removeEventListener('mousemove', onMouseMove)
  }

  function reset() {
    yaw = 0
    pitch = 0
    camera.rotation.x = 0
    camera.rotation.y = 0
  }

  return { attach, detach, reset }
}
