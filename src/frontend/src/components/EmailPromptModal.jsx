import { useState } from 'react'
import { Modal, TextInput, Button, Stack, Text, Group, Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { addEmailApi } from '../services/api'
import { toast } from '../services/toast'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function EmailPromptModal({ opened, onClose, onLinked }) {
  const { t } = useTranslation()
  const [email,   setEmail]   = useState('')
  const [error,   setError]   = useState(null)
  const [saving,  setSaving]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!EMAIL_RE.test(email)) {
      setError(t('auth.errors.email_invalido'))
      return
    }

    setSaving(true)
    try {
      const res = await addEmailApi(email)
      toast.success(t('auth.email_prompt.email_vinculado'))
      onLinked(res.data.email)
    } catch (err) {
      setError(err.response?.data?.error || t('auth.email_prompt.erro_vincular'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('auth.email_prompt.title')} centered closeOnClickOutside={false}>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('auth.email_prompt.description')}
          </Text>

          <TextInput
            label={t('auth.email_prompt.email_label')}
            type="email"
            placeholder={t('auth.email_prompt.email_placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
            required
          />

          {error && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          )}

          <Group grow>
            <Button type="submit" loading={saving} disabled={!email}>{t('auth.email_prompt.vincular')}</Button>
            <Button variant="light" color="gray" onClick={onClose} disabled={saving}>{t('comum.agora_nao')}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
