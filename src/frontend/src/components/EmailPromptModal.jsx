import { useState } from 'react'
import { Modal, TextInput, Button, Stack, Text, Group, Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { addEmailApi } from '../services/api'
import { toast } from '../services/toast'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function EmailPromptModal({ opened, onClose, onLinked }) {
  const [email,   setEmail]   = useState('')
  const [error,   setError]   = useState(null)
  const [saving,  setSaving]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!EMAIL_RE.test(email)) {
      setError('Email inválido.')
      return
    }

    setSaving(true)
    try {
      const res = await addEmailApi(email)
      toast.success('Email vinculado com sucesso!')
      onLinked(res.data.email)
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao vincular email. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Vincule um email" centered closeOnClickOutside={false}>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Vincule um email para poder recuperar sua senha caso a esqueça.
          </Text>

          <TextInput
            label="Email"
            type="email"
            placeholder="voce@exemplo.com"
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
            <Button type="submit" loading={saving} disabled={!email}>Vincular</Button>
            <Button variant="light" color="gray" onClick={onClose} disabled={saving}>Agora não</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
