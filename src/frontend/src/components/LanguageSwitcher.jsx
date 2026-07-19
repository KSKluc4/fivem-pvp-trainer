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

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  // i18n.language is the single source of truth for what's "active" — this
  // re-renders whenever changeLanguage() resolves, so the chip always shows
  // the language actually in effect instead of an assumed default.
  const current = LANGS[i18n.language] ? i18n.language : 'en'

  return (
    <Menu position="bottom-end" shadow="md" width={170}>
      <Menu.Target>
        <UnstyledButton className="lang-chip" title="Language / Idioma">
          <Group gap={5} wrap="nowrap">
            <IconWorld size={14} />
            <Text size="xs" fw={700}>{LANGS[current].code}</Text>
            <IconChevronDown size={12} style={{ opacity: 0.7 }} />
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
