import { BG_COLOR, GRID_MAIN, GRID_THIN } from './theme2d.js'

const GRID_STEP = 48

// 2D canvas setup for the drill arena — the Canvas2D analogue of
// engine/scene.js's createArenaScene. DPR-aware sizing (capped at 2x, same
// cap the old WebGL renderer used) driven by a ResizeObserver on the
// container rather than window.resize — a panel embedded in the app shell
// can change size without the window itself resizing (nav collapse, etc.),
// and pixel-accurate cursor-to-canvas mapping needs that.
export function createArena2D(canvas, container) {
  const ctx = canvas.getContext('2d')
  let cssW = 0
  let cssH = 0

  function resize(width, height) {
    if (width <= 0 || height <= 0) return
    cssW = width
    cssH = height
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width  = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    // Resizing the backing store resets all 2D context state, including any
    // transform — must be re-applied every time so draw calls and the
    // cursor tracker's reported position stay in the same CSS-pixel space.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    const { width, height } = entry.contentRect
    resize(width, height)
  })
  resizeObserver.observe(container)
  // Synchronous initial size in case the first ResizeObserver callback is
  // deferred to a later frame — avoids a 0x0 canvas on first paint.
  resize(container.clientWidth, container.clientHeight)

  function clearAndDrawBackground() {
    ctx.clearRect(0, 0, cssW, cssH)
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, cssW, cssH)

    // Faint radial lightening toward the center — a cheap 2D echo of the
    // old arena's lit floor, giving the "leve profundidade" the spec asks for.
    const gradient = ctx.createRadialGradient(
      cssW / 2, cssH / 2, 0,
      cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.7,
    )
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.035)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, cssW, cssH)

    ctx.save()
    ctx.strokeStyle = GRID_THIN
    ctx.lineWidth   = 1
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    for (let x = GRID_STEP; x < cssW; x += GRID_STEP) { ctx.moveTo(x, 0); ctx.lineTo(x, cssH) }
    for (let y = GRID_STEP; y < cssH; y += GRID_STEP) { ctx.moveTo(0, y); ctx.lineTo(cssW, y) }
    ctx.stroke()

    // Faint center cross — a decorative anchor, echoes the old arena's wall
    // accent strip marking the arena's "center".
    ctx.strokeStyle = GRID_MAIN
    ctx.globalAlpha = 0.3
    ctx.beginPath()
    ctx.moveTo(0, cssH / 2); ctx.lineTo(cssW, cssH / 2)
    ctx.moveTo(cssW / 2, 0); ctx.lineTo(cssW / 2, cssH)
    ctx.stroke()
    ctx.restore()
  }

  function getSize() {
    return { width: cssW, height: cssH }
  }

  function dispose() {
    resizeObserver.disconnect()
  }

  return { ctx, resize, clearAndDrawBackground, getSize, dispose }
}
