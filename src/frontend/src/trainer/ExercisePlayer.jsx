import { useState, useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { Box, Button, Group, Text, Title, SegmentedControl, Stack, Card } from '@mantine/core'
import { IconArrowLeft, IconPlayerPlay } from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'
import { useTrainerEngine } from './engine/useTrainerEngine'
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
// timeout) — the mode-specific bits live in onFrame/onCanvasClick below,
// everything else (countdown, pointer-lock lifecycle, resize) is shared with
// DiscoveryPlayer via useTrainerEngine.
//
// `targetRounds` (only set on a routine "Treinar" deep-link — see
// TrainerView) turns the normal "retry forever until you click back" loop
// into a fixed-length block: the results screen shows round progress, and
// once the last round finishes `onRoutineComplete` fires instead of offering
// another retry, so the daily routine can auto-check the exercise off.
export default function ExercisePlayer({ exerciseId, initialDifficulty, targetRounds = null, onBack, onRoutineComplete }) {
  const { t } = useTranslation()
  const scenario = SCENARIOS[exerciseId]

  const targetRef    = useRef(null)
  const scorerRef    = useRef(null)
  const elapsedRef   = useRef(0)
  const finishedRef  = useRef(false)
  const sensRef      = useRef(loadTrainerSensSettings())

  const [difficulty, setDifficulty] = useState(
    initialDifficulty && scenario.difficulties[initialDifficulty] ? initialDifficulty : 'medio',
  )
  const [crosshairStyle, setCrosshairStyle] = useState('cross-dot')
  const [hud, setHud] = useState({ timeLeft: scenario.sessionDurationS, score: 0, accuracyPct: 0, fps: 0 })
  const [result, setResult] = useState(null)
  const [comparison, setComparison] = useState({ lastAttempt: null, personalBest: null })
  const roundsCompletedRef = useRef(0)
  const [roundsDone, setRoundsDone] = useState(0)

  const { lastAttemptFor, personalBestFor, saveScore } = useTrainerScores(scenario.id)

  const difficultyRef = useRef(difficulty)
  useEffect(() => { difficultyRef.current = difficulty }, [difficulty])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, lastAttemptFor, personalBestFor, saveScore, scenario])

  // The engine effect (inside useTrainerEngine) closes over whatever these
  // were on the FIRST render. Refs keep it calling the latest version —
  // otherwise a difficulty change would never reach startCountdown.
  const startCountdownRef = useRef(startCountdown)
  const finishSessionRef  = useRef(finishSession)
  startCountdownRef.current = startCountdown
  finishSessionRef.current  = finishSession

  const onFrame = useCallback((dt, fps) => {
    const engine = engineRef.current
    if (phaseRef.current === 'playing' && !finishedRef.current && targetRef.current && scorerRef.current && engine) {
      const raycaster = frameRaycasterRef.current
      if (scenario.mode === 'continuous') {
        targetRef.current.update(dt)
        raycaster.setFromCamera(CENTER_NDC, engine.camera)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A single Raycaster reused by both the per-frame ('continuous' mode) and
  // click-to-hit ('click' mode) hit-tests — created once, same as before.
  const frameRaycasterRef = useRef(null)
  if (!frameRaycasterRef.current) frameRaycasterRef.current = new THREE.Raycaster()

  const onStart = startCountdown

  const onUnmount = useCallback(() => {
    const engine = engineRef.current
    if (targetRef.current && engine) targetRef.current.dispose(engine.scene)
  }, [])

  const initialPhase = sensRef.current.gtaSens == null ? 'sens-setup' : 'setup'

  const {
    canvasRef, containerRef, engineRef, phase, setPhase, phaseRef, countdownN, setCountdownN,
  } = useTrainerEngine({
    initialPhase,
    startPhases: ['setup', 'results'],
    onStart,
    onFrame,
    onUnmount,
    getDegPerCount: () => effectiveDegPerCount(sensRef.current),
  })

  // Click-to-hit — only relevant for 'click' scenarios (Shot Grid / Quick
  // Flick / Micro Adjust). 'continuous' scenarios (Tracking Suave) score via
  // the per-frame raycast in onFrame instead, clicks are a no-op for them.
  // A separate mount-once effect from the shared engine plumbing since
  // hit-testing on click is specific to this player.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onCanvasClick() {
      if (scenario.mode !== 'click') return
      if (phaseRef.current !== 'playing' || finishedRef.current) return
      if (document.pointerLockElement !== canvas) return
      if (!targetRef.current || !scorerRef.current) return
      const engine = engineRef.current
      if (!engine) return
      const raycaster = frameRaycasterRef.current
      raycaster.setFromCamera(CENTER_NDC, engine.camera)
      const hit = raycaster.intersectObject(targetRef.current.mesh, false)
      const isHit = hit.length > 0
      scorerRef.current.registerShot(isHit, targetRef.current.timeAliveMs)
      if (isHit) targetRef.current.respawn()
      setHud((h) => ({ ...h, score: scorerRef.current.score, accuracyPct: scorerRef.current.accuracyPct }))
    }
    canvas.addEventListener('click', onCanvasClick)
    return () => canvas.removeEventListener('click', onCanvasClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSensDone = () => {
    sensRef.current = loadTrainerSensSettings()
    setPhase('setup')
  }

  // Retrying re-requests pointer lock directly from the click (a genuine
  // user gesture) — startCountdown itself runs once the lock is confirmed,
  // via the engine hook's pointerlockchange handling.
  const handleRetry = useCallback(() => {
    canvasRef.current?.requestPointerLock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
