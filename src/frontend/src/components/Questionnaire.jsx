import { useState, useEffect } from 'react'
import {
  Box, Stepper, Progress, Radio, Checkbox, SimpleGrid, Text, Title, Button,
  Group, Stack, Center, Alert, Transition, ThemeIcon,
} from '@mantine/core'
import {
  IconAlertCircle, IconChevronLeft, IconTargetArrow,
  IconRun, IconTarget, IconTelescope, IconHeartRateMonitor,
  IconCrosshair, IconBolt, IconArrowsMove,
  IconSwords, IconCrown,
  IconFocusCentered, IconSparkles,
  IconClock, IconGauge, IconBoltFilled,
  IconLineDashed, IconWaveSine, IconArrowsShuffle,
  IconBattery1, IconBattery2, IconBatteryCharging,
} from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'
import { submitQuestionnaire } from '../services/api'

// Question copy (question/subtitle/option label+description) lives in the
// locale files under questionario.perguntas.<id> — this array only carries
// the structural bits (order, option values/icon/color) that drive the UI.
// `value` is what actually gets submitted to the backend — untouched by the
// icon/copy polish, so existing routines and saved answers stay compatible.
const QUESTIONS = [
  {
    id: 'specific_weakness',
    multiSelect: true,
    options: [
      { value: 'moving_target', icon: IconRun,              color: 'brandCyan' },
      { value: 'headshot',      icon: IconTarget,            color: 'brandPurple' },
      { value: 'long_range',    icon: IconTelescope,         color: 'orange' },
      { value: 'reaction',      icon: IconHeartRateMonitor,  color: 'red' },
    ],
  },
  {
    id: 'focus_area',
    multiSelect: true,
    options: [
      { value: 'aim',      icon: IconCrosshair,  color: 'brandCyan' },
      { value: 'reflex',   icon: IconBolt,        color: 'brandPurple' },
      { value: 'movement', icon: IconArrowsMove,  color: 'orange' },
    ],
  },
  {
    id: 'experience_level',
    options: [
      { value: 'iniciante',     icon: IconTarget, color: 'gray' },
      { value: 'intermediario', icon: IconSwords, color: 'brandCyan' },
      { value: 'avancado',      icon: IconCrown,   color: 'brandPurple' },
    ],
  },
  {
    id: 'aim_difficulty',
    multiSelect: true,
    options: [
      { value: 'tracking', icon: IconFocusCentered, color: 'brandCyan' },
      { value: 'flick',    icon: IconSparkles,       color: 'brandPurple' },
      { value: 'close',    icon: IconTargetArrow,    color: 'orange' },
    ],
  },
  {
    id: 'reflex_level',
    options: [
      { value: 'lento',  icon: IconClock,       color: 'gray' },
      { value: 'medio',  icon: IconGauge,        color: 'brandCyan' },
      { value: 'rapido', icon: IconBoltFilled,   color: 'brandPurple' },
    ],
  },
  {
    id: 'movement_quality',
    options: [
      { value: 'previsivel',   icon: IconLineDashed,    color: 'gray' },
      { value: 'moderado',     icon: IconWaveSine,      color: 'brandCyan' },
      { value: 'imprevisivel', icon: IconArrowsShuffle, color: 'brandPurple' },
    ],
  },
  {
    id: 'daily_time',
    options: [
      { value: 25, icon: IconBattery1,        color: 'brandCyan' },
      { value: 45, icon: IconBattery2,        color: 'brandPurple' },
      { value: 65, icon: IconBatteryCharging, color: 'orange' },
    ],
  },
]

export default function Questionnaire({ username, onComplete }) {
  const { t } = useTranslation()
  const [step, setStep]       = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  // Multi-select (up to 2) feedback: the option value that just bounced off
  // the 2-selection cap — drives both the shake animation on that card and
  // the "máximo 2" hint, and self-clears after the animation finishes.
  const [shakeOption, setShakeOption] = useState(null)

  const current  = QUESTIONS[step]
  const progress = (step / QUESTIONS.length) * 100
  const qBase    = `questionario.perguntas.${current.id}`

  useEffect(() => {
    if (!shakeOption) return
    const timer = setTimeout(() => setShakeOption(null), 400)
    return () => clearTimeout(timer)
  }, [shakeOption])

  const advance = async (newAnswers) => {
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

  // Single-select questions (unchanged): picking an option advances right away.
  const handleSelect = (value) => {
    // Radio values arrive as strings — coerce back to number for daily_time
    const coerced   = current.id === 'daily_time' ? Number(value) : value
    const newAnswers = { ...answers, [current.id]: coerced }
    setAnswers(newAnswers)
    advance(newAnswers)
  }

  // Multi-select questions: Checkbox.Group already computes the full next
  // value array for us — a 3rd pick would arrive as a 3-item array, which we
  // reject (shake + hint) instead of writing to state.
  const handleMultiToggle = (nextValues) => {
    if (nextValues.length > 2) {
      const prevValues = answers[current.id] || []
      const rejected = nextValues.find((v) => !prevValues.includes(v))
      setShakeOption(rejected)
      return
    }
    setAnswers({ ...answers, [current.id]: nextValues })
  }

  const handleAdvance = () => advance(answers)

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
            <Box maw={640} mx="auto">
              <Title order={2} mb={4}>{t(`${qBase}.question`)}</Title>
              <Text c="dimmed" mb="lg">{t(`${qBase}.subtitle`)}</Text>

              {current.multiSelect ? (
                <>
                  <Text size="xs" c="dimmed" mb={6}>
                    {t('questionario.multiselect_contador', { count: (answers[current.id] || []).length })}
                  </Text>
                  <Checkbox.Group value={answers[current.id] || []} onChange={handleMultiToggle}>
                    <SimpleGrid cols={1} spacing="sm">
                      {current.options.map((opt) => (
                        <Checkbox.Card
                          value={String(opt.value)}
                          key={opt.value}
                          radius="md"
                          p="md"
                          className={`q-option-card${shakeOption === String(opt.value) ? ' q-option-card--shake' : ''}`}
                        >
                          <Group wrap="nowrap" align="center" gap="sm">
                            <Checkbox.Indicator />
                            <ThemeIcon size={40} radius="md" variant="light" color={opt.color}>
                              <opt.icon size={22} />
                            </ThemeIcon>
                            <Box style={{ flex: 1 }}>
                              <Text fw={700} size="sm">{t(`${qBase}.opcoes.${opt.value}.label`)}</Text>
                              <Text size="xs" c="dimmed">{t(`${qBase}.opcoes.${opt.value}.description`)}</Text>
                            </Box>
                          </Group>
                        </Checkbox.Card>
                      ))}
                    </SimpleGrid>
                  </Checkbox.Group>
                  {shakeOption && (
                    <Text size="xs" c="orange" mt={6}>{t('questionario.multiselect_maximo')}</Text>
                  )}
                </>
              ) : (
                <Radio.Group value={String(answers[current.id] ?? '')} onChange={handleSelect}>
                  <SimpleGrid cols={1} spacing="sm">
                    {current.options.map((opt) => (
                      <Radio.Card value={String(opt.value)} key={opt.value} radius="md" p="md" className="q-option-card">
                        <Group wrap="nowrap" align="center" gap="sm">
                          <Radio.Indicator />
                          <ThemeIcon size={40} radius="md" variant="light" color={opt.color}>
                            <opt.icon size={22} />
                          </ThemeIcon>
                          <Box style={{ flex: 1 }}>
                            <Text fw={700} size="sm">{t(`${qBase}.opcoes.${opt.value}.label`)}</Text>
                            <Text size="xs" c="dimmed">{t(`${qBase}.opcoes.${opt.value}.description`)}</Text>
                          </Box>
                        </Group>
                      </Radio.Card>
                    ))}
                  </SimpleGrid>
                </Radio.Group>
              )}

              {error && (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} mt="md">
                  {error}
                </Alert>
              )}

              {current.multiSelect && (
                <Button
                  fullWidth
                  mt="lg"
                  disabled={(answers[current.id] || []).length === 0}
                  onClick={handleAdvance}
                >
                  {t('questionario.avancar')}
                </Button>
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
            </Box>
          </div>
        )}
      </Transition>
    </Box>
  )
}
