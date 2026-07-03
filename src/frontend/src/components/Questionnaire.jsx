import { useState } from 'react'
import {
  Box, Stepper, Progress, Radio, SimpleGrid, Text, Title, Button,
  Group, Stack, Center, Alert, Transition,
} from '@mantine/core'
import { IconAlertCircle, IconChevronLeft, IconTargetArrow } from '@tabler/icons-react'
import { submitQuestionnaire } from '../services/api'

const QUESTIONS = [
  // ── FiveM context ──────────────────────────────────────────────────────────
  {
    id: 'server_type',
    question: 'Qual servidor FiveM você joga?',
    subtitle: 'Isso calibra o treino para o meta e ritmo do seu servidor',
    options: [
      { value: 'goat',  label: 'Goat PvP',  description: 'Combates táticos, range médio-longo, muito pre-aim', icon: '🐐' },
      { value: 'ambos', label: 'Ambos',      description: 'Jogo em múltiplos servidores e estilos',              icon: '🌐' },
      { value: 'outro', label: 'Outro',      description: 'Servidor diferente ou privado',                       icon: '🎮' },
    ],
  },
  {
    id: 'specific_weakness',
    question: 'Qual é sua maior dificuldade específica?',
    subtitle: 'Vamos focar no seu maior gargalo técnico',
    options: [
      { value: 'moving_target', label: 'Mira em Movimento',    description: 'Erro muito quando o inimigo se movimenta',       icon: '🏃' },
      { value: 'headshot',      label: 'Headshot Consistente', description: 'Acerto no corpo mas raramente na cabeça',         icon: '🎯' },
      { value: 'long_range',    label: 'Distância Longa',      description: 'Perco fights de longe facilmente',               icon: '🔭' },
      { value: 'reaction',      label: 'Reação sob Pressão',   description: 'Travo quando levo o primeiro tiro',              icon: '⚡' },
    ],
  },
  // ── Aim training profile ───────────────────────────────────────────────────
  {
    id: 'focus_area',
    question: 'Qual é seu maior desafio no PvP?',
    subtitle: 'Define o foco principal dos exercícios gerados',
    options: [
      { value: 'aim',      label: 'Mira',      description: 'Erro muito ao atirar, crosshair impreciso ou tremido', icon: '🎯' },
      { value: 'reflex',   label: 'Reflexo',   description: 'Reajo lento, demoro para sacar e atirar',             icon: '⚡' },
      { value: 'movement', label: 'Movimento', description: 'Me movo de forma previsível, levo muita bala',         icon: '🏃' },
    ],
  },
  {
    id: 'experience_level',
    question: 'Qual é seu nível de experiência em PvP?',
    subtitle: 'Define a dificuldade dos exercícios gerados',
    options: [
      { value: 'iniciante',    label: 'Iniciante',    description: 'Comecei a jogar FiveM PvP recentemente',           icon: '🌱' },
      { value: 'intermediario', label: 'Intermediário', description: 'Jogo há alguns meses, ganho algumas fights',     icon: '⚔️' },
      { value: 'avancado',     label: 'Avançado',     description: 'Jogo há mais de 1 ano, quero refinar a técnica',  icon: '🏆' },
    ],
  },
  {
    id: 'aim_difficulty',
    question: 'Que tipo de mira é mais difícil para você?',
    subtitle: 'Selecione sua maior dificuldade com o crosshair',
    options: [
      { value: 'tracking', label: 'Tracking',    description: 'Manter a mira em inimigos que se movem',   icon: '👁️' },
      { value: 'flick',    label: 'Flick Shot',  description: 'Miras rápidas para alvos distantes',       icon: '💥' },
      { value: 'close',    label: 'Close Range', description: 'Trocar tiros de perto sob pressão',        icon: '🔫' },
    ],
  },
  {
    id: 'reflex_level',
    question: 'Como você avalia seu reflexo atual?',
    subtitle: 'Seja honesto — isso calibra a intensidade do treino',
    options: [
      { value: 'lento',  label: 'Lento',  description: 'Inimigo frequentemente atira primeiro',  icon: '🐢' },
      { value: 'medio',  label: 'Médio',  description: 'Às vezes reajo bem, às vezes não',       icon: '⏱️' },
      { value: 'rapido', label: 'Rápido', description: 'Reajo bem, quero ir ao próximo nível',   icon: '🐆' },
    ],
  },
  {
    id: 'movement_quality',
    question: 'Como é seu movimento durante o combate?',
    subtitle: 'Movimento imprevisível é uma das habilidades mais importantes',
    options: [
      { value: 'previsivel',   label: 'Previsível',   description: 'Fico parado ou ando linear, levo muito dano', icon: '🪆' },
      { value: 'moderado',     label: 'Moderado',     description: 'Às vezes consigo confundir o inimigo',        icon: '🎲' },
      { value: 'imprevisivel', label: 'Imprevisível', description: 'Movimento bom, quero combinar com mira',      icon: '🌪️' },
    ],
  },
  {
    id: 'daily_time',
    question: 'Quanto tempo você pode treinar por dia?',
    subtitle: 'Consistência diária supera sessões longas esporádicas',
    options: [
      { value: 25, label: '15–30 min', description: 'Treino rápido e focado no ponto crítico',       icon: '⚡' },
      { value: 45, label: '30–60 min', description: 'Sessão completa com aquecimento e revisão',     icon: '🔥' },
      { value: 65, label: '60+ min',   description: 'Treino intensivo para evolução acelerada',      icon: '💪' },
    ],
  },
  {
    id: 'preferred_tool',
    question: 'Qual ferramenta de treino você usa?',
    subtitle: 'Os exercícios serão adaptados para sua ferramenta',
    options: [
      { value: 'kovaak', label: "KovaaK's",      description: 'Focado em FPS, altamente customizável',              icon: '🎮' },
      { value: 'aimlab', label: 'Aim Lab',        description: 'Gratuito, interface moderna, boas métricas',         icon: '🎯' },
      { value: 'ambos',  label: 'Ambos',          description: 'Uso as duas ferramentas',                            icon: '⚡' },
      { value: 'nenhum', label: 'Nenhum (ainda)', description: 'Vou baixar agora — Aim Lab é gratuito na Steam',     icon: '🆕' },
    ],
  },
]

export default function Questionnaire({ username, onComplete }) {
  const [step, setStep]       = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const current  = QUESTIONS[step]
  const progress = (step / QUESTIONS.length) * 100

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
      const detail = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Erro desconhecido'
      setError(`Erro ao enviar questionário: ${detail}`)
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
          <Text fw={600}>Gerando sua rotina personalizada...</Text>
          <Text c="dimmed" size="sm">Analisando perfil de {username}</Text>
        </Stack>
      </Center>
    )
  }

  return (
    <Box className="questionnaire">
      <Group justify="space-between" mb="sm">
        <Group gap={6}>
          <IconTargetArrow size={18} color="var(--mantine-color-brandCyan-5)" />
          <Text fw={800} size="sm">FiveM PvP Trainer</Text>
        </Group>
        <Text size="xs" c="dimmed">Pergunta <strong>{step + 1}</strong> de {QUESTIONS.length}</Text>
      </Group>

      <Progress value={progress} size="sm" radius="xl" mb="md" />

      <Stepper active={step} size="xs" iconSize={26} mb="xl" wrap>
        {QUESTIONS.map((q) => <Stepper.Step key={q.id} />)}
      </Stepper>

      <Transition mounted transition="slide-left" duration={250} timingFunction="ease">
        {(styles) => (
          <div key={step} style={styles}>
            <Title order={2} mb={4}>{current.question}</Title>
            <Text c="dimmed" mb="lg">{current.subtitle}</Text>

            <Radio.Group value={String(answers[current.id] ?? '')} onChange={handleSelect}>
              <SimpleGrid cols={{ base: 1, sm: current.options.length > 3 ? 2 : 1 }} spacing="sm">
                {current.options.map((opt) => (
                  <Radio.Card value={String(opt.value)} key={opt.value} radius="md" p="md" className="q-option-card">
                    <Group wrap="nowrap" align="flex-start" gap="sm">
                      <Radio.Indicator />
                      <Text size="xl" style={{ lineHeight: 1 }}>{opt.icon}</Text>
                      <Box style={{ flex: 1 }}>
                        <Text fw={700} size="sm">{opt.label}</Text>
                        <Text size="xs" c="dimmed">{opt.description}</Text>
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
                Pergunta anterior
              </Button>
            )}
          </div>
        )}
      </Transition>
    </Box>
  )
}
