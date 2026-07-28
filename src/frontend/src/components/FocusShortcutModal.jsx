import { useState, useEffect } from 'react'
import { Modal, Stack, Box, Text, Button, Group, Loader, Center } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { getCurrentQuestionnaire, updateFocus } from '../services/api'
import { toast } from '../services/toast'
import { QUESTIONS_BY_ID, FOCUS_QUESTION_IDS } from '../questionnaireQuestions.js'
import MultiSelectQuestionCard from './MultiSelectQuestionCard'

// "Mudar meu foco" — only the 3 multi-select questions from the full
// questionnaire (specific_weakness/focus_area/aim_difficulty), pre-filled
// with the user's CURRENT answers (GET /questionnaire/current). Saving
// posts just those 3 fields (POST /questionnaire/focus) — the backend
// snapshots a new questionnaire_results row from the existing profile with
// only these fields replaced, same "reactivate" shape App.jsx already
// knows how to apply (onFocusChanged === handleQuestionnaireComplete).
export default function FocusShortcutModal({ opened, onClose, onFocusChanged }) {
  const { t } = useTranslation()
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState(false)
  const [answers, setAnswers]       = useState({})
  const [saving, setSaving]         = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [shakeOption, setShakeOption] = useState(null)

  useEffect(() => {
    if (!opened) return
    setLoading(true)
    setLoadError(false)
    setConfirming(false)
    getCurrentQuestionnaire()
      .then((res) => {
        setAnswers({
          specific_weakness: res.data.specific_weakness || [],
          focus_area:        res.data.focus_area || [],
          aim_difficulty:    res.data.aim_difficulty || [],
        })
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [opened])

  useEffect(() => {
    if (!shakeOption) return
    const timer = setTimeout(() => setShakeOption(null), 400)
    return () => clearTimeout(timer)
  }, [shakeOption])

  const handleToggle = (questionId) => (nextValues) => {
    if (nextValues.length > 2) {
      const prevValues = answers[questionId] || []
      const rejected = nextValues.find((v) => !prevValues.includes(v))
      setShakeOption(rejected)
      return
    }
    setAnswers((a) => ({ ...a, [questionId]: nextValues }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateFocus(answers)
      toast.success(t('rotina.trocar_foco.sucesso'))
      onFocusChanged(res.data)
      onClose()
    } catch {
      toast.error(t('comum.erros.erro_generico'))
      setSaving(false)
      setConfirming(false)
    }
  }

  const allAnswered = FOCUS_QUESTION_IDS.every((id) => (answers[id] || []).length > 0)

  return (
    <Modal opened={opened} onClose={onClose} title={t('rotina.trocar_foco.titulo')} size="lg" centered>
      {loading ? (
        <Center py="xl"><Loader size="sm" /></Center>
      ) : loadError ? (
        <Text size="sm" c="red">{t('comum.erros.erro_generico')}</Text>
      ) : confirming ? (
        <Stack gap="md">
          <Text size="sm">{t('rotina.trocar_foco.confirmar_corpo')}</Text>
          <Group grow>
            <Button loading={saving} onClick={handleSave}>{t('rotina.trocar_foco.confirmar_botao')}</Button>
            <Button variant="light" color="gray" onClick={() => setConfirming(false)} disabled={saving}>
              {t('comum.cancelar')}
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="lg">
          <Text size="sm" c="dimmed">{t('rotina.trocar_foco.subtitulo')}</Text>
          {FOCUS_QUESTION_IDS.map((id) => {
            const question = QUESTIONS_BY_ID[id]
            const qBase = `questionario.perguntas.${id}`
            return (
              <Box key={id}>
                <Text fw={700} size="sm" mb={2}>{t(`${qBase}.question`)}</Text>
                <Text size="xs" c="dimmed" mb={8}>{t(`${qBase}.subtitle`)}</Text>
                <Text size="xs" c="dimmed" mb={6}>
                  {t('questionario.multiselect_contador', { count: (answers[id] || []).length })}
                </Text>
                <MultiSelectQuestionCard
                  question={question}
                  value={answers[id] || []}
                  onChange={handleToggle(id)}
                  shakeOption={shakeOption}
                />
              </Box>
            )
          })}
          {shakeOption && <Text size="xs" c="orange">{t('questionario.multiselect_maximo')}</Text>}
          <Button fullWidth disabled={!allAnswered} onClick={() => setConfirming(true)}>
            {t('rotina.trocar_foco.continuar')}
          </Button>
        </Stack>
      )}
    </Modal>
  )
}
