import { useMemo, useRef, useState } from 'react'
import { Box, Button, Stack, Text } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import ExercisePlayer from './ExercisePlayer'
import { useAllTrainerScores } from './useAllTrainerScores'
import { perCategoryLevels } from './aimLevel.js'
import { PRESETS_BY_ID, resolvePresetItems } from './presets.js'
import { saveProgress } from '../services/api'
import { toast } from '../services/toast'

// Runs a routine preset's fixed drill list end to end, one ExercisePlayer at
// a time — the same mechanic TrainerView's routine "Treinar" deep-link
// already uses (targetRounds + onRoutineComplete), just chained across
// several drills instead of one.
//
// Deliberately does NOT call getTraining/GET /training — that route's
// no-session branch resolves and PERSISTS a new mata-mata level
// (services.level_service), which a preset must never touch (it's a
// treino alternativo, the mata-mata quotas stay whatever the daily routine
// already set). `sessionId` is threaded down from App.jsx's own state
// instead — already today's session id if a routine has been generated,
// null if the user reached the trainer without ever answering the
// questionnaire (reachable via the sidebar). When null, drill scores still
// save normally (ExercisePlayer's own useTrainerScores, unaffected by any
// of this) — only the day-completion/streak marker is skipped, since
// there's no session to mark.
//
// Only the FINAL drill's completion sends the __session__ sentinel — same
// "the whole thing, not each piece" rule the daily routine's own "Finalizar
// Sessão" button follows, not one sentinel per drill.
export default function PresetPlayer({ presetId, sessionId, userId, onBack, onPresetComplete }) {
  const { t } = useTranslation()
  const preset = PRESETS_BY_ID[presetId]
  const { scoresByExercise } = useAllTrainerScores()
  const levels = perCategoryLevels(scoresByExercise)
  // useAllTrainerScores only fetches on mount (no live subscription), so
  // `levels` is stable for the whole preset run — this resolves difficulty
  // once, from the level the player had when the preset started.
  const items = useMemo(() => (preset ? resolvePresetItems(preset, levels) : []), [preset, levels])
  const [stepIndex, setStepIndex] = useState(0)
  const [finishing, setFinishing] = useState(false)
  // Belt-and-suspenders against a double "Concluir" click firing two
  // __session__ POSTs — a ref because it must be checked synchronously,
  // before React has a chance to re-render and disable via `finishing`.
  const sentRef = useRef(false)

  const current   = items[stepIndex]
  const isLast    = stepIndex === items.length - 1
  const presetName = preset ? t(`rotina.presets.catalogo.${presetId}.nome`) : ''

  const finishPreset = async () => {
    if (sentRef.current) return
    sentRef.current = true
    setFinishing(true)
    try {
      if (sessionId != null) {
        await saveProgress({
          user_id: userId, session_id: sessionId,
          exercise_name: '__session__', completed: 1, session_completed: true,
        })
      }
      toast.success(t('rotina.presets.toast_concluido', { preset: presetName }))
    } catch (e) {
      console.error(e)
      toast.error(t('rotina.presets.toast_erro'))
    } finally {
      setFinishing(false)
      onPresetComplete?.()
    }
  }

  const handleItemComplete = () => {
    if (isLast) {
      finishPreset()
      return
    }
    const next = items[stepIndex + 1]
    toast.success(t('rotina.presets.toast_progresso', {
      done: stepIndex + 1, total: items.length,
      next: t(`trainer.exercicios.${next.exercise}.nome`),
    }))
    setStepIndex((i) => i + 1)
  }

  // Defensive only — every real call site passes a presetId straight from
  // PRESETS_BY_ID (button clicks, never user-typed), so this should be
  // unreachable in practice. Still: an unknown id degrades to a clear way
  // back instead of a blank screen.
  if (!preset || !current) {
    return (
      <Box p="xl">
        <Stack align="center" gap="sm">
          <Text c="dimmed">{t('rotina.presets.nao_encontrado')}</Text>
          <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
            {t('trainer.voltar')}
          </Button>
        </Stack>
      </Box>
    )
  }

  return (
    <ExercisePlayer
      key={stepIndex}
      exerciseId={current.exercise}
      initialDifficulty={current.difficulty}
      targetRounds={current.rounds}
      onBack={onBack}
      onRoutineComplete={finishing ? undefined : handleItemComplete}
    />
  )
}
