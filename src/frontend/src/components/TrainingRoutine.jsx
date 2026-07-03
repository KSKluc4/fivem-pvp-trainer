import { useState } from 'react'
import {
  Box, Group, Stack, Title, Text, Badge, Button, Card, Checkbox, Progress,
  SimpleGrid, Anchor, CopyButton, ActionIcon, Tooltip,
} from '@mantine/core'
import {
  IconChartBar, IconDeviceGamepad2, IconSettings, IconFlame, IconBolt,
  IconClipboardList, IconCopy, IconCheck, IconTrophy,
} from '@tabler/icons-react'
import { saveProgress } from '../services/api'
import { toast } from '../services/toast'
import Goals from './Goals'

const DIFFICULTY_LABELS = {
  beginner:     { label: 'Iniciante',    color: '#2ed573' },
  intermediate: { label: 'Intermediário', color: '#ffa502' },
  advanced:     { label: 'Avançado',     color: '#ff4757' },
}

const FOCUS_LABELS = { aim: 'Mira', reflex: 'Reflexo', movement: 'Movimento' }

const SECTION_ICONS = { 'Aquecimento': IconFlame, 'Treino Principal': IconBolt, 'Revisão': IconClipboardList }

// ── Recommended playlists ─────────────────────────────────────────────────────
const PLAYLISTS = {
  kovaak: [
    {
      name:  'Voltaic Benchmark',
      desc:  'O padrão ouro — avalia seu nível real com 6 cenários de tracking, flick e controle',
      url:   'https://discord.gg/voltaic',
      tag:   'Benchmark',
      color: '#ffa502',
    },
    {
      name:  'Smooth & Click',
      desc:  'Progressão de tracking suave a flick shots precisos — ideal para iniciantes e intermediários',
      url:   'https://steamcommunity.com/workshop/browse/?appid=824270&searchtext=smooth+click+training',
      tag:   'Progressivo',
      color: '#00d4ff',
    },
    {
      name:  'Voltaic FPS Pack',
      desc:  'Cenários validados pela comunidade competitiva — referência de treino para FPS',
      url:   'https://steamcommunity.com/workshop/browse/?appid=824270&searchtext=voltaic+fps',
      tag:   'Competitivo',
      color: '#7b2fd4',
    },
  ],
  aimlab: [
    {
      name:  'Aim Lab Routines',
      desc:  'Rotinas oficiais organizadas por nível — iniciante, intermediário e avançado',
      url:   'https://aimlab.gg/routines',
      tag:   'Oficial',
      color: '#2ed573',
    },
    {
      name:  'Gridshot Challenge',
      desc:  'O exercício mais famoso do Aim Lab — mede velocidade, precisão e consistência',
      url:   'https://aimlab.gg/aim/tasks/gridshot',
      tag:   'Popular',
      color: '#ffa502',
    },
    {
      name:  'Tracking Fundamentals',
      desc:  'Progressão de tracking básico a avançado — do Circletrack ao Multilitrack',
      url:   'https://aimlab.gg/aim/tasks?mode=tracking',
      tag:   'Tracking',
      color: '#7b2fd4',
    },
  ],
}

// ── Training tips ──────────────────────────────────────────────────────────────
const TRAINING_TIPS = [
  { name: 'GOAT', desc: 'ideal para treinar mata-mata', cfxLink: 'cfx.re/join/q93zep' },
  { name: 'PLF',  desc: 'ideal para melhorar seus drops', cfxLink: 'cfx.re/join/oemxzx' },
]

export default function TrainingRoutine({ userId, sessionId, routine, username, onViewProgress, onChangeProfile, onConverter }) {
  const [completed, setCompleted]     = useState({})
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  const mainExercises  = routine.sections[1]?.exercises || []
  const completedCount = Object.values(completed).filter(Boolean).length
  const toolLabel      = routine.tool === 'kovaak' ? "KovaaK's" : 'Aim Lab'
  const toolColor      = routine.tool === 'kovaak' ? 'orange' : 'green'
  const playlists       = PLAYLISTS[routine.tool] || PLAYLISTS.aimlab

  const toggleExercise = (name) => setCompleted((p) => ({ ...p, [name]: !p[name] }))

  const handleFinish = async () => {
    setSaving(true)
    try {
      for (const [name, done] of Object.entries(completed)) {
        if (done)
          await saveProgress({ user_id: userId, session_id: sessionId, exercise_name: name, completed: 1 })
      }
      await saveProgress({
        user_id: userId, session_id: sessionId,
        exercise_name: '__session__', completed: 1, session_completed: true,
      })
      setSaved(true)
      toast.success(`Sessão finalizada! ${completedCount} exercício${completedCount !== 1 ? 's' : ''} concluído${completedCount !== 1 ? 's' : ''}.`)
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar sessão. Verifique sua conexão e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box className="routine">
      {/* ── Header ── */}
      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <Box>
          <Title order={1}>Rotina de Hoje</Title>
          <Group gap={6} mt={4}>
            <Text size="sm" c="dimmed">Olá, <Text span fw={700} c="var(--mantine-color-text)">{username}</Text> • Foco:</Text>
            <Badge variant="light">{FOCUS_LABELS[routine.focus_area] || routine.focus_area}</Badge>
            <Badge variant="light" color={toolColor}>{toolLabel}</Badge>
            <Badge variant="light" color="gray">{routine.total_duration} min</Badge>
          </Group>
        </Box>
        <Group gap="xs">
          <Button variant="light" leftSection={<IconChartBar size={16} />} onClick={onViewProgress}>
            Progresso
          </Button>
          <Button
            variant="subtle" color="gray"
            leftSection={<IconDeviceGamepad2 size={16} />}
            onClick={onConverter}
            title="Conversor de sensibilidade GTA V → KovaaK / Aim Lab"
          >
            Conversor
          </Button>
          <Button
            variant="subtle" color="gray"
            leftSection={<IconSettings size={16} />}
            onClick={onChangeProfile}
            title="Refazer questionário de perfil"
          >
            Alterar perfil
          </Button>
        </Group>
      </Group>

      {/* ── Goals ── */}
      <Goals />

      {/* ── Exercise sections ── */}
      <Stack gap="md" mb="lg">
        {routine.sections.map((section, si) => {
          const SectionIcon = SECTION_ICONS[section.name] || IconClipboardList
          return (
            <Card key={si} className={`section-card--${si}`}>
              <Group justify="space-between" mb="xs">
                <Group gap={6}>
                  <SectionIcon size={18} color="var(--mantine-color-brandCyan-5)" />
                  <Title order={3} size="h4">{section.name}</Title>
                </Group>
                <Badge variant="default">{section.duration} min</Badge>
              </Group>
              <Text size="sm" c="dimmed" mb="md">💡 {section.tip}</Text>

              {section.exercises.length > 0 ? (
                <Stack gap="xs">
                  {section.exercises.map((ex, idx) => {
                    const diff   = DIFFICULTY_LABELS[ex.difficulty] || { label: ex.difficulty, color: '#8892a4' }
                    const isMain = section.name === 'Treino Principal'
                    const isDone = !!completed[ex.name]

                    return (
                      <Card
                        key={ex.name}
                        withBorder
                        radius="md"
                        p="sm"
                        className={`exercise-card ${isDone ? 'done' : ''}`}
                        onClick={isMain ? () => toggleExercise(ex.name) : undefined}
                        style={{ cursor: isMain ? 'pointer' : 'default' }}
                      >
                        <Group wrap="nowrap" justify="space-between">
                          <Group wrap="nowrap" gap="sm">
                            <Text c="dimmed" size="sm" fw={700} w={22}>{String(idx + 1).padStart(2, '0')}</Text>
                            <Box>
                              <Text fw={700} size="sm" td={isDone ? 'line-through' : undefined} c={isDone ? 'dimmed' : undefined}>
                                {ex.name}
                              </Text>
                              <Text size="xs" c="dimmed">{ex.description}</Text>
                              <Group gap={6} mt={4}>
                                <Badge size="xs" variant="light" color={toolColor}>{toolLabel}</Badge>
                                <Badge size="xs" variant="outline" style={{ color: diff.color, borderColor: diff.color }}>
                                  {diff.label}
                                </Badge>
                              </Group>
                            </Box>
                          </Group>
                          <Group wrap="nowrap" gap="sm">
                            <Text size="xs" c="dimmed">{ex.duration} min</Text>
                            {isMain && <Checkbox checked={isDone} readOnly tabIndex={-1} style={{ pointerEvents: 'none' }} />}
                          </Group>
                        </Group>
                      </Card>
                    )
                  })}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed" fs="italic">
                  📝 Sessão de reflexão — anote suas observações e identifique o que melhorou hoje.
                </Text>
              )}
            </Card>
          )
        })}
      </Stack>

      {/* ── Footer ── */}
      <Card mb="lg">
        <Group justify="space-between" wrap="wrap" gap="md">
          <Box style={{ flex: 1, minWidth: 220 }}>
            <Text size="sm" mb={6}>{completedCount}/{mainExercises.length} exercícios concluídos</Text>
            <Progress value={mainExercises.length ? (completedCount / mainExercises.length) * 100 : 0} radius="xl" />
          </Box>
          {!saved ? (
            <Button
              onClick={handleFinish}
              loading={saving}
              disabled={completedCount === 0}
              title={completedCount === 0 ? 'Marque pelo menos um exercício para finalizar' : ''}
            >
              Finalizar Sessão ✓
            </Button>
          ) : (
            <Group gap={6}>
              <IconTrophy size={18} color="var(--mantine-color-yellow-5)" />
              <Text fw={700} c="green">Sessão salva! Bom treino, {username}!</Text>
            </Group>
          )}
        </Group>
      </Card>

      {/* ── Recommended Playlists ── */}
      <Box mb="lg">
        <Title order={3} size="h4">Playlists Recomendadas — {toolLabel}</Title>
        <Text size="sm" c="dimmed" mb="sm">Coleções curadas para acelerar sua evolução</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          {playlists.map((pl) => (
            <Card
              key={pl.name}
              component="a"
              href={pl.url}
              target="_blank"
              rel="noreferrer"
              className="playlist-card"
              style={{ '--pl-color': pl.color, cursor: 'pointer' }}
            >
              <Badge variant="outline" style={{ color: pl.color, borderColor: pl.color }} mb="xs">
                {pl.tag}
              </Badge>
              <Text fw={700} size="sm">{pl.name}</Text>
              <Text size="xs" c="dimmed" mb="xs">{pl.desc}</Text>
              <Text size="xs" fw={700} c="var(--mantine-color-brandCyan-5)">Acessar →</Text>
            </Card>
          ))}
        </SimpleGrid>
      </Box>

      {/* ── Training Tip ── */}
      <Card>
        <Text fw={700} mb="sm">💡 Onde treinar no FiveM</Text>
        <Stack gap="xs">
          {TRAINING_TIPS.map((tip) => (
            <Group justify="space-between" key={tip.name} wrap="wrap">
              <Text size="sm" c="dimmed"><Text span fw={700} c="var(--mantine-color-text)">{tip.name}</Text> — {tip.desc}</Text>
              <CopyButton value={tip.cfxLink}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copiado!' : 'Copiar link'} withArrow>
                    <Button
                      variant="light"
                      size="xs"
                      color={copied ? 'green' : 'brandCyan'}
                      rightSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      onClick={copy}
                    >
                      {tip.cfxLink}
                    </Button>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          ))}
        </Stack>
      </Card>
    </Box>
  )
}
