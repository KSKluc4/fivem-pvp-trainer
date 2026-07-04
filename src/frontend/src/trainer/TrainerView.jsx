import { useState, useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { Box, Button, Group, Text, Title, SegmentedControl, Stack, Card } from '@mantine/core'
import { IconArrowLeft, IconPlayerPlay } from '@tabler/icons-react'
import { createArenaScene } from './engine/scene'
import { createLoop } from './engine/loop'
import { createPointerLook } from './engine/pointerLook'
import { SmoothTarget, TrackingScorer, DIFFICULTIES, SESSION_DURATION_S, EXERCISE_ID } from './scenarios/trackingSmooth'
import Crosshair, { CROSSHAIR_STYLES } from './hud/Crosshair'
import Hud from './hud/Hud'
import ResultsScreen from './hud/ResultsScreen'
import SensitivitySetup from './sensitivity/SensitivitySetup'
import { loadTrainerSensSettings, effectiveDegPerCount } from './sensitivity/trainerSensitivity'
import { useTrainerScores } from './useTrainerScores'
import './trainer.css'

const CENTER_NDC = new THREE.Vector2(0, 0)

export default function TrainerView({ onBack }) {
  const canvasRef    = useRef(null)
  const containerRef = useRef(null)
  const engineRef    = useRef(null)
  const targetRef    = useRef(null)
  const scorerRef    = useRef(null)
  const elapsedRef   = useRef(0)
  const finishedRef  = useRef(false)
  const phaseRef     = useRef('setup')
  const resumePhaseRef = useRef('playing')
  const sensRef      = useRef(loadTrainerSensSettings())

  const [phase, setPhase] = useState(() => (sensRef.current.gtaSens == null ? 'sens-setup' : 'setup'))
  const [difficulty, setDifficulty] = useState('medio')
  const [crosshairStyle, setCrosshairStyle] = useState('cross-dot')
  const [countdownN, setCountdownN] = useState(3)
  const [hud, setHud] = useState({ timeLeft: SESSION_DURATION_S, score: 0, accuracyPct: 0, fps: 0 })
  const [result, setResult] = useState(null)
  const [comparison, setComparison] = useState({ lastAttempt: null, personalBest: null })

  const { lastAttemptFor, personalBestFor, saveScore } = useTrainerScores(EXERCISE_ID)

  useEffect(() => { phaseRef.current = phase }, [phase])

  const startCountdown = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    if (targetRef.current) targetRef.current.dispose(engine.scene)
    targetRef.current  = new SmoothTarget(engine.scene, difficulty)
    scorerRef.current  = new TrackingScorer()
    elapsedRef.current = 0
    finishedRef.current = false
    setHud({ timeLeft: SESSION_DURATION_S, score: 0, accuracyPct: 0, fps: 0 })
    setCountdownN(3)
    setPhase('countdown')
  }, [difficulty])

  const finishSession = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true

    const scorer = scorerRef.current
    const snapshotLast = lastAttemptFor(difficulty)
    const snapshotBest = personalBestFor(difficulty)
    setComparison({ lastAttempt: snapshotLast, personalBest: snapshotBest })
    setPhase('results')
    if (document.pointerLockElement) document.exitPointerLock()

    const entry = {
      exercise:   EXERCISE_ID,
      difficulty,
      score:      scorer.score,
      accuracy:   +scorer.accuracyPct.toFixed(2),
      duration_s: SESSION_DURATION_S,
    }
    saveScore(entry).then(({ savedRemotely }) => {
      setResult({
        score:           scorer.score,
        accuracyPct:     scorer.accuracyPct,
        bestStreakMs:    scorer.bestStreakMs,
        difficulty,
        difficultyLabel: DIFFICULTIES[difficulty].label,
        savedRemotely,
      })
    })
  }, [difficulty, lastAttemptFor, personalBestFor, saveScore])

  const resumeFromPause = useCallback(() => {
    if (resumePhaseRef.current === 'countdown') {
      setCountdownN(3)
      setPhase('countdown')
    } else {
      setPhase('playing')
    }
  }, [])

  // The mount-once engine effect below (deps=[]) closes over whatever these
  // callbacks were on the FIRST render. Refs keep it calling the latest
  // version — otherwise a difficulty change would never reach startCountdown.
  const startCountdownRef  = useRef(startCountdown)
  const finishSessionRef   = useRef(finishSession)
  const resumeFromPauseRef = useRef(resumeFromPause)
  startCountdownRef.current  = startCountdown
  finishSessionRef.current   = finishSession
  resumeFromPauseRef.current = resumeFromPause

  // ── Engine: created once, lives for the whole component lifetime ──────────
  useEffect(() => {
    const canvas = canvasRef.current
    const { renderer, scene, camera, resize, dispose } = createArenaScene(canvas)
    const pointerLook = createPointerLook(camera, {
      getDegPerCount: () => effectiveDegPerCount(sensRef.current),
      getInvertY: () => false,
    })
    const raycaster = new THREE.Raycaster()

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
        if (phaseRef.current === 'setup' || phaseRef.current === 'results') startCountdownRef.current()
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
      if (phaseRef.current === 'playing' && !finishedRef.current && targetRef.current && scorerRef.current) {
        targetRef.current.update(dt)
        raycaster.setFromCamera(CENTER_NDC, camera)
        const hit = raycaster.intersectObject(targetRef.current.mesh, false)
        scorerRef.current.update(dt * 1000, hit.length > 0)
        elapsedRef.current += dt
        const timeLeft = Math.max(0, SESSION_DURATION_S - elapsedRef.current)
        setHud({
          timeLeft, score: scorerRef.current.score,
          accuracyPct: scorerRef.current.accuracyPct, fps,
        })
        if (timeLeft <= 0) finishSessionRef.current()
      } else {
        setHud((h) => (h.fps === fps ? h : { ...h, fps }))
      }
      renderer.render(scene, camera)
    })
    loop.start()

    engineRef.current = { renderer, scene, camera, pointerLook }

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      window.removeEventListener('resize', handleResize)
      loop.stop()
      pointerLook.detach()
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      if (targetRef.current) targetRef.current.dispose(scene)
      dispose()
      engineRef.current = null
    }
    // Intentionally mount once — difficulty/phase changes are read via refs
    // inside the loop/listeners so the WebGL context is never torn down mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Countdown ticker
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdownN <= 0) { setPhase('playing'); return }
    const t = setTimeout(() => setCountdownN((n) => n - 1), 800)
    return () => clearTimeout(t)
  }, [phase, countdownN])

  const handleSensDone = () => {
    sensRef.current = loadTrainerSensSettings()
    setPhase('setup')
  }

  // "Tentar novamente" re-requests pointer lock directly from the click (a
  // genuine user gesture) — startCountdown itself runs once the lock is
  // confirmed, via the pointerlockchange handler below.
  const handleRetry = useCallback(() => {
    canvasRef.current?.requestPointerLock()
  }, [])

  const active = phase === 'countdown' || phase === 'playing' || phase === 'paused'

  return (
    <Box className="trainer-view">
      <Group justify="space-between" mb="md">
        <Group gap={6}>
          <Title order={1} size="h2">Treinar agora</Title>
          <Text c="dimmed" size="sm">Tracking Suave</Text>
        </Group>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          Voltar
        </Button>
      </Group>

      {/* The canvas/engine mount once and stay in the DOM for the component's
          whole lifetime — sens-setup/results are shown as overlays on top of
          it instead of unmounting it, otherwise the WebGL context created on
          mount would be orphaned the moment phase changes. */}
      <div ref={containerRef} className="trainer-canvas-wrap">
        <canvas ref={canvasRef} className="trainer-canvas" />

        {active && <Crosshair style={crosshairStyle} />}
        {active && <Hud {...hud} />}

        {phase === 'sens-setup' && (
          <div className="trainer-overlay">
            <Card className="trainer-setup-card" style={{ maxWidth: 640 }}>
              <SensitivitySetup onDone={handleSensDone} />
            </Card>
          </div>
        )}

        {phase === 'results' && result && (
          <div className="trainer-overlay">
            <Card style={{ maxWidth: 640, width: '100%' }}>
              <ResultsScreen
                result={result}
                lastAttempt={comparison.lastAttempt}
                personalBest={comparison.personalBest}
                savedRemotely={result.savedRemotely}
                onRetry={handleRetry}
                onBack={onBack}
              />
            </Card>
          </div>
        )}

        {phase === 'setup' && (
          <div className="trainer-overlay">
            <Card className="trainer-setup-card">
              <Stack gap="md">
                <Box>
                  <Text size="sm" mb={6}>Dificuldade</Text>
                  <SegmentedControl
                    fullWidth
                    value={difficulty}
                    onChange={setDifficulty}
                    data={Object.entries(DIFFICULTIES).map(([key, d]) => ({ label: d.label, value: key }))}
                  />
                </Box>
                <Box>
                  <Text size="sm" mb={6}>Estilo de mira</Text>
                  <SegmentedControl
                    fullWidth
                    value={crosshairStyle}
                    onChange={setCrosshairStyle}
                    data={CROSSHAIR_STYLES.map((s) => ({ label: s, value: s }))}
                  />
                </Box>
                <Text size="xs" c="dimmed">
                  60 segundos · o mouse fica preso na janela (Pointer Lock) — pressione <b>ESC</b> para soltar a qualquer momento.
                </Text>
                <Button
                  size="md"
                  leftSection={<IconPlayerPlay size={18} />}
                  onClick={() => canvasRef.current?.requestPointerLock()}
                >
                  Iniciar
                </Button>
              </Stack>
            </Card>
          </div>
        )}

        {phase === 'countdown' && (
          <div className="trainer-overlay trainer-overlay--countdown">
            <Text className="trainer-countdown-number">{countdownN > 0 ? countdownN : 'Vai!'}</Text>
          </div>
        )}

        {phase === 'paused' && (
          <div
            className="trainer-overlay trainer-overlay--clickable"
            onClick={() => canvasRef.current?.requestPointerLock()}
          >
            <Text fw={700} size="lg">Pausado</Text>
            <Text size="sm" c="dimmed">Clique para continuar</Text>
          </div>
        )}
      </div>
    </Box>
  )
}
