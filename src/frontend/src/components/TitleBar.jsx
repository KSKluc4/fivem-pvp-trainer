import { Group, Text } from '@mantine/core'
import { IconTargetArrow } from '@tabler/icons-react'

// Custom drag region replacing the native Windows title bar (hidden via
// titleBarStyle: 'hidden' in electron/main.js). Double-click-to-maximize and
// window dragging come for free from -webkit-app-region: drag — no JS needed.
export default function TitleBar() {
  return (
    <div className="titlebar">
      <Group gap={6}>
        <IconTargetArrow size={15} color="var(--mantine-color-brandCyan-5)" />
        <Text fw={700} size="xs" c="dimmed">FiveM PvP Trainer</Text>
      </Group>
    </div>
  )
}
