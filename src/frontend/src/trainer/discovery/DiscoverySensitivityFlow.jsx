import { useState, useEffect, useMemo } from 'react'
import {
  Box, Card, Stack, Group, Text, Title, Button, Badge, List, ThemeIcon, Divider, Loader,
} from '@mantine/core'
import {
  IconArrowLeft, IconTarget, IconTrendingUp, IconTrendingDown, IconCheck,
  IconRefresh, IconAlertCircle, IconHistory, IconClock,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import DiscoveryPlayer from './DiscoveryPlayer'
import { computeVerdict, VERDICT } from './verdict.js'
import { median } from './mathUtils.js'
import { useSensCalibrations } from './useSensCalibrations.js'
import { loadTrainerSensSettings, saveTrainerSensSettings } from '../sensitivity/trainerSensitivity'
import { toast } from '../../services/toast'

const VERDICT_ICON = {
  [VERDICT.INCREASE]: IconTrendingUp,
  [VERDICT.DECREASE]: IconTrendingDown,
  [VERDICT.KEEP]: IconCheck,
  [VERDICT.INCONCLUSIVE]: IconAlertCircle,
}
const VERDICT_COLOR = {
  [VERDICT.INCREASE]: 'brandCyan',
  [VERDICT.DECREASE]: 'brandPurple',
  [VERDICT.KEEP]: 'green',
  [VERDICT.INCONCLUSIVE]: 'orange',
}

// Guided "Descobrir minha sensibilidade" flow: intro -> 5 instrumented
// rounds (DiscoveryPlayer) -> verdict + apply/keep/redo, with a small
// history of past tests. Entry points: a button on "Minha Sensibilidade"
// and a card in the "Treinar" menu (see Sensitivity.jsx / TrainerView.jsx).
export default function DiscoverySensitivityFlow({ onBack, onNeedsSensSetup }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState('intro') // intro -> testing -> result
  const [result, setResult] = useState(null) // { verdict, ...verdictFields, savedId }
  const { history, loading: historyLoading, available: historyAvailable, reload, save, markApplied } = useSensCalibrations()

  const sens = useMemo(() => loadTrainerSensSettings(), [phase])
  const hasSens = sens.gtaSens != null

  useEffect(() => {
    if (!hasSens) onNeedsSensSetup?.()
  }, [hasSens, onNeedsSensSetup])

  if (!hasSens) {
    return (
      <Box className="sens-view" ta="center" py="xl">
        <Loader size="sm" />
      </Box>
    )
  }

  async function handleTestComplete(aggregate) {
    const verdictResult = computeVerdict({
      flickRatios: aggregate.flickRatios,
      correctionTimesMs: aggregate.correctionTimesMs,
      trackingOscillationsHz: aggregate.trackingOscillationsHz,
      trackingLagBiasDeg: aggregate.trackingLagBiasDeg,
      trackingRoundsAttempted: aggregate.trackingRoundsAttempted,
      currentSens: sens.gtaSens,
      dpi: sens.dpi,
    })
    const trackingErrorMedian = aggregate.trackingAvgErrorsDeg?.length ? median(aggregate.trackingAvgErrorsDeg) : null

    const saved = await save({
      sens_at_test: sens.gtaSens,
      dpi_at_test: sens.dpi,
      flick_ratio_median: verdictResult.medianRatio ?? null,
      overshoot_rate: verdictResult.overshootRatePct ?? null,
      tracking_error: trackingErrorMedian,
      verdict: verdictResult.verdict,
      suggested_sens: verdictResult.suggestedSens ?? null,
    })

    setResult({ ...verdictResult, savedId: saved?.id ?? null })
    setPhase('result')
    reload()
  }

  async function handleApply() {
    saveTrainerSensSettings({ gtaSens: result.suggestedSens, dpi: sens.dpi })
    await markApplied(result.savedId)
    // Longer than the default toast (3200ms) — this one repeats the "change
    // it in GTA V too" reminder, which needs enough time to actually be read.
    toast.success(t('sensibilidade.descoberta.aplicado_sucesso_lembrete'), 6000)
    reload()
    onBack?.()
  }

  function handleRedo() {
    setResult(null)
    setPhase('testing')
  }

  if (phase === 'testing') {
    return <DiscoveryPlayer onComplete={handleTestComplete} onBack={() => setPhase('intro')} />
  }

  if (phase === 'result' && result) {
    const Icon = VERDICT_ICON[result.verdict]
    const color = VERDICT_COLOR[result.verdict]
    const isInconclusive = result.verdict === VERDICT.INCONCLUSIVE
    const isKeep = result.verdict === VERDICT.KEEP
    const isIncrease = result.verdict === VERDICT.INCREASE

    return (
      <Box className="sens-view" style={{ maxWidth: 640, margin: '0 auto' }}>
        <Group justify="space-between" mb="lg">
          <Title order={1} size="h2">{t('sensibilidade.descoberta.titulo')}</Title>
          <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
            {t('sensibilidade.descoberta.voltar')}
          </Button>
        </Group>

        <Card mb="lg">
          <Group gap={10} mb={isInconclusive || isKeep ? 0 : 'md'}>
            <ThemeIcon size={40} radius="xl" variant="light" color={color}>
              <Icon size={22} />
            </ThemeIcon>
            <Box>
              <Text fw={800} size="lg">{t(`sensibilidade.descoberta.veredito.${result.verdict}`)}</Text>
              {!isInconclusive && (
                <Text size="sm" c="dimmed">
                  {t(isIncrease
                    ? 'sensibilidade.descoberta.motivo_aumentar'
                    : isKeep ? 'sensibilidade.descoberta.motivo_manter' : 'sensibilidade.descoberta.motivo_diminuir',
                    { pct: isIncrease ? result.undershootRatePct : result.overshootRatePct })}
                </Text>
              )}
            </Box>
          </Group>

          {isInconclusive && (
            <Text size="sm" c="dimmed">
              {result.inconclusiveReason === 'tracking'
                ? t('sensibilidade.descoberta.inconclusivo_detalhe_tracking')
                : t('sensibilidade.descoberta.inconclusivo_detalhe', { count: result.sampleSize })}
            </Text>
          )}

          {!isInconclusive && !isKeep && (
            <>
              <Divider my="md" />
              <Group justify="space-between" mb={6}>
                <Text size="sm" c="dimmed">{t('sensibilidade.descoberta.sens_atual')}</Text>
                <Text fw={700}>{result.currentSens}</Text>
              </Group>
              <Group justify="space-between" mb="sm">
                <Text size="sm" c="dimmed">{t('sensibilidade.descoberta.sens_sugerida')}</Text>
                <Text fw={800} c={color}>{result.suggestedSens}</Text>
              </Group>
              <Text size="xs" c="dimmed" ta="center">
                {t('sensibilidade.descoberta.transicao_zona', {
                  from: t(`sensibilidade.zonas.${result.currentZoneId}.nome`),
                  to: t(`sensibilidade.zonas.${result.suggestedZoneId}.nome`),
                })}
              </Text>
            </>
          )}
        </Card>

        {!isInconclusive && !isKeep && (
          <Card mb="lg" style={{ background: 'var(--bg-card-hover)' }}>
            <Group gap={8}>
              <IconAlertCircle size={18} color="var(--mantine-color-orange-5)" />
              <Text size="sm" fw={600}>{t('sensibilidade.descoberta.lembrete_gta_titulo')}</Text>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>{t('sensibilidade.descoberta.lembrete_gta_caminho')}</Text>
          </Card>
        )}

        <Text size="xs" c="dimmed" ta="center" mb="lg">{t('sensibilidade.descoberta.retestar_dica')}</Text>

        <Group mb="xl">
          {!isInconclusive && !isKeep && (
            <Button leftSection={<IconCheck size={16} />} onClick={handleApply}>
              {t('sensibilidade.descoberta.aplicar_sugestao')}
            </Button>
          )}
          <Button variant="light" onClick={onBack}>
            {t('sensibilidade.descoberta.manter_como_esta')}
          </Button>
          <Button variant="subtle" color="gray" leftSection={<IconRefresh size={16} />} onClick={handleRedo}>
            {t('sensibilidade.descoberta.refazer_teste')}
          </Button>
        </Group>

        <CalibrationHistory history={history} loading={historyLoading} available={historyAvailable} />
      </Box>
    )
  }

  // ── Intro ──────────────────────────────────────────────────────────────
  return (
    <Box className="sens-view" style={{ maxWidth: 640, margin: '0 auto' }}>
      <Group justify="space-between" mb="lg">
        <Title order={1} size="h2">{t('sensibilidade.descoberta.titulo')}</Title>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          {t('sensibilidade.descoberta.voltar')}
        </Button>
      </Group>

      <Card mb="lg">
        <Group gap={10} mb="md">
          <ThemeIcon size={40} radius="xl" variant="light" color="brandCyan">
            <IconTarget size={22} />
          </ThemeIcon>
          <Text fw={700} size="lg">{t('sensibilidade.descoberta.intro_titulo')}</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md" lh={1.6}>{t('sensibilidade.descoberta.intro_explicacao')}</Text>
        <List size="sm" spacing="xs" mb="md">
          <List.Item icon={<ThemeIcon size={20} radius="xl" color="brandPurple" variant="light"><IconClock size={12} /></ThemeIcon>}>
            {t('sensibilidade.descoberta.intro_duracao')}
          </List.Item>
          <List.Item icon={<ThemeIcon size={20} radius="xl" color="brandCyan" variant="light"><IconTarget size={12} /></ThemeIcon>}>
            {t('sensibilidade.descoberta.intro_rodadas')}
          </List.Item>
        </List>
        <Text size="xs" c="dimmed" mb="lg">{t('sensibilidade.descoberta.intro_ponto_partida')}</Text>
        <Button size="md" onClick={() => setPhase('testing')}>{t('sensibilidade.descoberta.comecar')}</Button>
      </Card>

      <CalibrationHistory history={history} loading={historyLoading} available={historyAvailable} />
    </Box>
  )
}

function CalibrationHistory({ history, loading, available }) {
  const { t } = useTranslation()
  if (loading) return null
  if (!available) {
    return <Text size="xs" c="dimmed" ta="center">{t('sensibilidade.descoberta.historico_indisponivel')}</Text>
  }
  if (history.length === 0) return null

  return (
    <Card>
      <Group gap={6} mb="sm">
        <IconHistory size={16} color="var(--mantine-color-brandCyan-5)" />
        <Text fw={700} size="sm">{t('sensibilidade.descoberta.historico_titulo')}</Text>
      </Group>
      <Stack gap={8}>
        {history.map((row) => (
          <Group key={row.id} justify="space-between">
            <Text size="xs" c="dimmed">{new Date(row.created_at).toLocaleDateString()}</Text>
            <Badge size="sm" variant="light" color={VERDICT_COLOR[row.verdict] || 'gray'}>
              {t(`sensibilidade.descoberta.veredito.${row.verdict}`)}
            </Badge>
            <Badge size="sm" variant={row.applied ? 'filled' : 'outline'} color={row.applied ? 'green' : 'gray'}>
              {row.applied ? t('sensibilidade.descoberta.aplicado') : t('sensibilidade.descoberta.nao_aplicado')}
            </Badge>
          </Group>
        ))}
      </Stack>
    </Card>
  )
}
