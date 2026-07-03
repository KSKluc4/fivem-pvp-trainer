import { Group, Stack, Text } from '@mantine/core'

export default function BrandLogo() {
  return (
    <Group gap="sm">
      <svg width="44" height="44" viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="24" stroke="url(#brandlogo-g)" strokeWidth="2.5" />
        <circle cx="28" cy="28" r="10" stroke="url(#brandlogo-g)" strokeWidth="2" />
        <circle cx="28" cy="28" r="3" fill="url(#brandlogo-g)" />
        <line x1="28" y1="2"  x2="28" y2="16" stroke="url(#brandlogo-g)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="28" y1="40" x2="28" y2="54" stroke="url(#brandlogo-g)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="2"  y1="28" x2="16" y2="28" stroke="url(#brandlogo-g)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="40" y1="28" x2="54" y2="28" stroke="url(#brandlogo-g)" strokeWidth="2.5" strokeLinecap="round" />
        <defs>
          <linearGradient id="brandlogo-g" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00d4ff" /><stop offset="1" stopColor="#7b2fd4" />
          </linearGradient>
        </defs>
      </svg>
      <Stack gap={0}>
        <Text fw={900} size="sm" className="auth-brand">FiveM PvP Trainer</Text>
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: 2 }}>Training System</Text>
      </Stack>
    </Group>
  )
}
