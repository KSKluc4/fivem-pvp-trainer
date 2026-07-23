import { useState, useEffect, useRef, useCallback } from 'react'
import { createArenaScene } from './scene'
import { createLoop } from './loop'
import { createPointerLook } from './pointerLook'

// Shared mount-once engine plumbing behind both ExercisePlayer and
// DiscoveryPlayer: canvas/renderer/scene/camera lifecycle, resize, the
// pointer-lock lifecycle (attach/detach + pause-on-unlock/resume-on-lock),
// the rAF render loop, the 3-2-1 countdown ticker, and the 'trainer-active'
// body class. Callers own everything scenario-specific (target/scorer refs,
// click handling, HUD shape) via `onFrame`/`onStart`/`onUnmount` — this hook
// never reads or writes those.
//
// `startPhases`: phase names where acquiring pointer lock should call
// onStart() (e.g. ExercisePlayer: ['setup', 'results'], DiscoveryPlayer:
// ['ready']). Any other phase falls through to the shared paused/resume
// handling below, exactly as before the extraction.
export function useTrainerEngine({
  initialPhase,
  startPhases,
  onStart,
  onFrame,
  onUnmount,
  getDegPerCount,
  onPointerSample,
}) {
  const canvasRef      = useRef(null)
  const containerRef   = useRef(null)
  const engineRef      = useRef(null)
  const phaseRef       = useRef(initialPhase)
  const resumePhaseRef = useRef('playing')

  const [phase, setPhase]           = useState(initialPhase)
  const [countdownN, setCountdownN] = useState(3)

  useEffect(() => { phaseRef.current = phase }, [phase])

  const resumeFromPause = useCallback(() => {
    if (resumePhaseRef.current === 'countdown') {
      setCountdownN(3)
      setPhase('countdown')
    } else {
      setPhase('playing')
    }
  }, [])

  // Mirrored every render so the mount-once effect below always calls the
  // latest version — same pattern the two players already used for their
  // own callbacks (startRound/advanceRound/etc.), just centralized here too.
  const onStartRef          = useRef(onStart)
  const onFrameRef          = useRef(onFrame)
  const onUnmountRef        = useRef(onUnmount)
  const resumeFromPauseRef  = useRef(resumeFromPause)
  onStartRef.current         = onStart
  onFrameRef.current         = onFrame
  onUnmountRef.current       = onUnmount
  resumeFromPauseRef.current = resumeFromPause

  useEffect(() => {
    const canvas = canvasRef.current
    const { renderer, scene, camera, resize, dispose } = createArenaScene(canvas)
    const pointerLook = createPointerLook(camera, { getDegPerCount, onSample: onPointerSample })

    function handleResize() {
      const el = containerRef.current
      if (el) resize(el.clientWidth, el.clientHeight)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    function onPointerLockChange() {
      const locked = document.pointerLockElement === canvas
      if (locked) {
        pointerLook.attach()
        if (startPhases.includes(phaseRef.current)) onStartRef.current()
        else if (phaseRef.current === 'paused') resumeFromPauseRef.current()
      } else {
        pointerLook.detach()
        if (phaseRef.current === 'playing' || phaseRef.current === 'countdown') {
          resumePhaseRef.current = phaseRef.current
          setPhase('paused')
        }
      }
    }
    document.addEventListener('pointerlockchange', onPointerLockChange)

    const loop = createLoop((dt, fps) => {
      onFrameRef.current(dt, fps)
      renderer.render(scene, camera)
    })
    loop.start()

    engineRef.current = { renderer, scene, camera }

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      window.removeEventListener('resize', handleResize)
      loop.stop()
      pointerLook.detach()
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      // Runs BEFORE dispose()/nulling engineRef, so a caller's onUnmount can
      // still safely read engineRef.current.scene (e.g. to dispose its own
      // target mesh) — see ExercisePlayer/DiscoveryPlayer.
      onUnmountRef.current?.()
      dispose()
      engineRef.current = null
    }
    // Intentionally mount once — phase/target progression is driven entirely
    // through refs (see onStartRef/onFrameRef etc.) so the WebGL context is
    // never torn down mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 3-2-1 countdown ticker
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdownN <= 0) { setPhase('playing'); return }
    const timer = setTimeout(() => setCountdownN((n) => n - 1), 800)
    return () => clearTimeout(timer)
  }, [phase, countdownN])

  // The canvas renders continuously (60fps rAF loop) for this component's
  // whole lifetime, not just the 'playing' phase — hide the decorative
  // AppBackground behind it so it isn't animating/compositing for nothing.
  useEffect(() => {
    document.body.classList.add('trainer-active')
    return () => document.body.classList.remove('trainer-active')
  }, [])

  return { canvasRef, containerRef, engineRef, phase, setPhase, phaseRef, countdownN, setCountdownN }
}
