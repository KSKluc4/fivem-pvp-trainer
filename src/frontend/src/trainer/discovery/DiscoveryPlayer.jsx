import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { Box, Button, Text, Card } from '@mantine/core'
import { IconArrowLeft, IconPlayerPlay } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useTrainerEngine } from '../engine/useTrainerEngine'
import { ClickTarget } from '../engine/clickTarget'
import { pointNearForward } from '../engine/spawn'
import { DIFFICULTIES as QUICK_FLICK_DIFFICULTIES } from '../scenarios/quickFlick.js'
import { SmoothTarget } from '../scenarios/trackingSmooth.js'
import Crosshair from '../hud/Crosshair'
import { loadTrainerSensSettings, effectiveDegPerCount } from '../sensitivity/trainerSensitivity'
import { analyzeFlick } from './flickAnalysis.js'
import { TrackingDiscoveryScorer } from './trackingAnalysis.js'
import '../trainer.css'

const CENTER_NDC = new THREE.Vector2(0, 0)
const FORWARD = new THREE.Vector3(0, 0, -1)

// 3 flick rounds + 2 tracking rounds, in that order — same tuning as the
// regular "Flick Rápido"/"Tracking Suave" drills at 'medio' difficulty (same
// engine, same feel, just instrumented and run at a fixed shorter duration).
const ROUND_DURATION_S = 30
const STEPS = [
  { kind: 'flick' }, { kind: 'flick' }, { kind: 'flick' },
  { kind: 'tracking' }, { kind: 'tracking' },
]
const FLICK_CFG = QUICK_FLICK_DIFFICULTIES.medio
const TRACKING_ROUNDS_TOTAL = STEPS.filter((s) => s.kind === 'tracking').length
// A tracking round only counts toward the aggregate if the player was
// actually engaged (pointer locked, phase 'playing') for at least half of
// it — a round mostly spent paused/disengaged is too thin to trust and
// would otherwise carry the same full weight as a complete one.
const MIN_TRACKING_COVERAGE_MS = ROUND_DURATION_S * 1000 * 0.5

function forwardVector(camera) {
  return FORWARD.clone().applyQuaternion(camera.quaternion)
}

// Unsigned angle (degrees) from the camera's current forward direction to
// a world-space point.
function angleToDeg(camera, targetPos) {
  const toTarget = targetPos.clone().sub(camera.position).normalize()
  return THREE.MathUtils.radToDeg(forwardVector(camera).angleTo(toTarget))
}

// Same unsigned angle, plus a SIGNED horizontal angle (positive = target is
// to the right of center) used only to detect the crosshair crossing the
// target's line of travel — see trackingAnalysis.js.
function angularOffsets(camera, targetPos) {
  const local = camera.worldToLocal(targetPos.clone())
  const lateralDeg = THREE.MathUtils.radToDeg(Math.atan2(local.x, -local.z))
  const errorDeg = angleToDeg(camera, targetPos)
  return { errorDeg, lateralDeg }
}

// Runs the fixed 5-round sensitivity-discovery sequence on the SAME engine
// (scene/loop/pointer-look/spawn primitives) the regular drills use, at the
// user's current sens/DPI — this component only adds instrumentation, it
// never changes movement/rotation behavior. Reports the raw aggregated
// metrics via `onComplete`; verdict.js turns those into a recommendation.
export default function DiscoveryPlayer({ onComplete, onBack }) {
  const { t } = useTranslation()

  const targetRef    = useRef(null)
  const elapsedRef   = useRef(0)
  const stepIndexRef = useRef(0)
  const sensRef      = useRef(loadTrainerSensSettings())

  const flickAttemptRef   = useRef({ targetPos: null, trueAngleDeg: 0, prevAngleDeg: 0, spawnMs: 0, samples: [] })
  const flickResultsRef   = useRef({ ratios: [], correctionTimesMs: [] })
  const trackingScorerRef = useRef(null)
  const trackingResultsRef = useRef({ oscillationsHz: [], avgErrorsDeg: [], lagBiasDeg: [] })

  const [hud, setHud] = useState({ timeLeft: ROUND_DURATION_S, round: 1, fps: 0 })

  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const startFlickAttempt = useCallback((camera, targetPos) => {
    const trueAngleDeg = angleToDeg(camera, targetPos)
    flickAttemptRef.current = {
      targetPos: targetPos.clone(),
      trueAngleDeg,
      prevAngleDeg: trueAngleDeg,
      spawnMs: performance.now(),
      samples: [],
    }
  }, [])

  const finalizeFlickAttempt = useCallback(() => {
    const attempt = flickAttemptRef.current
    if (!attempt.targetPos) return
    const result = analyzeFlick(attempt.samples, attempt.trueAngleDeg)
    if (result) {
      flickResultsRef.current.ratios.push(result.ratio)
      flickResultsRef.current.correctionTimesMs.push(result.correctionTimeMs)
    }
    attempt.targetPos = null
  }, [])

  const startRound = useCallback((idx) => {
    const engine = engineRef.current
    if (!engine) return
    const step = STEPS[idx]
    if (targetRef.current) { targetRef.current.dispose(engine.scene); targetRef.current = null }

    if (step.kind === 'flick') {
      targetRef.current = new ClickTarget(engine.scene, {
        spawnPosition: () => pointNearForward(engine.camera, FLICK_CFG.distanceRange),
        radius: FLICK_CFG.radius,
      })
      // trueAngleDeg is intentionally NOT captured here — the 3-2-1 countdown
      // gives the player time to keep re-aiming before scoring starts, so it
      // would go stale. The playing-transition effect below captures it the
      // instant the round actually begins instead.
    } else {
      targetRef.current = new SmoothTarget(engine.scene, 'medio')
      trackingScorerRef.current = new TrackingDiscoveryScorer()
    }

    stepIndexRef.current = idx
    elapsedRef.current = 0
    setCountdownN(3)
    setHud({ timeLeft: ROUND_DURATION_S, round: idx + 1, fps: 0 })
    setPhase('countdown')
  }, [])

  const finishAll = useCallback(() => {
    setPhase('finished')
    if (document.pointerLockElement) document.exitPointerLock()
    onCompleteRef.current?.({
      flickRatios: flickResultsRef.current.ratios,
      correctionTimesMs: flickResultsRef.current.correctionTimesMs,
      trackingOscillationsHz: trackingResultsRef.current.oscillationsHz,
      trackingLagBiasDeg: trackingResultsRef.current.lagBiasDeg,
      trackingAvgErrorsDeg: trackingResultsRef.current.avgErrorsDeg,
      trackingRoundsAttempted: TRACKING_ROUNDS_TOTAL,
    })
  }, [])

  const advanceRound = useCallback(() => {
    const step = STEPS[stepIndexRef.current]
    if (step.kind === 'flick') {
      finalizeFlickAttempt()
    } else {
      const scorer = trackingScorerRef.current
      // Discard rounds where the player wasn't actually engaged for most of
      // it (heavy pausing, disengagement) — see MIN_TRACKING_COVERAGE_MS.
      if (scorer && scorer.totalMs >= MIN_TRACKING_COVERAGE_MS) {
        if (scorer.crossingsPerSecond != null) trackingResultsRef.current.oscillationsHz.push(scorer.crossingsPerSecond)
        if (scorer.avgErrorDeg != null) trackingResultsRef.current.avgErrorsDeg.push(scorer.avgErrorDeg)
        if (scorer.avgLagBiasDeg != null) trackingResultsRef.current.lagBiasDeg.push(scorer.avgLagBiasDeg)
      }
    }

    const nextIdx = stepIndexRef.current + 1
    if (nextIdx >= STEPS.length) {
      const engine = engineRef.current
      if (targetRef.current && engine) { targetRef.current.dispose(engine.scene); targetRef.current = null }
      finishAllRef.current()
      return
    }
    startRoundRef.current(nextIdx)
  }, [finalizeFlickAttempt])

  // The engine effect (inside useTrainerEngine) closes over whatever these
  // were on the FIRST render — refs keep it calling the latest version.
  const startRoundRef   = useRef(startRound)
  const advanceRoundRef = useRef(advanceRound)
  const finishAllRef    = useRef(finishAll)
  const finalizeFlickRef = useRef(finalizeFlickAttempt)
  const startFlickRef   = useRef(startFlickAttempt)
  startRoundRef.current    = startRound
  advanceRoundRef.current  = advanceRound
  finishAllRef.current     = finishAll
  finalizeFlickRef.current = finalizeFlickAttempt
  startFlickRef.current    = startFlickAttempt

  // Samples the camera's actual orientation at native mouse-event resolution
  // (higher than the render loop's frame rate) for the flick instrumentation
  // — see pointerLook.js's onSample. Stable (empty deps, refs-only) so the
  // engine hook's single pointerLook instance never goes stale.
  const handlePointerSample = useCallback(() => {
    const camera = engineRef.current?.camera
    if (!camera) return
    if (phaseRef.current !== 'playing') return
    if (STEPS[stepIndexRef.current].kind !== 'flick') return
    const attempt = flickAttemptRef.current
    if (!attempt.targetPos) return
    const angleNow = angleToDeg(camera, attempt.targetPos)
    attempt.samples.push({ tMs: performance.now() - attempt.spawnMs, dProgressDeg: attempt.prevAngleDeg - angleNow })
    attempt.prevAngleDeg = angleNow
  }, [])

  const onFrame = useCallback((dt, fps) => {
    const engine = engineRef.current
    if (phaseRef.current === 'playing' && targetRef.current && engine) {
      const step = STEPS[stepIndexRef.current]
      const target = targetRef.current
      if (step.kind === 'tracking') {
        target.update(dt)
        const { errorDeg, lateralDeg } = angularOffsets(engine.camera, target.mesh.position)
        trackingScorerRef.current?.update(dt * 1000, errorDeg, lateralDeg)
      } else {
        target.update(dt * 1000)
        if (FLICK_CFG.timeoutMs && target.timeAliveMs >= FLICK_CFG.timeoutMs) {
          finalizeFlickRef.current()
          target.respawn()
          startFlickRef.current(engine.camera, target.mesh.position)
        }
      }
      elapsedRef.current += dt
      const timeLeft = Math.max(0, ROUND_DURATION_S - elapsedRef.current)
      setHud({ timeLeft, round: stepIndexRef.current + 1, fps })
      if (timeLeft <= 0) advanceRoundRef.current()
    } else {
      setHud((h) => (h.fps === fps ? h : { ...h, fps }))
    }
  }, [])

  const onStart = useCallback(() => {
    startRoundRef.current(0)
  }, [])

  const onUnmount = useCallback(() => {
    const engine = engineRef.current
    if (targetRef.current && engine) targetRef.current.dispose(engine.scene)
  }, [])

  const {
    canvasRef, containerRef, engineRef, phase, setPhase, phaseRef, countdownN, setCountdownN,
  } = useTrainerEngine({
    initialPhase: 'ready',
    startPhases: ['ready'],
    onStart,
    onFrame,
    onUnmount,
    getDegPerCount: () => effectiveDegPerCount(sensRef.current),
    onPointerSample: handlePointerSample,
  })

  // Click-to-hit for flick rounds — a separate mount-once effect from the
  // shared engine plumbing (useTrainerEngine), since hit-testing is specific
  // to this player (DiscoveryPlayer only scores flick rounds via click).
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const raycaster = new THREE.Raycaster()

    function onCanvasClick() {
      const engine = engineRef.current
      if (!engine) return
      if (phaseRef.current !== 'playing') return
      if (STEPS[stepIndexRef.current].kind !== 'flick') return
      if (document.pointerLockElement !== canvas) return
      const target = targetRef.current
      if (!target) return
      raycaster.setFromCamera(CENTER_NDC, engine.camera)
      const hit = raycaster.intersectObject(target.mesh, false)
      finalizeFlickRef.current()
      if (hit.length > 0) target.respawn()
      startFlickRef.current(engine.camera, target.mesh.position)
    }
    canvas.addEventListener('click', onCanvasClick)
    return () => canvas.removeEventListener('click', onCanvasClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fires the instant a round actually starts scoring (including resuming
  // after a pause) — see the comment in startRound about why the flick
  // attempt's trueAngleDeg can't be captured any earlier.
  useEffect(() => {
    if (phase !== 'playing') return
    const engine = engineRef.current
    const target = targetRef.current
    if (!engine || !target) return
    if (STEPS[stepIndexRef.current].kind === 'flick') {
      startFlickRef.current(engine.camera, target.mesh.position)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const active = phase === 'countdown' || phase === 'playing' || phase === 'paused'
  const roundKindKey = STEPS[Math.min(hud.round - 1, STEPS.length - 1)].kind === 'flick'
    ? 'sensibilidade.descoberta.rodada_flick'
    : 'sensibilidade.descoberta.rodada_tracking'

  return (
    <Box className="trainer-view">
      <div ref={containerRef} className="trainer-canvas-wrap">
        <canvas ref={canvasRef} className="trainer-canvas" />

        {active && <Crosshair style="cross-dot" />}

        {active && (
          <>
            <div style={{
              position: 'absolute', top: 16, left: 16, color: '#e8e8f0',
              fontWeight: 800, fontSize: 26, fontFamily: 'monospace', textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}>
              {String(Math.ceil(hud.timeLeft)).padStart(2, '0')}s
            </div>
            <div style={{
              position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
              color: '#e8e8f0', fontFamily: 'monospace', textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {t('sensibilidade.descoberta.rodada_progresso', { current: hud.round, total: STEPS.length })}
              </div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>{t(roundKindKey)}</div>
            </div>
            <div style={{
              position: 'absolute', top: 16, right: 16, fontSize: 11,
              color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace',
            }}>
              {hud.fps} FPS
            </div>
          </>
        )}

        {phase === 'ready' && (
          <div className="trainer-overlay">
            <Card className="trainer-setup-card">
              <Text size="sm" mb="md" ta="center">{t('sensibilidade.descoberta.pronto_para_comecar')}</Text>
              <Button
                size="md"
                leftSection={<IconPlayerPlay size={18} />}
                onClick={() => canvasRef.current?.requestPointerLock()}
              >
                {t('sensibilidade.descoberta.iniciar_rodada')}
              </Button>
              <Button variant="subtle" color="gray" mt="sm" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
                {t('sensibilidade.descoberta.cancelar')}
              </Button>
            </Card>
          </div>
        )}

        {phase === 'countdown' && (
          <div className="trainer-overlay trainer-overlay--countdown">
            <Text className="trainer-countdown-number">{countdownN > 0 ? countdownN : t('trainer.vai')}</Text>
          </div>
        )}

        {phase === 'paused' && (
          <div
            className="trainer-overlay trainer-overlay--clickable"
            onClick={() => canvasRef.current?.requestPointerLock()}
          >
            <Text fw={700} size="lg">{t('trainer.pausado')}</Text>
            <Text size="sm" c="dimmed">{t('trainer.clique_continuar')}</Text>
          </div>
        )}
      </div>
    </Box>
  )
}
