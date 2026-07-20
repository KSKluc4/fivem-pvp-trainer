import { useState, useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { Box, Button, Group, Text, Title, SegmentedControl, Stack, Card } from '@mantine/core'
import { IconArrowLeft, IconPlayerPlay } from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'
import { createArenaScene } from './engine/scene'
import { createLoop } from './engine/loop'
import { createPointerLook } from './engine/pointerLook'
import { SCENARIOS } from './scenarios/index.js'
import Crosshair, { CROSSHAIR_STYLES } from './hud/Crosshair'
import Hud from './hud/Hud'
import ResultsScreen from './hud/ResultsScreen'
import SensitivitySetup from './sensitivity/SensitivitySetup'
import { loadTrainerSensSettings, effectiveDegPerCount } from './sensitivity/trainerSensitivity'
import { useTrainerScores } from './useTrainerScores'
import './trainer.css'

const CENTER_NDC = new THREE.Vector2(0, 0)

// Plays a single exercise session (setup -> countdown -> playing -> results),
// for whichever scenario `exerciseId` names in scenarios/index.js. Generic
// across both "continuous" scenarios (Tracking Suave — hover scoring) and
// "click" scenarios (Shot Grid / Quick Flick / Micro Adjust — click-to-hit +
// timeout) — the mode-specific bits are isolated in the mount-once engine
// effect below, everything else (countdown, results, sens setup) is shared.
//
// `targetRounds` (only set on a routine "Treinar" deep-link — see
// TrainerView) turns the normal "retry forever until you click back" loop
// into a fixed-length block: the results screen shows round progress, and
// once the last round finishes `onRoutineComplete` fires instead of offering
// another retry, so the daily routine can auto-check the exercise off.
export default function ExercisePlayer({ exerciseId, initialDifficulty, targetRounds = null, onBack, onRoutineComplete }) {
  const { t } = useTranslation()
  const scenario = SCENARIOS[exerciseId]

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
  const [difficulty, setDifficulty] = useState(
    initialDifficulty && scenario.difficulties[initialDifficulty] ? initialDifficulty : 'medio',
  )
  const [crosshairStyle, setCrosshairStyle] = useState('cross-dot')
  const [countdownN, setCountdownN] = useState(3)
  const [hud, setHud] = useState({ timeLeft: scenario.sessionDurationS, score: 0, accuracyPct: 0, fps: 0 })
  const [result, setResult] = useState(null)
  const [comparison, setComparison] = useState({ lastAttempt: null, personalBest: null })
  const roundsCompletedRef = useRef(0)
  const [roundsDone, setRoundsDone] = useState(0)

  const { lastAttemptFor, personalBestFor, saveScore } = useTrainerScores(scenario.id)

  const difficultyRef = useRef(difficulty)
  useEffect(() => { difficultyRef.current = difficulty }, [difficulty])
  useEffect(() => { phaseRef.current = phase }, [phase])

  const startCountdown = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    if (targetRef.current) targetRef.current.dispose(engine.scene)
    targetRef.current  = scenario.createTarget(engine.scene, difficulty, engine.camera)
    scorerRef.current  = scenario.createScorer()
    elapsedRef.current = 0
    finishedRef.current = false
    setHud({ timeLeft: scenario.sessionDurationS, score: 0, accuracyPct: 0, fps: 0 })
    setCountdownN(3)
    setPhase('countdown')
  }, [difficulty, scenario])

  const finishSession = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true

    const scorer = scorerRef.current
    const snapshotLast = lastAttemptFor(difficulty)
    const snapshotBest = personalBestFor(difficulty)
    setComparison({ lastAttempt: snapshotLast, personalBest: snapshotBest })
    setPhase('results')
    if (document.pointerLockElement) document.exitPointerLock()

    roundsCompletedRef.current += 1
    setRoundsDone(roundsCompletedRef.current)

    const entry = {
      exercise:   scenario.id,
      difficulty,
      score:      scorer.score,
      accuracy:   +scorer.accuracyPct.toFixed(2),
      duration_s: scenario.sessionDurationS,
    }
    saveScore(entry).then(({ savedRemotely }) => {
      setResult({
        score:           scorer.score,
        accuracyPct:     scorer.accuracyPct,
        bestStreakMs:    scorer.bestStreakMs,
        avgReactionMs:   scorer.avgReactionMs,
        mode:            scenario.mode,
        exercise:        scenario.id,
        difficulty,
        savedRemotely,
      })
    })
  }, [difficulty, lastAttemptFor, personalBestFor, saveScore, scenario])

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

    // Click-to-hit — only relevant for 'click' scenarios (Shot Grid / Quick
    // Flick / Micro Adjust). 'continuous' scenarios (Tracking Suave) score
    // via the per-frame raycast below instead, clicks are a no-op for them.
    function onCanvasClick() {
      if (scenario.mode !== 'click') return
      if (phaseRef.current !== 'playing' || finishedRef.current) return
      if (document.pointerLockElement !== canvas) return
      if (!targetRef.current || !scorerRef.current) return
      raycaster.setFromCamera(CENTER_NDC, camera)
      const hit = raycaster.intersectObject(targetRef.current.mesh, false)
      const isHit = hit.length > 0
      scorerRef.current.registerShot(isHit, targetRef.current.timeAliveMs)
      if (isHit) targetRef.current.respawn()
      setHud((h) => ({ ...h, score: scorerRef.current.score, accuracyPct: scorerRef.current.accuracyPct }))
    }
    canvas.addEventListener('click', onCanvasClick)

    const loop = createLoop((dt, fps) => {
      if (phaseRef.current === 'playing' && !finishedRef.current && targetRef.current && scorerRef.current) {
        if (scenario.mode === 'continuous') {
          targetRef.current.update(dt)
          raycaster.setFromCamera(CENTER_NDC, camera)
          const hit = raycaster.intersectObject(targetRef.current.mesh, false)
          scorerRef.current.update(dt * 1000, hit.length > 0)
        } else {
          targetRef.current.update(dt * 1000)
          const cfg = scenario.difficulties[difficultyRef.current] || {}
          if (cfg.timeoutMs && targetRef.current.timeAliveMs >= cfg.timeoutMs) {
            targetRef.current.respawn()
          }
        }
        elapsedRef.current += dt
        const timeLeft = Math.max(0, scenario.sessionDurationS - elapsedRef.current)
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
      canvas.removeEventListener('click', onCanvasClick)
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

  // The canvas renders continuously (60fps rAF loop) for this component's
  // whole lifetime, not just the 'playing' phase — hide the decorative
  // AppBackground behind it so it isn't animating/compositing for nothing.
  useEffect(() => {
    document.body.classList.add('trainer-active')
    return () => document.body.classList.remove('trainer-active')
  }, [])

  const handleSensDone = () => {
    sensRef.current = loadTrainerSensSettings()
    setPhase('setup')
  }

  // Retrying re-requests pointer lock directly from the click (a genuine
  // user gesture) — startCountdown itself runs once the lock is confirmed,
  // via the pointerlockchange handler below.
  const handleRetry = useCallback(() => {
    canvasRef.current?.requestPointerLock()
  }, [])

  const isFinalRound = targetRounds != null && roundsDone >= targetRounds
  const roundInfo     = targetRounds != null ? { current: roundsDone, total: targetRounds } : null

  const active = phase === 'countdown' || phase === 'playing' || phase === 'paused'
  const exerciseName = t(`trainer.exercicios.${exerciseId}.nome`)

  return (
    <Box className="trainer-view">
      <Group justify="space-between" mb="md">
        <Group gap={6}>
          <Title order={1} size="h2">{t('trainer.titulo')}</Title>
          <Text c="dimmed" size="sm">{exerciseName}</Text>
        </Group>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          {t('trainer.voltar')}
        </Button>
      </Group>

      {/* The canvas/engine mount once and stay in the DOM for the component's
          whole lifetime — sens-setup/results are shown as overlays on top of
          it instead of unmounting it, otherwise the WebGL context created on
          mount would be orphaned the moment phase changes. */}
      <div ref={containerRef} className="trainer-canvas-wrap">
        <canvas ref={canvasRef} className="trainer-canvas" />

        {active && <Crosshair style={crosshairStyle} />}
        {active && (
          <Hud
            {...hud}
            accuracyLabelKey={scenario.mode === 'continuous' ? 'trainer.na_mira' : 'trainer.precisao'}
          />
        )}

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
                exerciseName={exerciseName}
                lastAttempt={comparison.lastAttempt}
                personalBest={comparison.personalBest}
                savedRemotely={result.savedRemotely}
                roundInfo={roundInfo}
                isFinalRound={isFinalRound}
                onRetry={handleRetry}
                onBack={onBack}
                onComplete={isFinalRound ? () => onRoutineComplete?.() : undefined}
              />
            </Card>
          </div>
        )}

        {phase === 'setup' && (
          <div className="trainer-overlay">
            <Card className="trainer-setup-card">
              <Stack gap="md">
                <Box>
                  <Text size="sm" mb={6}>{t('trainer.dificuldade')}</Text>
                  <SegmentedControl
                    fullWidth
                    value={difficulty}
                    onChange={setDifficulty}
                    data={Object.keys(scenario.difficulties).map((key) => ({ label: t(`trainer.dificuldades.${key}`), value: key }))}
                  />
                </Box>
                <Box>
                  <Text size="sm" mb={6}>{t('trainer.estilo_mira')}</Text>
                  <SegmentedControl
                    fullWidth
                    value={crosshairStyle}
                    onChange={setCrosshairStyle}
                    data={CROSSHAIR_STYLES.map((s) => ({ label: t(`trainer.crosshair_estilos.${s}`), value: s }))}
                  />
                </Box>
                <Text size="xs" c="dimmed">
                  <Trans i18nKey="trainer.instrucoes" components={{ bold: <b /> }} />
                </Text>
                <Button
                  size="md"
                  leftSection={<IconPlayerPlay size={18} />}
                  onClick={() => canvasRef.current?.requestPointerLock()}
                >
                  {t('trainer.iniciar')}
                </Button>
              </Stack>
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
