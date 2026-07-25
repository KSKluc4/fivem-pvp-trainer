import { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Button, Group, Text, Title, SegmentedControl, Stack, Card } from '@mantine/core'
import { IconArrowLeft, IconPlayerPlay } from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'
import { createArena2D } from './engine2d/arena2d.js'
import { createCursorTracker } from './engine2d/cursor2d.js'
import { createLoop } from './engine/loop.js'
import { SCENARIOS } from './scenarios2d/index.js'
import { CROSSHAIR_STYLES } from './hud/Crosshair'
import Hud from './hud/Hud'
import ResultsScreen from './hud/ResultsScreen'
import { playShoot, playHit, playOnTargetTick } from './audio/trainerAudio'
import { loadTrainerAudioSettings, saveTrainerAudioSettings } from './audio/trainerAudioSettings.js'
import { useTrainerScores } from './useTrainerScores'
import './trainer.css'

// Plays a single exercise session (setup -> countdown -> playing -> results),
// for whichever scenario `exerciseId` names in scenarios2d/index.js. Generic
// across both "continuous" scenarios (Tracking Suave — hover scoring) and
// "click" scenarios (Grade de Tiro / Flick Rápido / Micro Ajuste — click-to-
// hit + timeout) — the mode-specific bits live in onFrame/onCanvasClick
// below. Owns its own Canvas2D mount-once lifecycle (arena/cursor/rAF loop)
// — unlike the old 3D drills, this no longer shares useTrainerEngine with
// DiscoveryPlayer, which stays on the pointer-lock 3D engine on purpose.
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
  const arenaRef     = useRef(null)
  const cursorRef    = useRef(null)
  const targetRef    = useRef(null)
  const scorerRef    = useRef(null)
  const elapsedRef   = useRef(0)
  const finishedRef  = useRef(false)
  const wasOnTargetRef = useRef(false)
  const roundsCompletedRef = useRef(0)
  const resumePhaseRef = useRef('playing')

  const [difficulty, setDifficulty] = useState(
    initialDifficulty && scenario.difficulties[initialDifficulty] ? initialDifficulty : 'medio',
  )
  const [crosshairStyle, setCrosshairStyle] = useState('cross-dot')
  const [phase, setPhase] = useState('setup')
  const [countdownN, setCountdownN] = useState(3)
  const [hud, setHud] = useState({ timeLeft: scenario.sessionDurationS, score: 0, accuracyPct: 0, streak: 0 })
  const [result, setResult] = useState(null)
  const [comparison, setComparison] = useState({ lastAttempt: null, personalBest: null })
  const [roundsDone, setRoundsDone] = useState(0)
  const [sfxOn, setSfxOn] = useState(() => loadTrainerAudioSettings().sfxEnabled)

  const { lastAttemptFor, personalBestFor, saveScore } = useTrainerScores(scenario.id)

  const phaseRef = useRef(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])
  const difficultyRef = useRef(difficulty)
  useEffect(() => { difficultyRef.current = difficulty }, [difficulty])
  const crosshairStyleRef = useRef(crosshairStyle)
  useEffect(() => { crosshairStyleRef.current = crosshairStyle }, [crosshairStyle])

  const startCountdown = useCallback(() => {
    const arena = arenaRef.current
    const cursor = cursorRef.current
    if (!arena || !cursor) return
    const { width, height } = arena.getSize()
    targetRef.current  = scenario.createTarget(width, height, difficulty, () => cursor.getPosition())
    scorerRef.current  = scenario.createScorer()
    elapsedRef.current = 0
    finishedRef.current = false
    wasOnTargetRef.current = false
    setHud({ timeLeft: scenario.sessionDurationS, score: 0, accuracyPct: 0, streak: 0 })
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
        bestStreakMs:    scenario.mode === 'continuous' ? scorer.bestStreakMs : 0,
        avgReactionMs:   scenario.mode === 'click' ? scorer.avgReactionMs : 0,
        mode:            scenario.mode,
        exercise:        scenario.id,
        difficulty,
        savedRemotely,
      })
    })
  }, [difficulty, lastAttemptFor, personalBestFor, saveScore, scenario])

  // Refs so the mount-once effect below always calls the latest version.
  const startCountdownRef = useRef(startCountdown)
  const finishSessionRef  = useRef(finishSession)
  startCountdownRef.current = startCountdown
  finishSessionRef.current  = finishSession

  const onFrame = useCallback((dt, fps) => {
    const arena  = arenaRef.current
    const cursor = cursorRef.current
    if (!arena || !cursor) return
    arena.clearAndDrawBackground()

    if (phaseRef.current === 'playing' && !finishedRef.current && targetRef.current && scorerRef.current) {
      if (scenario.mode === 'continuous') {
        targetRef.current.update(dt)
        const cur = cursor.getPosition()
        const isOnTarget = targetRef.current.containsPoint(cur.x, cur.y)
        // Edge-triggered — a subtle cue on entering the target, not a
        // continuous tone. Off by default (trainerAudioSettings), no UI
        // toggle yet — playOnTargetTick() itself checks the setting.
        if (isOnTarget && !wasOnTargetRef.current) playOnTargetTick()
        wasOnTargetRef.current = isOnTarget
        scorerRef.current.update(dt * 1000, isOnTarget)
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
        accuracyPct: scorerRef.current.accuracyPct,
        streak: scenario.mode === 'continuous' ? scorerRef.current.currentStreakMs : scorerRef.current.currentStreak,
      })
      if (timeLeft <= 0) finishSessionRef.current()
    }

    if (targetRef.current) targetRef.current.draw(arena.ctx)
    cursor.draw(arena.ctx, crosshairStyleRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  // Mount-once: canvas/arena/cursor/rAF-loop lifecycle, auto-pause on
  // blur/tab-hide, Escape to pause. No pointer lock anywhere — the cursor
  // roams free inside the bounded canvas the whole time.
  useEffect(() => {
    const canvas    = canvasRef.current
    const container = containerRef.current
    const arena  = createArena2D(canvas, container)
    const cursor = createCursorTracker(canvas)
    cursor.attach()
    arenaRef.current  = arena
    cursorRef.current = cursor

    const loop = createLoop((dt, fps) => onFrameRef.current(dt, fps))
    loop.start()

    function pauseIfActive() {
      if (phaseRef.current === 'playing' || phaseRef.current === 'countdown') {
        resumePhaseRef.current = phaseRef.current
        setPhase('paused')
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') pauseIfActive()
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') pauseIfActive()
    }
    window.addEventListener('blur', pauseIfActive)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('keydown', onKeyDown)
    document.body.classList.add('trainer-active')

    return () => {
      window.removeEventListener('blur', pauseIfActive)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('trainer-active')
      loop.stop()
      cursor.detach()
      arena.dispose()
      arenaRef.current = null
      cursorRef.current = null
    }
    // Intentionally mount once — phase/target progression is driven entirely
    // through refs, so the canvas is never torn down mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Click-to-hit — only relevant for 'click' scenarios (Grade de Tiro /
  // Flick Rápido / Micro Ajuste). 'continuous' scenarios (Tracking Suave)
  // score via the per-frame overlap check in onFrame instead, clicks are a
  // no-op for them.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onPointerDown() {
      if (scenario.mode !== 'click') return
      if (phaseRef.current !== 'playing' || finishedRef.current) return
      if (!targetRef.current || !scorerRef.current) return
      const cursor = cursorRef.current
      if (!cursor) return
      const pos = cursor.getPosition()
      const isHit = targetRef.current.containsPoint(pos.x, pos.y)
      playShoot()
      if (isHit) playHit()
      scorerRef.current.registerShot(isHit, targetRef.current.timeAliveMs)
      if (isHit) { targetRef.current.flashHit(); targetRef.current.respawn() }
      setHud((h) => ({
        ...h, score: scorerRef.current.score, accuracyPct: scorerRef.current.accuracyPct,
        streak: scorerRef.current.currentStreak,
      }))
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    return () => canvas.removeEventListener('pointerdown', onPointerDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 3-2-1 countdown ticker.
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdownN <= 0) { setPhase('playing'); return }
    const timer = setTimeout(() => setCountdownN((n) => n - 1), 800)
    return () => clearTimeout(timer)
  }, [phase, countdownN])

  const handleResume = useCallback(() => {
    if (resumePhaseRef.current === 'countdown') {
      setCountdownN(3)
      setPhase('countdown')
    } else {
      setPhase('playing')
    }
  }, [])

  const handleRetry = useCallback(() => {
    startCountdownRef.current()
  }, [])

  const handleToggleMute = useCallback(() => {
    setSfxOn((prev) => {
      const next = !prev
      saveTrainerAudioSettings({ sfxEnabled: next })
      return next
    })
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

      {/* The canvas/arena/cursor mount once and stay in the DOM for the
          component's whole lifetime — setup/results are shown as overlays on
          top of it instead of unmounting it. */}
      <div ref={containerRef} className={`trainer-canvas-wrap${active ? ' trainer-canvas-wrap--active' : ''}`}>
        <canvas ref={canvasRef} className="trainer-canvas" />

        {active && (
          <Hud
            {...hud}
            exerciseName={exerciseName}
            sessionDurationS={scenario.sessionDurationS}
            mode={scenario.mode}
            accuracyLabelKey={scenario.mode === 'continuous' ? 'trainer.na_mira' : 'trainer.precisao'}
            sfxOn={sfxOn}
            onToggleMute={handleToggleMute}
          />
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
                  onClick={startCountdown}
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
          <div className="trainer-overlay trainer-overlay--clickable" onClick={handleResume}>
            <Text fw={700} size="lg">{t('trainer.pausado')}</Text>
            <Text size="sm" c="dimmed">{t('trainer.clique_continuar')}</Text>
          </div>
        )}
      </div>
    </Box>
  )
}
