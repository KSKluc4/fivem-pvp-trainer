// Minimal requestAnimationFrame loop with a lightweight FPS estimate,
// decoupled from React so the render loop never waits on a React re-render.
export function createLoop(onFrame) {
  let rafId          = null
  let lastTime        = null
  let fpsWindowStart  = null
  let fpsFrameCount    = 0
  let fps             = 0

  function tick(now) {
    if (lastTime == null) { lastTime = now; fpsWindowStart = now }
    // Clamp dt so a tab switch / breakpoint doesn't cause a giant jump.
    const dt = Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now

    fpsFrameCount++
    const windowElapsed = now - fpsWindowStart
    if (windowElapsed >= 250) {
      fps = Math.round((fpsFrameCount * 1000) / windowElapsed)
      fpsFrameCount = 0
      fpsWindowStart = now
    }

    onFrame(dt, fps)
    rafId = requestAnimationFrame(tick)
  }

  function start() {
    lastTime = null
    rafId = requestAnimationFrame(tick)
  }

  function stop() {
    if (rafId != null) cancelAnimationFrame(rafId)
    rafId = null
  }

  return { start, stop }
}
