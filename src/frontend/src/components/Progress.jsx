import { useState, useEffect } from 'react'
import {
  Box, Group, Stack, Title, Text, Button, Card, Paper, Badge, Progress as MProgress,
  SimpleGrid, Skeleton, Grid, SegmentedControl,
} from '@mantine/core'
import { BarChart, LineChart } from '@mantine/charts'
import {
  IconArrowLeft, IconCalendar, IconFlame, IconClipboardList, IconCircleCheck,
  IconChartPie, IconTrendingUp, IconMedal, IconArchive, IconTargetArrow,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { getProgress } from '../services/api'
import { useAllTrainerScores } from '../trainer/useAllTrainerScores'
import { EXERCISE_IDS } from '../trainer/scenarios/index.js'
import { exerciseAimLevel, overallAimLevel } from '../trainer/aimLevel.js'

const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

const ACHIEVEMENTS = [
  { id: 'first',   icon: '🎯', goal: 1,  key: 'completed' },
  { id: 'streak3', icon: '🔥', goal: 3,  key: 'streak'    },
  { id: 'sess5',   icon: '⚔️', goal: 5,  key: 'completed' },
  { id: 'streak7', icon: '💫', goal: 7,  key: 'streak'    },
  { id: 'sess10',  icon: '🏅', goal: 10, key: 'completed' },
  { id: 'sess30',  icon: '🏆', goal: 30, key: 'completed' },
]

export default function Progress({ userId, username, onBack }) {
  const { t } = useTranslation()
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const { scoresByExercise, loading: aimLoading } = useAllTrainerScores()
  const [selectedExercise, setSelectedExercise] = useState(EXERCISE_IDS[0])

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
          <Title order={1}>{t('dashboard.titulo')}</Title>
          <Text c="dimmed" size="sm">{username}</Text>
        </Box>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          {t('dashboard.voltar_ao_treino')}
        </Button>
      </Group>

      <Grid mb="lg" align="stretch">
        {/* ── Streak spotlight ── */}
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Paper p="lg" h="100%" style={{ background: 'linear-gradient(135deg, rgba(255,165,2,0.12), transparent)' }}>
            <Stack align="center" justify="center" h="100%" gap={4}>
              <IconFlame size={36} color="var(--mantine-color-orange-5)" />
              <Text fw={900} size="48px" lh={1}>{streak}</Text>
              <Text size="sm" c="dimmed">{t('dashboard.dias_seguidos', { count: streak })}</Text>
            </Stack>
          </Paper>
        </Grid.Col>

        {/* ── Weekly Calendar ── */}
        <Grid.Col span={{ base: 12, sm: 8 }}>
          <Card h="100%">
            <Group gap={6} mb="sm">
              <IconCalendar size={18} color="var(--mantine-color-brandCyan-5)" />
              <Text fw={700} size="sm">{t('dashboard.ultimos_7_dias')}</Text>
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
                  <Text size="xs" c="dimmed">{t(`dashboard.dias.${day.dayKey}`)}</Text>
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
        <StatCard number={total}          label={t('dashboard.stats.sessoes_geradas')}   icon={IconClipboardList} color="brandCyan"   />
        <StatCard number={completed}      label={t('dashboard.stats.sessoes_completas')} icon={IconCircleCheck}   color="green"       />
        <StatCard number={`${completionRate}%`} label={t('dashboard.stats.conclusao')}   icon={IconChartPie}      color="brandPurple" />
        <StatCard number={weeklyData.length} label={t('dashboard.stats.semanas_ativas')} icon={IconTrendingUp}    color="orange"      />
      </SimpleGrid>

      {/* ── Weekly Evolution Chart ── */}
      {weeklyData.length > 0 && (
        <Card mb="lg">
          <Group gap={6} mb="md">
            <IconTrendingUp size={18} color="var(--mantine-color-brandCyan-5)" />
            <Text fw={700} size="sm">{t('dashboard.evolucao_semanal.titulo')}</Text>
          </Group>
          <BarChart
            h={220}
            data={weeklyData}
            dataKey="label"
            series={[
              { name: 'total',     color: 'gray.6',  label: t('dashboard.evolucao_semanal.serie_geradas') },
              { name: 'completed', color: 'green.6', label: t('dashboard.evolucao_semanal.serie_completas') },
            ]}
            tickLine="y"
            withLegend
            legendProps={{ verticalAlign: 'bottom' }}
          />
        </Card>
      )}

      {/* ── Aim Progress ── */}
      <AimProgressSection
        t={t}
        scoresByExercise={scoresByExercise}
        loading={aimLoading}
        selectedExercise={selectedExercise}
        onSelectExercise={setSelectedExercise}
      />

      {/* ── Completion Rate Bar ── */}
      {total > 0 && (
        <Card mb="lg">
          <Group justify="space-between" mb="xs">
            <Group gap={6}>
              <IconChartPie size={18} color="var(--mantine-color-brandCyan-5)" />
              <Text fw={700} size="sm">{t('dashboard.taxa_conclusao.titulo')}</Text>
            </Group>
            <Badge variant="light">{completionRate}%</Badge>
          </Group>
          <MProgress value={completionRate} radius="xl" size="lg" mb={6} />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">{completed} {t('dashboard.taxa_conclusao.completa', { count: completed })}</Text>
            <Text size="xs" c="dimmed">{total - completed} {t('dashboard.taxa_conclusao.em_andamento')}</Text>
          </Group>
        </Card>
      )}

      {/* ── Achievements ── */}
      <Card mb="lg">
        <Group gap={6} mb="md">
          <IconMedal size={18} color="var(--mantine-color-orange-5)" />
          <Text fw={700} size="sm">{t('dashboard.conquistas.titulo')}</Text>
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
                <Text fw={700} size="sm">{t(`dashboard.conquistas.lista.${ach.id}.nome`)}</Text>
                <Text size="xs" c="dimmed" mb={6}>{t(`dashboard.conquistas.lista.${ach.id}.desc`)}</Text>
                {unlocked ? (
                  <Badge color="orange" variant="light">{t('dashboard.conquistas.desbloqueado')}</Badge>
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
          <Text fw={700} size="sm">{t('dashboard.historico.titulo')}</Text>
        </Group>
        {data.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic">{t('dashboard.historico.vazio')}</Text>
        ) : (
          <Stack gap={6}>
            {data.map((session, i) => (
              <Group key={i} justify="space-between" p={8} className="history-item">
                <Text size="sm">{formatDate(session.date)}</Text>
                <Text size="sm" c="dimmed">{t('dashboard.historico.exercicios_registrados', { count: session.exercises_logged })}</Text>
                <Badge color={session.completed ? 'green' : 'gray'} variant="light">
                  {session.completed ? t('dashboard.historico.completo') : t('dashboard.historico.em_andamento')}
                </Badge>
              </Group>
            ))}
          </Stack>
        )}
      </Card>
    </Box>
  )
}

function AimProgressSection({ t, scoresByExercise, loading, selectedExercise, onSelectExercise }) {
  const hasAnyData = EXERCISE_IDS.some((id) => (scoresByExercise[id] || []).length > 0)
  const perExerciseLevels = Object.fromEntries(
    EXERCISE_IDS.map((id) => [id, exerciseAimLevel(scoresByExercise[id] || [])]),
  )
  const overall = overallAimLevel(perExerciseLevels)
  const withLevel = EXERCISE_IDS.filter((id) => perExerciseLevels[id] != null)
  const strongest = withLevel.length
    ? withLevel.reduce((a, b) => (perExerciseLevels[b] > perExerciseLevels[a] ? b : a))
    : null
  const weakest = withLevel.length > 1
    ? withLevel.reduce((a, b) => (perExerciseLevels[b] < perExerciseLevels[a] ? b : a))
    : null

  const scores = scoresByExercise[selectedExercise] || []
  const chartData = scores.slice().reverse().map((s) => ({ label: shortDate(s.created_at), score: s.score }))
  const record = scores.reduce((best, s) => (best == null || s.score > best ? s.score : best), null)
  const recentAvg = avgInWindow(scores, 0, 7)
  const priorAvg  = avgInWindow(scores, 7, 14)
  const pctChange = recentAvg != null && priorAvg ? ((recentAvg - priorAvg) / priorAvg) * 100 : null

  return (
    <Card mb="lg">
      <Group gap={6} mb="md">
        <IconTargetArrow size={18} color="var(--mantine-color-brandCyan-5)" />
        <Text fw={700} size="sm">{t('dashboard.aim_progress.titulo')}</Text>
      </Group>

      {loading ? (
        <Skeleton height={160} />
      ) : !hasAnyData ? (
        <Text size="sm" c="dimmed" fs="italic">{t('dashboard.aim_progress.vazio')}</Text>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
            <Paper p="sm" ta="center" withBorder>
              <Text size="xs" c="dimmed">{t('dashboard.aim_progress.nivel_geral')}</Text>
              <Text fw={900} size="1.4rem" c="brandCyan">{overall != null ? overall.toFixed(1) : '—'}</Text>
            </Paper>
            <Paper p="sm" ta="center" withBorder>
              <Text size="xs" c="dimmed">{t('dashboard.aim_progress.mais_forte')}</Text>
              <Text fw={700} size="sm">{strongest ? t(`trainer.exercicios.${strongest}.nome`) : '—'}</Text>
            </Paper>
            <Paper p="sm" ta="center" withBorder>
              <Text size="xs" c="dimmed">{t('dashboard.aim_progress.mais_fraco')}</Text>
              <Text fw={700} size="sm">{weakest ? t(`trainer.exercicios.${weakest}.nome`) : '—'}</Text>
            </Paper>
          </SimpleGrid>

          {weakest && (
            <Text size="xs" c="dimmed" mb="md">
              {t('dashboard.aim_progress.sugestao', { exercise: t(`trainer.exercicios.${weakest}.nome`) })}
            </Text>
          )}

          <SegmentedControl
            fullWidth
            mb="md"
            value={selectedExercise}
            onChange={onSelectExercise}
            data={EXERCISE_IDS.map((id) => ({ label: t(`trainer.exercicios.${id}.nome`), value: id }))}
          />

          {scores.length === 0 ? (
            <Text size="sm" c="dimmed" fs="italic">{t('dashboard.aim_progress.exercicio_vazio')}</Text>
          ) : (
            <>
              <Group gap="xl" mb="sm">
                <Box>
                  <Text size="xs" c="dimmed">{t('dashboard.aim_progress.recorde')}</Text>
                  <Text fw={800}>{record}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">{t('dashboard.aim_progress.media_7d')}</Text>
                  <Group gap={4}>
                    <Text fw={800}>{recentAvg != null ? Math.round(recentAvg) : '—'}</Text>
                    {pctChange != null && (
                      <Badge size="xs" color={pctChange >= 0 ? 'green' : 'red'} variant="light">
                        {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(0)}%
                      </Badge>
                    )}
                  </Group>
                </Box>
              </Group>
              <LineChart
                h={200}
                data={chartData}
                dataKey="label"
                series={[{ name: 'score', color: 'brandCyan.5', label: t('dashboard.aim_progress.serie_score') }]}
                curveType="linear"
                withDots={chartData.length <= 30}
              />
            </>
          )}
        </>
      )}
    </Card>
  )
}

// Average score for entries whose created_at falls within [now - toDays, now - fromDays)
// — fromDays=0,toDays=7 is "last 7 days", fromDays=7,toDays=14 is "the 7 days before that".
function avgInWindow(scores, fromDays, toDays) {
  const now   = Date.now()
  const start = now - toDays * 86400000
  const end   = now - fromDays * 86400000
  const bucket = scores.filter((s) => {
    const t = new Date(s.created_at).getTime()
    return t >= start && t < end
  })
  if (bucket.length === 0) return null
  return bucket.reduce((sum, s) => sum + s.score, 0) / bucket.length
}

function shortDate(isoStr) {
  const d = new Date(isoStr)
  return `${d.getDate()}/${d.getMonth() + 1}`
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
    return { dayKey: DAY_KEYS[d.getDay()], completed: completedDates.has(dateStr), today: i === 6 }
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
