import { useState } from 'react'
import {
  Box, Group, Stack, Title, Text, Badge, Button, Card, Checkbox, Progress,
  SimpleGrid,
} from '@mantine/core'
import {
  IconChartBar, IconDeviceGamepad2, IconSettings, IconFlame, IconBolt,
  IconClipboardList, IconBrandDiscord, IconTrophy, IconSwords, IconTargetArrow,
} from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'
import { saveProgress } from '../services/api'
import { toast } from '../services/toast'

const DIFFICULTY_COLORS = { beginner: '#2ed573', intermediate: '#ffa502', advanced: '#ff4757' }

// New routines carry a machine-stable section key ('aquecimento' etc.).
// Routines generated before this existed carry the old PT prose directly in
// `name` — SECTION_KEYS lets us tell which one we're looking at and fall
// back to rendering the legacy text as-is.
const SECTION_KEYS = ['aquecimento', 'treino_principal', 'aplicacao_jogo']
const SECTION_ICONS = {
  aquecimento:                       IconFlame,
  treino_principal:                  IconBolt,
  aplicacao_jogo:                    IconSwords,
  // Legacy PT names — routines saved before section keys were introduced.
  'Aquecimento':                     IconFlame,
  'Treino Principal':                IconBolt,
  'Aplicação em Jogo (Mata-mata)':   IconSwords,
  // Legacy — routines saved before the mata-mata block replaced Revisão.
  'Revisão':                         IconClipboardList,
}

// Codes the backend may put in focus_area / main_weapon / specific_weakness
// that have a translated tip — anything else (unset, or a legacy/unknown
// value) is simply skipped when building the Treino Principal tip.
const FOCUS_TIP_CODES    = ['aim', 'reflex', 'movement']
const WEAPON_TIP_CODES   = ['pistola', 'rifle', 'shotgun', 'misto']
const WEAKNESS_TIP_CODES = ['moving_target', 'headshot', 'long_range', 'reaction']

// A section is checkable (its exercises can be ticked and count toward the
// day's completion/streak/total time) when it carries checkable: true.
// Routines persisted before this flag existed fall back to the old rule.
function isCheckableSection(section) {
  return section.checkable ?? (section.name === 'Treino Principal')
}

function sectionTitle(t, section) {
  return SECTION_KEYS.includes(section.name) ? t(`rotina.secoes.${section.name}`) : section.name
}

function sectionTip(t, routine, section) {
  if (section.tip) return section.tip // legacy — already-built PT prose
  if (section.name === 'aquecimento')    return t('rotina.tips.aquecimento')
  if (section.name === 'aplicacao_jogo') return t('rotina.tips.aplicacao_jogo')
  if (section.name === 'treino_principal') {
    const parts = []
    if (FOCUS_TIP_CODES.includes(routine.focus_area))       parts.push(t(`rotina.tips.focus.${routine.focus_area}`))
    if (WEAPON_TIP_CODES.includes(routine.main_weapon))     parts.push(t(`rotina.tips.weapon.${routine.main_weapon}`))
    if (WEAKNESS_TIP_CODES.includes(routine.specific_weakness)) parts.push(t(`rotina.tips.weakness.${routine.specific_weakness}`))
    return parts.join(' | ')
  }
  return ''
}

function levelNoteText(t, levelNote) {
  if (!levelNote) return ''
  if (levelNote === 'up' || levelNote === 'down') return t(`rotina.level_note.${levelNote}`)
  return levelNote // legacy — already-built PT prose
}

function levelNoteIsUp(levelNote) {
  return levelNote === 'up' || (typeof levelNote === 'string' && levelNote.startsWith('Meta aumentou'))
}

function exerciseTitle(t, ex) {
  // New-format in-game match: title is built from index/quota/focus code.
  if (ex.category === 'in-game' && ex.index != null) {
    return t('rotina.partida.titulo', {
      index: ex.index,
      quota: ex.kill_quota,
      focus: t(`rotina.focos.${ex.focus}.label`),
    })
  }
  return ex.name // proper noun (regular exercise) or legacy pre-built match title
}

function exerciseSubtitle(t, ex) {
  if (ex.category === 'in-game') {
    if (ex.index != null) return t(`rotina.focos.${ex.focus}.instrucao`)
    return ex.description || '' // legacy match — already-built PT prose
  }
  if (ex.key) return t(`rotina.exercicios.${ex.key}`)
  return ex.description || '' // legacy regular exercise
}

// ── Recommended playlists ─────────────────────────────────────────────────────
const PLAYLIST_IDS = {
  kovaak: ['voltaic_benchmark', 'smooth_click', 'voltaic_fps_pack'],
  aimlab: ['aim_lab_routines', 'gridshot_challenge', 'tracking_fundamentals'],
}
const PLAYLIST_META = {
  voltaic_benchmark:       { url: 'https://discord.gg/voltaic', color: '#ffa502' },
  smooth_click:            { url: 'https://steamcommunity.com/workshop/browse/?appid=824270&searchtext=smooth+click+training', color: '#00d4ff' },
  voltaic_fps_pack:        { url: 'https://steamcommunity.com/workshop/browse/?appid=824270&searchtext=voltaic+fps', color: '#7b2fd4' },
  aim_lab_routines:        { url: 'https://aimlab.gg/routines', color: '#2ed573' },
  gridshot_challenge:      { url: 'https://aimlab.gg/aim/tasks/gridshot', color: '#ffa502' },
  tracking_fundamentals:   { url: 'https://aimlab.gg/aim/tasks?mode=tracking', color: '#7b2fd4' },
}

// ── FiveM servers ──────────────────────────────────────────────────────────────
//
// Connecting happens through each server's Discord, not a direct cfx.re join
// link. discordKey is sent to the Electron main process (never the URL itself)
// which resolves it against a hardcoded allowlist before opening it — see
// electron/main.js EXTERNAL_LINKS. discordUrl is only used as a fallback when
// the app is opened in a plain browser (no Electron bridge available).
const FIVEM_SERVERS = [
  { name: 'GOAT', descKey: 'goat_desc', discordKey: 'discord-goat', discordUrl: 'https://discord.gg/goatgg' },
  { name: 'PLF',  descKey: 'plf_desc',  discordKey: 'discord-plf',  discordUrl: 'https://discord.gg/plfpvp' },
]

export default function TrainingRoutine({ userId, sessionId, routine, username, onViewProgress, onChangeProfile, onConverter, onTrainer }) {
  const { t } = useTranslation()
  const [completed, setCompleted]     = useState({})
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  const checkableExercises = routine.sections.flatMap((s) => (isCheckableSection(s) ? s.exercises || [] : []))
  const completedCount = Object.values(completed).filter(Boolean).length
  const toolLabel      = routine.tool === 'kovaak' ? "KovaaK's" : 'Aim Lab'
  const toolColor      = routine.tool === 'kovaak' ? 'orange' : 'green'
  const playlistIds     = PLAYLIST_IDS[routine.tool] || PLAYLIST_IDS.aimlab

  const toggleExercise = (name) => setCompleted((p) => ({ ...p, [name]: !p[name] }))

  const openDiscord = (server) => {
    if (window.electronAPI?.openLink) {
      window.electronAPI.openLink(server.discordKey)
    } else {
      window.open(server.discordUrl, '_blank', 'noopener,noreferrer')
    }
  }

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
      toast.success(t('rotina.toast_sessao_finalizada', { count: completedCount }))
    } catch (e) {
      console.error(e)
      toast.error(t('rotina.toast_erro_salvar_sessao'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box className="routine">
      {/* ── Header ── */}
      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <Box>
          <Title order={1}>{t('rotina.titulo')}</Title>
          <Group gap={6} mt={4}>
            <Text size="sm" c="dimmed">
              <Trans i18nKey="rotina.saudacao" values={{ name: username }} components={{ bold: <Text span fw={700} c="var(--mantine-color-text)" /> }} />
            </Text>
            <Badge variant="light">{t(`rotina.foco_label.${routine.focus_area}`, routine.focus_area)}</Badge>
            <Badge variant="light" color={toolColor}>{toolLabel}</Badge>
            <Badge variant="light" color="gray">{routine.total_duration} min</Badge>
          </Group>
        </Box>
        <Group gap="xs">
          <Button variant="light" leftSection={<IconChartBar size={16} />} onClick={onViewProgress}>
            {t('rotina.progresso')}
          </Button>
          <Button
            variant="subtle" color="gray"
            leftSection={<IconDeviceGamepad2 size={16} />}
            onClick={onConverter}
            title={t('rotina.conversor_tooltip')}
          >
            {t('rotina.conversor')}
          </Button>
          <Button
            variant="subtle" color="gray"
            leftSection={<IconSettings size={16} />}
            onClick={onChangeProfile}
            title={t('rotina.alterar_perfil_tooltip')}
          >
            {t('rotina.alterar_perfil')}
          </Button>
        </Group>
      </Group>

      {/* ── Exercise sections ── */}
      <Stack gap="md" mb="lg">
        {routine.sections.map((section, si) => {
          const SectionIcon = SECTION_ICONS[section.name] || IconClipboardList
          const noteText     = levelNoteText(t, section.level_note)
          return (
            <Card key={si} className={`section-card--${si}`}>
              <Group justify="space-between" mb="xs">
                <Group gap={6}>
                  <SectionIcon size={18} color="var(--mantine-color-brandCyan-5)" />
                  <Title order={3} size="h4">{sectionTitle(t, section)}</Title>
                  {section.level != null && <Badge size="xs" variant="light" color="gray">{t('rotina.nivel', { level: section.level })}</Badge>}
                </Group>
                <Group gap="xs">
                  {(section.name === 'treino_principal' || section.name === 'Treino Principal') && routine.focus_area === 'aim' && onTrainer && (
                    <Button
                      size="xs" variant="light" color="brandCyan"
                      leftSection={<IconTargetArrow size={14} />}
                      onClick={() => onTrainer(routine.recommended_trainer)}
                    >
                      {t('rotina.treinar_no_app')}
                      {routine.recommended_trainer && (
                        <> · {t('rotina.recomendado', { difficulty: t(`trainer.dificuldades.${routine.recommended_trainer.difficulty}`) })}</>
                      )}
                    </Button>
                  )}
                  <Badge variant="default">{section.duration} min</Badge>
                </Group>
              </Group>
              <Text size="sm" c="dimmed" mb={noteText ? 4 : 'md'}>💡 {sectionTip(t, routine, section)}</Text>
              {noteText && (
                <Text size="xs" fw={600} mb="md" c={levelNoteIsUp(section.level_note) ? 'green' : 'orange'}>
                  {noteText}
                </Text>
              )}

              {section.exercises.length > 0 ? (
                <Stack gap="xs">
                  {section.exercises.map((ex, idx) => {
                    const isInGame    = ex.category === 'in-game'
                    const diff        = ex.difficulty ? { label: t(`rotina.dificuldade.${ex.difficulty}`, ex.difficulty), color: DIFFICULTY_COLORS[ex.difficulty] || '#8892a4' } : null
                    const isCheckable = isCheckableSection(section)
                    const isDone      = !!completed[ex.name]

                    return (
                      <Card
                        key={ex.name}
                        withBorder
                        radius="md"
                        p="sm"
                        className={`exercise-card ${isDone ? 'done' : ''}`}
                        onClick={isCheckable ? () => toggleExercise(ex.name) : undefined}
                        style={{ cursor: isCheckable ? 'pointer' : 'default' }}
                      >
                        <Group wrap="nowrap" justify="space-between">
                          <Group wrap="nowrap" gap="sm">
                            <Text c="dimmed" size="sm" fw={700} w={22}>{String(idx + 1).padStart(2, '0')}</Text>
                            <Box>
                              <Text fw={700} size="sm" td={isDone ? 'line-through' : undefined} c={isDone ? 'dimmed' : undefined}>
                                {exerciseTitle(t, ex)}
                              </Text>
                              <Text size="xs" c="dimmed">{exerciseSubtitle(t, ex)}</Text>
                              <Group gap={6} mt={4}>
                                {isInGame ? (
                                  <Badge size="xs" variant="light" color="indigo">{t('rotina.in_game_badge')}</Badge>
                                ) : (
                                  <Badge size="xs" variant="light" color={toolColor}>{toolLabel}</Badge>
                                )}
                                {diff && (
                                  <Badge size="xs" variant="outline" style={{ color: diff.color, borderColor: diff.color }}>
                                    {diff.label}
                                  </Badge>
                                )}
                              </Group>
                            </Box>
                          </Group>
                          <Group wrap="nowrap" gap="sm">
                            <Text size="xs" c="dimmed">{ex.duration} min</Text>
                            {isCheckable && <Checkbox checked={isDone} readOnly tabIndex={-1} style={{ pointerEvents: 'none' }} />}
                          </Group>
                        </Group>
                      </Card>
                    )
                  })}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed" fs="italic">
                  {t('rotina.reflexao_placeholder')}
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
            <Text size="sm" mb={6}>{t('rotina.exercicios_concluidos', { completed: completedCount, total: checkableExercises.length })}</Text>
            <Progress value={checkableExercises.length ? (completedCount / checkableExercises.length) * 100 : 0} radius="xl" />
          </Box>
          {!saved ? (
            <Button
              onClick={handleFinish}
              loading={saving}
              disabled={completedCount === 0}
              title={completedCount === 0 ? t('rotina.marque_pelo_menos_um') : ''}
            >
              {t('rotina.finalizar_sessao')}
            </Button>
          ) : (
            <Group gap={6}>
              <IconTrophy size={18} color="var(--mantine-color-yellow-5)" />
              <Text fw={700} c="green">{t('rotina.sessao_salva', { name: username })}</Text>
            </Group>
          )}
        </Group>
      </Card>

      {/* ── Recommended Playlists ── */}
      <Box mb="lg">
        <Title order={3} size="h4">{t('rotina.playlists.titulo', { tool: toolLabel })}</Title>
        <Text size="sm" c="dimmed" mb="sm">{t('rotina.playlists.subtitulo')}</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          {playlistIds.map((id) => {
            const meta = PLAYLIST_META[id]
            const base = `rotina.playlists.${routine.tool === 'kovaak' ? 'kovaak' : 'aimlab'}.${id}`
            return (
              <Card
                key={id}
                component="a"
                href={meta.url}
                target="_blank"
                rel="noreferrer"
                className="playlist-card"
                style={{ '--pl-color': meta.color, cursor: 'pointer' }}
              >
                <Badge variant="outline" style={{ color: meta.color, borderColor: meta.color }} mb="xs">
                  {t(`${base}.tag`)}
                </Badge>
                <Text fw={700} size="sm">{t(`${base}.nome`)}</Text>
                <Text size="xs" c="dimmed" mb="xs">{t(`${base}.desc`)}</Text>
                <Text size="xs" fw={700} c="var(--mantine-color-brandCyan-5)">{t('rotina.playlists.acessar')}</Text>
              </Card>
            )
          })}
        </SimpleGrid>
      </Box>

      {/* ── Training Tip ── */}
      <Card>
        <Text fw={700} mb="sm">{t('rotina.servidores.titulo')}</Text>
        <Text size="xs" c="dimmed" mb="sm">{t('rotina.servidores.subtitulo')}</Text>
        <Stack gap="xs">
          {FIVEM_SERVERS.map((server) => (
            <Group justify="space-between" key={server.name} wrap="wrap">
              <Text size="sm" c="dimmed"><Text span fw={700} c="var(--mantine-color-text)">{server.name}</Text> — {t(`rotina.servidores.${server.descKey}`)}</Text>
              <Button
                variant="light"
                size="xs"
                color="indigo"
                leftSection={<IconBrandDiscord size={14} />}
                onClick={() => openDiscord(server)}
              >
                {t('rotina.servidores.discord')}
              </Button>
            </Group>
          ))}
        </Stack>
      </Card>
    </Box>
  )
}
