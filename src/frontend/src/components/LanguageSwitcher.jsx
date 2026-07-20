import { useTranslation } from 'react-i18next'
import { Menu, UnstyledButton, Group, Text } from '@mantine/core'
import { IconWorld, IconChevronDown } from '@tabler/icons-react'
import { setLanguage } from '../i18n'

// Flag emoji render inconsistently across Electron/Chromium builds (some show
// the raw two-letter regional-indicator text instead of a pictograph) — a
// globe icon + language code is the reliable cross-platform option.
const LANGS = {
  pt: { code: 'PT', label: 'Português' },
  en: { code: 'EN', label: 'English' },
}

// `position` lets callers flip the dropdown to open upward (sidebar footer,
// near the bottom of the window) instead of the topbar's default downward
// open. `compact` hides the language code text, leaving just the globe icon
// — used for the collapsed (icon-only) sidebar rail.
export default function LanguageSwitcher({ position = 'bottom-end', compact = false }) {
  const { i18n } = useTranslation()
  // i18n.language is the single source of truth for what's "active" — this
  // re-renders whenever changeLanguage() resolves, so the chip always shows
  // the language actually in effect instead of an assumed default.
  const current = LANGS[i18n.language] ? i18n.language : 'en'

  return (
    <Menu position={position} shadow="md" width={170}>
      <Menu.Target>
        <UnstyledButton className="lang-chip" title="Language / Idioma">
          <Group gap={5} wrap="nowrap">
            <IconWorld size={14} />
            {!compact && <Text size="xs" fw={700}>{LANGS[current].code}</Text>}
            {!compact && <IconChevronDown size={12} style={{ opacity: 0.7 }} />}
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {Object.entries(LANGS).map(([lng, info]) => (
          <Menu.Item
            key={lng}
            fw={current === lng ? 700 : 400}
            color={current === lng ? 'brandCyan' : undefined}
            onClick={() => setLanguage(lng)}
          >
            {info.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}
