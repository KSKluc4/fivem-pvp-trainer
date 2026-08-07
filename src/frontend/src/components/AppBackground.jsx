import { useEffect, useRef } from 'react'
import {
  createFluidField,
  createBackgroundLoop,
  shouldAnimate,
  intensityConfig,
  backingScaleFor,
  TARGET_FPS,
  DEFAULT_COLORS,
} from './fluidField'

// Single reusable decorative background — a fluid particle flow field on a 2D
// canvas (Perlin-noise angles + trails; the simulation itself lives in
// fluidField.js). Rendered once in a fixed layer below all content, on every
// screen: the auth flow passes intensity="full", everything inside the app
// gets "subtle" (fewer particles, dimmer). Same contract as the glow/vignette
// version it replaces — see the .app-background rules in index.css.
//
// Performance is the whole design here, because this thing sits behind an
// aim trainer that needs every frame it can get:
//   • the loop is capped at ~30fps via a time accumulator, not free rAF;
//   • it is fully stopped (cancelAnimationFrame, zero work) whenever the
//     window is blurred/hidden or a drill is running (body.trainer-active);
//   • particle count is a density per CSS px² with a hard ceiling;
//   • the backing store is capped at 1.5× DPR *and* a total pixel budget;
//   • prefers-reduced-motion renders one static image and never loops.
const RESIZE_DEBOUNCE_MS = 180
// Simulated frames burned to produce the single reduced-motion image — enough
// for particles to leave their spawn points and grow trails (~3s at 30fps).
const STATIC_FRAMES = 90

function readThemeColors() {
  if (typeof window === 'undefined') return DEFAULT_COLORS
  const css = getComputedStyle(document.documentElement)
  const pick = (name, fallback) => {
    const v = css.getPropertyValue(name).trim()
    return v || fallback
  }
  return {
    primary:    pick('--color-primary',   DEFAULT_COLORS.primary),
    secondary:  pick('--color-secondary', DEFAULT_COLORS.secondary),
    background: pick('--bg-primary',      DEFAULT_COLORS.background),
  }
}

export default function AppBackground({ intensity = 'subtle' }) {
  const hostRef   = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const cfg = intensityConfig(intensity)
    const motionQuery = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null

    // ── The single source of truth for "is the loop allowed to run" ────────
    const state = {
      focused: document.hasFocus(),
      visible: document.visibilityState !== 'hidden',
      trainerActive: document.body.classList.contains('trainer-active'),
      reducedMotion: Boolean(motionQuery && motionQuery.matches),
    }

    let field = null
    let scale = 1
    let cssW = 0
    let cssH = 0
    let resizeTimer = 0

    function measure() {
      const rect = host.getBoundingClientRect()
      // Zero-sized means either layout hasn't settled yet or the layer is
      // display:none (body.trainer-active). Both are "nothing to draw" —
      // callers bail instead of building a 1×1 field they'd rebuild anyway,
      // and the ResizeObserver calls us again once the box is real.
      return { w: Math.round(rect.width), h: Math.round(rect.height) }
    }

    function sync() {
      const { w, h } = measure()
      if (w <= 0 || h <= 0) return false
      scale = backingScaleFor(w, h, window.devicePixelRatio || 1)
      cssW = w
      cssH = h
      canvas.width  = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      canvas.style.width  = `${w}px`
      canvas.style.height = `${h}px`
      // setTransform (not scale) so repeated resizes don't compound.
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      if (!field) {
        field = createFluidField({ width: w, height: h, intensity, colors: readThemeColors() })
      } else {
        field.resize(w, h)
      }
      // Resizing the canvas cleared the bitmap — lay down an opaque base so
      // the first trail slab has something to fade, instead of flashing.
      field.fillBase(ctx)
      return true
    }

    // ── Loop ───────────────────────────────────────────────────────────────
    const loop = createBackgroundLoop({
      raf: (fn) => window.requestAnimationFrame(fn),
      caf: (id) => window.cancelAnimationFrame(id),
      now: () => performance.now(),
      onFrame: (dt) => {
        if (!field) return
        field.step(dt)
        field.paint(ctx)
      },
    })

    // Every listener below mutates `state` and then calls this. Nothing else
    // starts or stops the loop.
    function reconcile() {
      if (shouldAnimate(state)) loop.start()
      else loop.stop()
    }

    function renderStatic() {
      if (!field) return
      // Fast-forward the simulation and paint every frame of it, because the
      // trails *are* the texture — stepping silently and painting once at the
      // end would leave reduced-motion users with bare dots. Same image the
      // animated version settles into, just produced in one synchronous burst
      // and then left alone.
      field.fillBase(ctx)
      for (let i = 0; i < STATIC_FRAMES; i++) {
        field.step(1000 / TARGET_FPS)
        field.paint(ctx)
      }
    }

    canvas.style.opacity = String(cfg.layerOpacity)
    // sync() returning false means the host was zero-sized (layout hasn't
    // settled yet) — the ResizeObserver below will call us again.
    sync()

    if (state.reducedMotion) renderStatic()
    else reconcile()

    // ── Listeners ──────────────────────────────────────────────────────────
    const onFocus  = () => { state.focused = true;  reconcile() }
    const onBlur   = () => { state.focused = false; reconcile() }
    const onVisibility = () => {
      state.visible = document.visibilityState !== 'hidden'
      reconcile()
    }
    const onMotionChange = (e) => {
      state.reducedMotion = e.matches
      if (state.reducedMotion) { loop.stop(); renderStatic() }
      else reconcile()
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    if (motionQuery) {
      if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange)
      else motionQuery.addListener(onMotionChange)          // Safari < 14
    }

    // Drills toggle body.trainer-active for their whole mounted lifetime
    // (useTrainerEngine.js / ExercisePlayer.jsx) — observing that class is
    // enough, no third signal to keep in sync.
    const bodyObserver = new MutationObserver(() => {
      const active = document.body.classList.contains('trainer-active')
      if (active === state.trainerActive) return
      state.trainerActive = active
      if (state.reducedMotion) return
      reconcile()
    })
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] })

    const resizeObserver = new ResizeObserver(() => {
      const { w, h } = measure()
      if (w === cssW && h === cssH) return
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        if (!sync()) return
        if (state.reducedMotion) renderStatic()
      }, RESIZE_DEBOUNCE_MS)
    })
    resizeObserver.observe(host)

    return () => {
      loop.stop()
      window.clearTimeout(resizeTimer)
      resizeObserver.disconnect()
      bodyObserver.disconnect()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      if (motionQuery) {
        if (motionQuery.removeEventListener) motionQuery.removeEventListener('change', onMotionChange)
        else motionQuery.removeListener(onMotionChange)
      }
      field = null
    }
  }, [intensity])

  return (
    <div
      ref={hostRef}
      className={`app-background app-background--${intensity}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="app-background__canvas" />
    </div>
  )
}
