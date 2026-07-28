import { Box, Checkbox, Group, SimpleGrid, Text, ThemeIcon } from '@mantine/core'
import { useTranslation } from 'react-i18next'

// The multi-select (checkbox-card) question UI — shared by the full
// Questionnaire.jsx wizard and the "Mudar meu foco" shortcut, which only
// shows the 3 multiSelect questions from questionnaireQuestions.js. Copy
// lives under questionario.perguntas.<question.id> in the locale files,
// same as before this was extracted — no new i18n keys needed here.
export default function MultiSelectQuestionCard({ question, value, onChange, shakeOption }) {
  const { t } = useTranslation()
  const qBase = `questionario.perguntas.${question.id}`

  return (
    <Checkbox.Group value={value} onChange={onChange}>
      <SimpleGrid cols={1} spacing="sm">
        {question.options.map((opt) => (
          <Checkbox.Card
            value={String(opt.value)}
            key={opt.value}
            radius="md"
            p="md"
            className={`q-option-card${shakeOption === String(opt.value) ? ' q-option-card--shake' : ''}`}
          >
            <Group wrap="nowrap" align="center" gap="sm">
              <Checkbox.Indicator />
              <ThemeIcon size={40} radius="md" variant="light" color={opt.color}>
                <opt.icon size={22} />
              </ThemeIcon>
              <Box style={{ flex: 1 }}>
                <Text fw={700} size="sm">{t(`${qBase}.opcoes.${opt.value}.label`)}</Text>
                <Text size="xs" c="dimmed">{t(`${qBase}.opcoes.${opt.value}.description`)}</Text>
              </Box>
            </Group>
          </Checkbox.Card>
        ))}
      </SimpleGrid>
    </Checkbox.Group>
  )
}
