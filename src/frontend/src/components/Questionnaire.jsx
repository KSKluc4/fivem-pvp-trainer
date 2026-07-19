import { useState } from 'react'
import {
  Box, Stepper, Progress, Radio, SimpleGrid, Text, Title, Button,
  Group, Stack, Center, Alert, Transition,
} from '@mantine/core'
import { IconAlertCircle, IconChevronLeft, IconTargetArrow } from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'
import { submitQuestionnaire } from '../services/api'

// Question copy (question/subtitle/option label+description) lives in the
// locale files under questionario.perguntas.<id> — this array only carries
// the structural bits (order, option values/icons) that drive the UI.
const QUESTIONS = [
  {
    id: 'specific_weakness',
    options: [
      { value: 'moving_target', icon: '🏃' },
      { value: 'headshot',      icon: '🎯' },
      { value: 'long_range',    icon: '🔭' },
      { value: 'reaction',      icon: '⚡' },
    ],
  },
  {
    id: 'focus_area',
    options: [
      { value: 'aim',      icon: '🎯' },
      { value: 'reflex',   icon: '⚡' },
      { value: 'movement', icon: '🏃' },
    ],
  },
  {
    id: 'experience_level',
    options: [
      { value: 'iniciante',     icon: '🌱' },
      { value: 'intermediario', icon: '⚔️' },
      { value: 'avancado',      icon: '🏆' },
    ],
  },
  {
    id: 'aim_difficulty',
    options: [
      { value: 'tracking', icon: '👁️' },
      { value: 'flick',    icon: '💥' },
      { value: 'close',    icon: '🔫' },
    ],
  },
  {
    id: 'reflex_level',
    options: [
      { value: 'lento',  icon: '🐢' },
      { value: 'medio',  icon: '⏱️' },
      { value: 'rapido', icon: '🐆' },
    ],
  },
  {
    id: 'movement_quality',
    options: [
      { value: 'previsivel',   icon: '🪆' },
      { value: 'moderado',     icon: '🎲' },
      { value: 'imprevisivel', icon: '🌪️' },
    ],
  },
  {
    id: 'daily_time',
    options: [
      { value: 25, icon: '⚡' },
      { value: 45, icon: '🔥' },
      { value: 65, icon: '💪' },
    ],
  },
  {
    id: 'preferred_tool',
    options: [
      { value: 'kovaak', icon: '🎮' },
      { value: 'aimlab', icon: '🎯' },
      { value: 'ambos',  icon: '⚡' },
      { value: 'nenhum', icon: '🆕' },
    ],
  },
]

export default function Questionnaire({ username, onComplete }) {
  const { t } = useTranslation()
  const [step, setStep]       = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const current  = QUESTIONS[step]
  const progress = (step / QUESTIONS.length) * 100
  const qBase    = `questionario.perguntas.${current.id}`

  const handleSelect = async (value) => {
    // Radio values arrive as strings — coerce back to number for daily_time
    const coerced   = current.id === 'daily_time' ? Number(value) : value
    const newAnswers = { ...answers, [current.id]: coerced }
    setAnswers(newAnswers)

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await submitQuestionnaire({ name: username, ...newAnswers })
      onComplete(res.data)
    } catch (err) {
      const detail = err?.response?.data?.message || err?.response?.data?.error || err?.message || t('questionario.erro_desconhecido')
      setError(t('questionario.erro_enviar', { detail }))
      setLoading(false)
    }
  }

  const handleBack = () => setStep(step - 1)

  if (loading) {
    return (
      <Center className="loading-screen">
        <Stack align="center" gap="md">
          <div className="loading-crosshair">
            <div className="lc-ring lc-ring-1" />
            <div className="lc-ring lc-ring-2" />
            <div className="lc-dot" />
          </div>
          <Text fw={600}>{t('questionario.gerando_rotina')}</Text>
          <Text c="dimmed" size="sm">{t('questionario.analisando_perfil', { username })}</Text>
        </Stack>
      </Center>
    )
  }

  return (
    <Box className="questionnaire">
      <Group justify="space-between" mb="sm">
        <Group gap={6}>
          <IconTargetArrow size={18} color="var(--mantine-color-brandCyan-5)" />
          <Text fw={800} size="sm">{t('comum.app_name')}</Text>
        </Group>
        <Text size="xs" c="dimmed">
          <Trans i18nKey="questionario.pergunta_contador" values={{ current: step + 1, total: QUESTIONS.length }} components={{ bold: <strong /> }} />
        </Text>
      </Group>

      <Progress value={progress} size="sm" radius="xl" mb="md" />

      <Stepper active={step} size="xs" iconSize={26} mb="xl" wrap>
        {QUESTIONS.map((q) => <Stepper.Step key={q.id} />)}
      </Stepper>

      <Transition mounted transition="slide-left" duration={250} timingFunction="ease">
        {(styles) => (
          <div key={step} style={styles}>
            <Title order={2} mb={4}>{t(`${qBase}.question`)}</Title>
            <Text c="dimmed" mb="lg">{t(`${qBase}.subtitle`)}</Text>

            <Radio.Group value={String(answers[current.id] ?? '')} onChange={handleSelect}>
              <SimpleGrid cols={{ base: 1, sm: current.options.length > 3 ? 2 : 1 }} spacing="sm">
                {current.options.map((opt) => (
                  <Radio.Card value={String(opt.value)} key={opt.value} radius="md" p="md" className="q-option-card">
                    <Group wrap="nowrap" align="flex-start" gap="sm">
                      <Radio.Indicator />
                      <Text size="xl" style={{ lineHeight: 1 }}>{opt.icon}</Text>
                      <Box style={{ flex: 1 }}>
                        <Text fw={700} size="sm">{t(`${qBase}.opcoes.${opt.value}.label`)}</Text>
                        <Text size="xs" c="dimmed">{t(`${qBase}.opcoes.${opt.value}.description`)}</Text>
                      </Box>
                    </Group>
                  </Radio.Card>
                ))}
              </SimpleGrid>
            </Radio.Group>

            {error && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} mt="md">
                {error}
              </Alert>
            )}

            {step > 0 && (
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconChevronLeft size={16} />}
                onClick={handleBack}
                mt="lg"
              >
                {t('questionario.pergunta_anterior')}
              </Button>
            )}
          </div>
        )}
      </Transition>
    </Box>
  )
}
