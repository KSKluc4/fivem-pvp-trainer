import { Box, Text, Stack } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { ZONES, zoneForCm, gaugePercent } from '../services/sensitivityZones'

// Semicircular gauge: angle -90° = far left (slowest zone) through 0° = top
// to +90° = far right (fastest zone) — a continuous domain with no 0/360
// wraparound to worry about.
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, startAngle)
  const end = polarToCartesian(cx, cy, r, endAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
}

// Displayed slow (left) -> fast (right), matching the -100..+100 slider's
// own left-to-right reading direction. ZONES itself is ordered fast->slow
// (see sensitivityZones.js), so this is simply that list reversed.
const DISPLAY_ORDER = [...ZONES].reverse()
const SEGMENT_SPAN = 180 / DISPLAY_ORDER.length

const CX = 120
const CY = 108
const R  = 90

export default function SensitivityGauge({ cm }) {
  const { t } = useTranslation()
  const activeZone = zoneForCm(cm)
  const needleAngle = -90 + (gaugePercent(cm) / 100) * 180

  return (
    <Stack gap="sm" align="center">
      <Box style={{ width: '100%', maxWidth: 320 }}>
        <svg viewBox="0 0 240 122" style={{ width: '100%', display: 'block' }}>
          {DISPLAY_ORDER.map((zone, i) => {
            const start = -90 + i * SEGMENT_SPAN
            const end   = start + SEGMENT_SPAN
            const isActive = zone.id === activeZone.id
            return (
              <path
                key={zone.id}
                d={describeArc(CX, CY, R, start, end)}
                fill="none"
                stroke={`var(--mantine-color-${zone.color}-${isActive ? 6 : 4})`}
                strokeWidth={isActive ? 16 : 12}
                strokeLinecap="butt"
                opacity={isActive ? 1 : 0.55}
              />
            )
          })}
          {/* Needle */}
          <line
            x1={CX} y1={CY}
            x2={polarToCartesian(CX, CY, R - 22, needleAngle).x}
            y2={polarToCartesian(CX, CY, R - 22, needleAngle).y}
            stroke="var(--mantine-color-text)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r={6} fill="var(--mantine-color-text)" />
        </svg>
      </Box>

      <Text fw={800} size="lg" c={activeZone.color}>
        {t(`sensibilidade.zonas.${activeZone.id}.nome`)}
      </Text>

      <Box style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {DISPLAY_ORDER.map((zone) => (
          <Text
            key={zone.id}
            size="xs"
            fw={zone.id === activeZone.id ? 800 : 500}
            c={zone.id === activeZone.id ? zone.color : 'dimmed'}
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: zone.id === activeZone.id ? `var(--mantine-color-${zone.color}-light)` : 'transparent',
            }}
          >
            {t(`sensibilidade.zonas.${zone.id}.nome`)}
          </Text>
        ))}
      </Box>
    </Stack>
  )
}
