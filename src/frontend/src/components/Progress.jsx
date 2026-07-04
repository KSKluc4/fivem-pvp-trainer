import { useState, useEffect } from 'react'
import {
  Box, Group, Stack, Title, Text, Button, Card, Paper, Badge, Progress as MProgress,
  SimpleGrid, Skeleton, Grid,
} from '@mantine/core'
import { BarChart } from '@mantine/charts'
import {
  IconArrowLeft, IconCalendar, IconFlame, IconClipboardList, IconCircleCheck,
  IconChartPie, IconTrendingUp, IconMedal, IconArchive,
} from '@tabler/icons-react'
import { getProgress } from '../services/api'

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const ACHIEVEMENTS = [
  { id: 'first',   name: 'Primeira Batalha', desc: 'Complete 1 sessão',        icon: '🎯', goal: 1,  key: 'completed' },
  { id: 'streak3', name: 'Em Chamas',        desc: '3 dias consecutivos',       icon: '🔥', goal: 3,  key: 'streak'    },
  { id: 'sess5',   name: 'Consistente',      desc: '5 sessões completas',       icon: '⚔️', goal: 5,  key: 'completed' },
  { id: 'streak7', name: 'Semana Perfeita',  desc: '7 dias seguidos',           icon: '💫', goal: 7,  key: 'streak'    },
  { id: 'sess10',  name: 'Dedicado',         desc: '10 sessões completas',      icon: '🏅', goal: 10, key: 'completed' },
  { id: 'sess30',  name: 'Veterano',         desc: '30 sessões completas',      icon: '🏆', goal: 30, key: 'completed' },
]

export default function Progress({ userId, username, onBack }) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProgress(userId)
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) {
    return (
      <Box className="progress-view">
        <Skeleton height={36} width="40%" mb="lg" />
        <Card mb="lg"><Skeleton height={90} /></Card>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="lg">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={90} />)}
        </SimpleGrid>
        <Card><Skeleton height={160} /></Card>
      </Box>
    )
  }

  const total          = data.length
  const completed      = data.filter((s) => s.completed).length
  const streak         = calcStreak(data)
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
  const weekCalendar   = getWeekCalendar(data)
  const weeklyData     = getWeeklyData(data)
  const stats          = { completed, streak }

  return (
    <Box className="progress-view">
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={1}>Seu Progresso</Title>
          <Text c="dimmed" size="sm">{username}</Text>
        </Box>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          Voltar ao Treino
        </Button>
      </Group>

      <Grid mb="lg" align="stretch">
        {/* ── Streak spotlight ── */}
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Paper p="lg" h="100%" style={{ background: 'linear-gradient(135deg, rgba(255,165,2,0.12), transparent)' }}>
            <Stack align="center" justify="center" h="100%" gap={4}>
              <IconFlame size={36} color="var(--mantine-color-orange-5)" />
              <Text fw={900} size="48px" lh={1}>{streak}</Text>
              <Text size="sm" c="dimmed">dia{streak !== 1 ? 's' : ''} seguido{streak !== 1 ? 's' : ''}</Text>
            </Stack>
          </Paper>
        </Grid.Col>

        {/* ── Weekly Calendar ── */}
        <Grid.Col span={{ base: 12, sm: 8 }}>
          <Card h="100%">
            <Group gap={6} mb="sm">
              <IconCalendar size={18} color="var(--mantine-color-brandCyan-5)" />
              <Text fw={700} size="sm">Últimos 7 Dias</Text>
            </Group>
            <SimpleGrid cols={7} spacing={6}>
              {weekCalendar.map((day, i) => (
                <Paper
                  key={i}
                  p={6}
                  withBorder
                  ta="center"
                  style={{
                    borderColor: day.completed ? 'var(--mantine-color-green-6)' : undefined,
                    background: day.completed ? 'rgba(46,213,115,0.08)' : undefined,
                  }}
                >
                  <Text size="xs" c="dimmed">{day.label}</Text>
                  <Text size="sm" fw={700} c={day.completed ? 'green' : day.today ? 'brandCyan' : 'dimmed'}>
                    {day.completed ? '✓' : day.today ? '◉' : '○'}
                  </Text>
                </Paper>
              ))}
            </SimpleGrid>
          </Card>
        </Grid.Col>
      </Grid>

      {/* ── Stats Grid ── */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="lg">
        <StatCard number={total}          label="Sessões geradas"   icon={IconClipboardList} color="brandCyan"   />
        <StatCard number={completed}      label="Sessões completas" icon={IconCircleCheck}   color="green"       />
        <StatCard number={`${completionRate}%`} label="Conclusão"   icon={IconChartPie}      color="brandPurple" />
        <StatCard number={weeklyData.length} label="Semanas ativas" icon={IconTrendingUp}    color="orange"      />
      </SimpleGrid>

      {/* ── Weekly Evolution Chart ── */}
      {weeklyData.length > 0 && (
        <Card mb="lg">
          <Group gap={6} mb="md">
            <IconTrendingUp size={18} color="var(--mantine-color-brandCyan-5)" />
            <Text fw={700} size="sm">Evolução Semanal</Text>
          </Group>
          <BarChart
            h={220}
            data={weeklyData}
            dataKey="label"
            series={[
              { name: 'total',     color: 'gray.6',  label: 'Sessões geradas' },
              { name: 'completed', color: 'green.6', label: 'Sessões completas' },
            ]}
            tickLine="y"
            withLegend
            legendProps={{ verticalAlign: 'bottom' }}
          />
        </Card>
      )}

      {/* ── Completion Rate Bar ── */}
      {total > 0 && (
        <Card mb="lg">
          <Group justify="space-between" mb="xs">
            <Group gap={6}>
              <IconChartPie size={18} color="var(--mantine-color-brandCyan-5)" />
              <Text fw={700} size="sm">Taxa de Conclusão</Text>
            </Group>
            <Badge variant="light">{completionRate}%</Badge>
          </Group>
          <MProgress value={completionRate} radius="xl" size="lg" mb={6} />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">{completed} completa{completed !== 1 ? 's' : ''}</Text>
            <Text size="xs" c="dimmed">{total - completed} em andamento</Text>
          </Group>
        </Card>
      )}

      {/* ── Achievements ── */}
      <Card mb="lg">
        <Group gap={6} mb="md">
          <IconMedal size={18} color="var(--mantine-color-orange-5)" />
          <Text fw={700} size="sm">Conquistas</Text>
        </Group>
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
          {ACHIEVEMENTS.map((ach) => {
            const current  = stats[ach.key] ?? 0
            const unlocked = current >= ach.goal
            const pct      = Math.min((current / ach.goal) * 100, 100)
            return (
              <Paper
                key={ach.id}
                p="sm"
                withBorder
                ta="center"
                style={unlocked ? { borderColor: 'var(--mantine-color-orange-5)', background: 'rgba(255,165,2,0.06)' } : undefined}
              >
                <Text size="xl">{ach.icon}</Text>
                <Text fw={700} size="sm">{ach.name}</Text>
                <Text size="xs" c="dimmed" mb={6}>{ach.desc}</Text>
                {unlocked ? (
                  <Badge color="orange" variant="light">✓ Desbloqueado</Badge>
                ) : (
                  <>
                    <MProgress value={pct} size="sm" radius="xl" mb={4} />
                    <Text size="xs" c="dimmed">{current}/{ach.goal}</Text>
                  </>
                )}
              </Paper>
            )
          })}
        </SimpleGrid>
      </Card>

      {/* ── Session History ── */}
      <Card>
        <Group gap={6} mb="md">
          <IconArchive size={18} color="var(--mantine-color-brandCyan-5)" />
          <Text fw={700} size="sm">Histórico de Sessões</Text>
        </Group>
        {data.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic">📭 Nenhuma sessão registrada ainda. Complete sua primeira rotina!</Text>
        ) : (
          <Stack gap={6}>
            {data.map((session, i) => (
              <Group key={i} justify="space-between" p={8} className="history-item">
                <Text size="sm">{formatDate(session.date)}</Text>
                <Text size="sm" c="dimmed">{session.exercises_logged} exercício(s)</Text>
                <Badge color={session.completed ? 'green' : 'gray'} variant="light">
                  {session.completed ? '✓ Completo' : '● Em andamento'}
                </Badge>
              </Group>
            ))}
          </Stack>
        )}
      </Card>
    </Box>
  )
}

function StatCard({ number, label, icon: Icon, color }) {
  return (
    <Paper p="md" ta="center">
      <Icon size={22} color={`var(--mantine-color-${color}-5)`} />
      <Text fw={900} size="1.4rem" c={color}>{number}</Text>
      <Text size="xs" c="dimmed">{label}</Text>
    </Paper>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function calcStreak(sessions) {
  const completed = sessions.filter((s) => s.completed).map((s) => s.date).sort().reverse()
  if (!completed.length) return 0
  let streak = 0
  let prev   = new Date(); prev.setHours(0, 0, 0, 0)
  for (const d of completed) {
    const curr = new Date(d + 'T00:00:00')
    if (Math.round((prev - curr) / 86400000) <= 1) { streak++; prev = curr } else break
  }
  return streak
}

function getWeekCalendar(sessions) {
  const completedDates = new Set(sessions.filter((s) => s.completed).map((s) => s.date))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    return { label: DAY_NAMES[d.getDay()], completed: completedDates.has(dateStr), today: i === 6 }
  })
}

function getWeeklyData(sessions) {
  const weeks = {}
  sessions.forEach((s) => {
    if (!s.date) return
    const d   = new Date(s.date + 'T00:00:00')
    const day = d.getDay()
    const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    const key = mon.toISOString().split('T')[0]
    if (!weeks[key]) weeks[key] = { total: 0, completed: 0, mon }
    weeks[key].total++
    if (s.completed) weeks[key].completed++
  })
  return Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-4)
    .map(([, w]) => ({ ...w, label: weekLabel(w.mon) }))
}

function weekLabel(mon) {
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const f   = (d) => `${d.getDate()}/${d.getMonth() + 1}`
  return `${f(mon)}–${f(sun)}`
}
