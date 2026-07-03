import { useState, useEffect, useCallback } from 'react'
import {
  Box, Grid, Card, Group, Stack, Text, Title, Button, NumberInput, Badge,
  CopyButton, Tooltip, ActionIcon, Collapse, Code, Progress as MProgress,
} from '@mantine/core'
import { IconArrowLeft, IconDeviceGamepad2, IconBolt, IconTarget, IconRuler2, IconCopy, IconCheck, IconChevronDown, IconArchive } from '@tabler/icons-react'
import { convertSensitivity, getSensitivityHistory } from '../services/api'
import { toast } from '../services/toast'

// Community-validated yaw values (mirrors backend constants)
const GTA_YAW    = 0.0009  // GTA V scale 0–100 (in-game slider)
const KOVAAK_YAW = 0.022
const AIMLAB_YAW = 0.022

function calcLocal(gtaSens, dpi) {
  const abs = Math.abs(gtaSens)
  const cm  = (360 / (dpi * abs * GTA_YAW)) * 2.54
  return {
    cm_per_360:         +cm.toFixed(4),
    kovaak_sensitivity: +((360 * 2.54) / (dpi * KOVAAK_YAW * cm)).toFixed(4),
    aimlab_sensitivity: +((360 * 2.54) / (dpi * AIMLAB_YAW * cm)).toFixed(4),
    inverted:           gtaSens < 0,
  }
}

const DPI_PRESETS = [400, 800, 1200, 1600, 3200]

function fmt(n, dp = 3) {
  return typeof n === 'number' ? n.toFixed(dp) : '—'
}

function CopyChip({ value }) {
  return (
    <CopyButton value={String(value)}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Copiado!' : 'Copiar'} withArrow>
          <ActionIcon variant="light" color={copied ? 'green' : 'brandCyan'} onClick={copy} size="sm">
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  )
}

function HistoryRow({ row }) {
  const d = new Date(row.created_at)
  const dateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  return (
    <Group justify="space-between" py={6} className="sens-history-row" wrap="wrap">
      <Text size="xs" c="dimmed">{dateStr}</Text>
      <Text size="xs">
        GTA <Text span fw={700}>{row.gta_sensitivity > 0 ? row.gta_sensitivity : `${row.gta_sensitivity} ↕`}</Text>
        {' / '}{row.dpi} DPI
      </Text>
      <Text size="xs">
        KovaaK <Text span fw={700}>{fmt(row.kovaak_sens)}</Text>
        {' · '}Aim Lab <Text span fw={700}>{fmt(row.aimlab_sens)}</Text>
        {' · '}<Text span c="dimmed">{fmt(row.cm_per_360, 1)} cm</Text>
      </Text>
    </Group>
  )
}

export default function SensConverter({ onBack }) {
  const [gtaSens, setGtaSens]     = useState(50)
  const [dpi,     setDpi]         = useState(800)
  const [result,  setResult]      = useState(null)
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [histErr, setHistErr]     = useState(false)
  const [showFormula, setShowFormula] = useState(false)

  // Preview result computed locally on every keystroke
  const preview = (() => {
    const s = typeof gtaSens === 'number' ? gtaSens : parseFloat(gtaSens)
    const d = typeof dpi === 'number' ? dpi : parseInt(dpi, 10)
    if (!isNaN(s) && s !== 0 && !isNaN(d) && d > 0) return calcLocal(s, d)
    return null
  })()

  const loadHistory = useCallback(() => {
    getSensitivityHistory()
      .then((res) => setHistory(res.data))
      .catch(() => setHistErr(true))
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const handleConvert = async (e) => {
    e.preventDefault()
    const s = typeof gtaSens === 'number' ? gtaSens : parseFloat(gtaSens)
    const d = typeof dpi === 'number' ? dpi : parseInt(dpi, 10)

    if (isNaN(s) || s === 0)          { toast.error('Informe uma sensibilidade válida (diferente de zero).'); return }
    if (Math.abs(s) > 100)            { toast.error('Sensibilidade deve estar entre -100 e 100.'); return }
    if (isNaN(d) || d <= 0)           { toast.error('Informe um DPI válido (número positivo).'); return }

    // Show instant local result
    const local = calcLocal(s, d)
    setResult(local)

    // Persist to backend (fire-and-forget)
    setLoading(true)
    try {
      await convertSensitivity({ gta_sensitivity: s, dpi: d })
      loadHistory()
    } catch {
      // Conversion result is already shown — backend failure is non-fatal
    } finally {
      setLoading(false)
    }
  }

  const display = result || preview

  return (
    <Box className="sens-view">
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={1}>Conversor de Sensibilidade</Title>
          <Text c="dimmed" size="sm">GTA V / FiveM → KovaaK's · Aim Lab</Text>
        </Box>
        <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          Voltar ao Treino
        </Button>
      </Group>

      <Grid>
        {/* ── Input panel ── */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="md">
            <Card>
              <Group gap={6} mb="md">
                <IconDeviceGamepad2 size={18} color="var(--mantine-color-brandCyan-5)" />
                <Text fw={700} size="sm">Configuração</Text>
              </Group>

              <form onSubmit={handleConvert}>
                <Stack gap="md">
                  <NumberInput
                    label="Sensibilidade GTA V"
                    description="Escala 0–100 · aceita negativo para eixo invertido"
                    value={gtaSens}
                    onChange={setGtaSens}
                    min={-100}
                    max={100}
                    step={1}
                    placeholder="ex: 50 ou -35"
                    autoFocus
                  />
                  <Text size="xs" c="dimmed" mt={-8}>
                    Configure em GTA V → <Code>Opções → Controles → Sensibilidade do Mouse</Code>
                  </Text>

                  <NumberInput
                    label="DPI do Mouse"
                    value={dpi}
                    onChange={setDpi}
                    min={1}
                    step={1}
                    placeholder="ex: 800"
                  />
                  <Group gap={6}>
                    {DPI_PRESETS.map((p) => (
                      <Button
                        key={p}
                        type="button"
                        size="xs"
                        variant={dpi === p ? 'filled' : 'light'}
                        onClick={() => setDpi(p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </Group>

                  <Button type="submit" fullWidth loading={loading} disabled={!preview}>
                    Converter e Salvar
                  </Button>
                </Stack>
              </form>
            </Card>

            {/* Formula info — collapsible */}
            <Card>
              <Button
                variant="subtle" color="gray" size="xs" p={0}
                rightSection={<IconChevronDown size={14} style={{ transform: showFormula ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                onClick={() => setShowFormula((v) => !v)}
              >
                Como calculamos isso?
              </Button>
              <Collapse in={showFormula}>
                <Stack gap={6} mt="md">
                  <Group justify="space-between"><Text size="xs" c="dimmed">GTA V yaw</Text><Code>0.0009 °/count</Code></Group>
                  <Group justify="space-between"><Text size="xs" c="dimmed">KovaaK's yaw</Text><Code>0.022 °/count</Code></Group>
                  <Group justify="space-between"><Text size="xs" c="dimmed">Aim Lab yaw</Text><Code>0.022 °/count</Code></Group>
                  <Text size="xs" ta="center" mt={4}>cm/360 = (360 ÷ (DPI × |sens| × yaw)) × 2.54</Text>
                  <Text size="xs" c="dimmed" ta="center">Valores validados pela comunidade via mouse-sensitivity.com e r/FPSAimTrainer</Text>
                </Stack>
              </Collapse>
            </Card>
          </Stack>
        </Grid.Col>

        {/* ── Result panel ── */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="md">
            {display ? (
              <Card>
                <Group justify="space-between" mb="xs">
                  <Group gap={6}>
                    <IconBolt size={18} color="var(--mantine-color-brandCyan-5)" />
                    <Text fw={700} size="sm">Resultado</Text>
                  </Group>
                  {result && <Badge color="green" variant="light">Salvo</Badge>}
                </Group>

                {display.inverted && (
                  <Text size="xs" c="orange" mb="sm">
                    ↕ Eixo invertido detectado — os valores de sensibilidade são corretos, mas o mouse estará com direções Y trocadas.
                  </Text>
                )}

                <Grid>
                  <Grid.Col span={4}>
                    <Card withBorder ta="center" p="sm">
                      <IconRuler2 size={20} color="var(--mantine-color-brandCyan-5)" />
                      <Text size="xs" c="dimmed">cm / 360°</Text>
                      <Text fw={900} size="lg">{fmt(display.cm_per_360, 1)}</Text>
                      <CopyChip value={fmt(display.cm_per_360, 2)} />
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Card withBorder ta="center" p="sm">
                      <IconBolt size={20} color="var(--mantine-color-orange-5)" />
                      <Text size="xs" c="dimmed">KovaaK's</Text>
                      <Text fw={900} size="lg">{fmt(display.kovaak_sensitivity, 3)}</Text>
                      <CopyChip value={fmt(display.kovaak_sensitivity, 3)} />
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Card withBorder ta="center" p="sm">
                      <IconTarget size={20} color="var(--mantine-color-green-5)" />
                      <Text size="xs" c="dimmed">Aim Lab</Text>
                      <Text fw={900} size="lg">{fmt(display.aimlab_sensitivity, 3)}</Text>
                      <CopyChip value={fmt(display.aimlab_sensitivity, 3)} />
                    </Card>
                  </Grid.Col>
                </Grid>

                <Box mt="md">
                  <Group justify="space-between" mb={4}>
                    <Text size="xs" c="dimmed">Baixa sens. (alto cm)</Text>
                    <Text size="xs" c="dimmed">Alta sens. (baixo cm)</Text>
                  </Group>
                  <MProgress
                    value={Math.min(100, Math.max(2, (1 - Math.log(display.cm_per_360 / 5) / Math.log(200)) * 100))}
                    radius="xl"
                  />
                  <Text size="xs" ta="center" mt={4} c="dimmed">{fmt(display.cm_per_360, 1)} cm/360°</Text>
                </Box>
              </Card>
            ) : (
              <Card ta="center" py="xl">
                <Text size="xl" mb={6}>🎯</Text>
                <Text size="sm" c="dimmed">Informe a sensibilidade e o DPI para ver o resultado em tempo real</Text>
              </Card>
            )}

            {/* History */}
            <Card>
              <Group justify="space-between" mb="sm">
                <Group gap={6}>
                  <IconArchive size={18} color="var(--mantine-color-brandCyan-5)" />
                  <Text fw={700} size="sm">Histórico</Text>
                </Group>
                <Badge variant="default">{history.length} conversões</Badge>
              </Group>
              {histErr ? (
                <Text size="sm" c="dimmed">⚠️ Histórico indisponível. Execute a migration v2 no Supabase primeiro.</Text>
              ) : history.length === 0 ? (
                <Text size="sm" c="dimmed">📭 Nenhuma conversão salva ainda. Clique em "Converter e Salvar" para registrar.</Text>
              ) : (
                <Stack gap={0}>
                  {history.map((row) => <HistoryRow key={row.id} row={row} />)}
                </Stack>
              )}
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Box>
  )
}
