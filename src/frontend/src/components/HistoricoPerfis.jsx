import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box, Group, Stack, Title, Text, Button, Card, Badge, Pagination, Modal, Skeleton, Center,
  SimpleGrid, Tooltip,
} from '@mantine/core'
import { IconArrowLeft, IconHistory } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { getQuestionnaireHistory, reactivateProfile } from '../services/api'
import { toast } from '../services/toast'

const PAGE_SIZE = 10

// SPEC-006 — lists every past questionnaire_results row (newest first) and
// lets the user "reactivate" one: a NEW snapshot row gets created from the
// chosen profile's answers (the old row is never touched) and today's
// routine is regenerated from it. `onReactivated` gets the same
// {user_id, session_id, name, routine} shape a fresh questionnaire submit
// returns, so App.jsx can reuse handleQuestionnaireComplete for both.
export default function HistoricoPerfis({ onBack, onReactivated }) {
  const { t } = useTranslation()
  const [page, setPage]           = useState(1)
  const [items, setItems]         = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [confirmId, setConfirmId] = useState(null)
  const [reactivating, setReactivating] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getQuestionnaireHistory(page, PAGE_SIZE)
      .then((res) => { setItems(res.data.items); setTotal(res.data.total) })
      .catch(() => { setItems([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  // Purely a display grouping (layout polish) — consecutive rows on this
  // page with an identical answer set collapse into one card with a
  // "respondido Nx" counter. Each row still exists on its own in
  // questionnaire_results and reactivates exactly as before.
  const groups = useMemo(() => groupConsecutiveDuplicates(items), [items])

  const handleReactivate = async () => {
    if (confirmId == null) return
    setReactivating(true)
    try {
      const res = await reactivateProfile(confirmId)
      toast.success(t('historico_perfis.reativar_sucesso'))
      onReactivated(res.data)
    } catch {
      toast.error(t('comum.erros.erro_generico'))
      setReactivating(false)
      setConfirmId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Box className="historico-perfis-view">
      <Group justify="space-between" mb={total > 0 ? 4 : 'lg'} wrap="wrap">
        <Group gap={6}>
          <IconHistory size={20} color="var(--mantine-color-brandCyan-5)" />
          <Title order={1} size="h2">{t('historico_perfis.titulo')}</Title>
        </Group>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          {t('comum.voltar')}
        </Button>
      </Group>

      {!loading && total > 0 && (
        <Text c="dimmed" size="sm" mb="lg">
          {t('historico_perfis.contagem', { count: total })}
        </Text>
      )}

      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={110} radius="md" />)}
        </SimpleGrid>
      ) : items.length === 0 ? (
        <Text c="dimmed" fs="italic">{t('historico_perfis.vazio')}</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="lg">
          {groups.map((group, gi) => (
            <ProfileCard
              key={group.items[0].id}
              group={group}
              isCurrent={page === 1 && gi === 0}
              t={t}
              onReactivate={() => setConfirmId(group.items[0].id)}
            />
          ))}
        </SimpleGrid>
      )}

      {totalPages > 1 && (
        <Center mb="lg">
          <Pagination value={page} onChange={setPage} total={totalPages} />
        </Center>
      )}

      <Modal
        opened={confirmId != null}
        onClose={() => setConfirmId(null)}
        title={t('historico_perfis.reativar_confirmar_titulo')}
        centered
      >
        <Stack gap="md">
          <Text size="sm">{t('historico_perfis.reativar_confirmar_corpo')}</Text>
          <Group grow>
            <Button loading={reactivating} onClick={handleReactivate}>
              {t('historico_perfis.reativar')}
            </Button>
            <Button variant="light" color="gray" onClick={() => setConfirmId(null)} disabled={reactivating}>
              {t('comum.cancelar')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}

function ProfileCard({ group, isCurrent, t, onReactivate }) {
  const item = group.items[0] // most recent occurrence in the group
  const label = (field, value) => t(`questionario.perguntas.${field}.opcoes.${value}.label`, value)
  const badgeText = (field) => (item[field] || []).map((v) => label(field, v)).join(' + ')
  const preview = item.preview || {}
  const drillName = (id) => t(`trainer.exercicios.${id}.nome`, id)

  const detailLine = [
    t(`questionario.perguntas.experience_level.opcoes.${item.experience_level}.label`, item.experience_level),
    t('historico_perfis.minutos_dia', { minutes: item.daily_time }),
    t('historico_perfis.preview_texto', {
      warmup:    preview.warmup_drill ? drillName(preview.warmup_drill) : '—',
      principal: preview.main_drills?.length ? preview.main_drills.map(drillName).join(' + ') : '—',
      matches:   preview.match_count ?? 0,
      duration:  preview.total_duration ?? 0,
    }),
  ].join(' · ')

  return (
    <Card withBorder p="md">
      <Group justify="space-between" wrap="nowrap" gap="xs" mb={6}>
        <Text size="sm" fw={600}>{formatDate(item.created_at)}</Text>
        {isCurrent ? (
          <Badge size="sm" color="brandCyan" variant="light">{t('historico_perfis.perfil_atual')}</Badge>
        ) : (
          <Button variant="light" size="xs" onClick={onReactivate}>
            {t('historico_perfis.reativar')}
          </Button>
        )}
      </Group>

      <Group gap={6} mb={6}>
        {item.focus_area?.length > 0 && <Badge size="sm" variant="light">{badgeText('focus_area')}</Badge>}
        {item.aim_difficulty?.length > 0 && <Badge size="sm" variant="light" color="brandPurple">{badgeText('aim_difficulty')}</Badge>}
        {item.specific_weakness?.length > 0 && <Badge size="sm" variant="light" color="orange">{badgeText('specific_weakness')}</Badge>}
      </Group>

      <Tooltip label={detailLine} openDelay={400} multiline maw={320} disabled={detailLine.length < 60}>
        <Text size="xs" c="dimmed" truncate="end">{detailLine}</Text>
      </Tooltip>

      {group.items.length > 1 && (
        <Text size="xs" c="dimmed" fs="italic" mt={6}>
          {t('historico_perfis.respondido_multiplas', { count: group.items.length, date: formatDate(item.created_at) })}
        </Text>
      )}
    </Card>
  )
}

// Compares the actual answer SET (order-independent for the multi-select
// fields), never the row id/created_at — two rows with identical answers
// group even if reactivating created the newer one from the older one.
function profileSignature(item) {
  return JSON.stringify({
    focus_area:        [...(item.focus_area || [])].sort(),
    aim_difficulty:    [...(item.aim_difficulty || [])].sort(),
    specific_weakness: [...(item.specific_weakness || [])].sort(),
    experience_level:  item.experience_level,
    reflex_level:      item.reflex_level,
    movement_quality:  item.movement_quality,
    daily_time:        item.daily_time,
  })
}

function groupConsecutiveDuplicates(items) {
  const groups = []
  for (const item of items) {
    const signature = profileSignature(item)
    const last = groups[groups.length - 1]
    if (last && last.signature === signature) {
      last.items.push(item)
    } else {
      groups.push({ signature, items: [item] })
    }
  }
  return groups
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
