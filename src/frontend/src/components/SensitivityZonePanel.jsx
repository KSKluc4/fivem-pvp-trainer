import { Box, Text, Stack, Group } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { IconBolt, IconWind, IconGauge, IconShieldCheck, IconHourglass } from '@tabler/icons-react'
import { ZONES, zoneForCm } from '../services/sensitivityZones'

// Purely decorative per-zone icon next to the active zone's name — color
// still comes from zone.color, this is not a second data encoding.
const ZONE_ICONS = {
  muito_rapida: IconBolt,
  agil: IconWind,
  equilibrada: IconGauge,
  controlada: IconShieldCheck,
  muito_lenta: IconHourglass,
}

// Displayed slow (left) -> fast (right), matching the -100..+100 slider's
// own left-to-right reading direction. ZONES itself is ordered fast->slow
// (see sensitivityZones.js), so this is simply that list reversed.
const DISPLAY_ORDER = [...ZONES].reverse()

// Result panel for "Minha Sensibilidade": no gauge/arc, just the active
// zone name (with icon) and the zone chip strip — the only visual
// representation of where the current sens+DPI combo lands.
export default function SensitivityZonePanel({ cm }) {
  const { t } = useTranslation()
  const activeZone = zoneForCm(cm)
  const ActiveIcon = ZONE_ICONS[activeZone.id]

  return (
    <Stack gap="sm" align="center">
      <Group gap={8}>
        {ActiveIcon && <ActiveIcon size={24} color={`var(--mantine-color-${activeZone.color}-6)`} />}
        <Text fw={800} size="xl" c={activeZone.color}>
          {t(`sensibilidade.zonas.${activeZone.id}.nome`)}
        </Text>
      </Group>

      <Box style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {DISPLAY_ORDER.map((zone) => {
          const isActive = zone.id === activeZone.id
          return (
            <Text
              key={zone.id}
              size="xs"
              fw={isActive ? 800 : 500}
              c={isActive ? 'white' : 'dimmed'}
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                background: isActive ? `var(--mantine-color-${zone.color}-6)` : 'transparent',
                border: isActive ? 'none' : '1px solid var(--mantine-color-dimmed)',
              }}
            >
              {t(`sensibilidade.zonas.${zone.id}.nome`)}
            </Text>
          )
        })}
      </Box>
    </Stack>
  )
}
