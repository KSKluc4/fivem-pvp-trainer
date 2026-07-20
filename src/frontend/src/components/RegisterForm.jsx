import { useState } from 'react'
import { Card, TextInput, PasswordInput, Button, Stack, Title, Text, Anchor, Alert } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { register } from '../services/api'
import BrandIcon from './BrandIcon'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function useFriendlyError() {
  const { t } = useTranslation()
  return (err) => {
    if (!err.response) return t('comum.erros.servidor_indisponivel')
    const msg = err.response?.data?.error || ''
    if (msg) return msg
    const code = err.response?.status
    if (code === 409) return t('auth.errors.username_em_uso')
    if (code === 400) return t('auth.errors.dados_invalidos')
    if (code >= 500) return t('comum.erros.erro_servidor')
    return t('comum.erros.erro_generico')
  }
}

export default function RegisterForm({ onSuccess, onGoLogin }) {
  const { t } = useTranslation()
  const friendlyError = useFriendlyError()
  const [form,    setForm]    = useState({ name: '', username: '', email: '', password: '' })
  const [error,   setError]   = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!EMAIL_RE.test(form.email)) {
      setError(t('auth.errors.email_invalido'))
      return
    }

    setLoading(true)
    const MAX = 5
    for (let attempt = 0; attempt < MAX; attempt++) {
      try {
        const res = await register(form)
        onSuccess(res.data)
        return
      } catch (err) {
        if (err.response || attempt === MAX - 1) {
          setError(friendlyError(err))
          break
        }
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    setLoading(false)
  }

  return (
    <div className="auth-screen">
      <Card w="100%" maw={400} p="xl" className="auth-card">
        <Stack align="center" gap={2} mb="lg">
          <div className="auth-card-icon"><BrandIcon size={36} /></div>
          <Title order={2} ta="center" mt="xs">{t('auth.register.title')}</Title>
          <Text c="dimmed" size="sm" ta="center">{t('auth.register.subtitle')}</Text>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <TextInput
              label={t('auth.register.name_label')}
              placeholder={t('auth.register.name_placeholder')}
              value={form.name}
              onChange={set('name')}
              autoFocus
              autoComplete="name"
              required
            />
            <TextInput
              label={t('auth.register.username_label')}
              description={t('auth.register.username_desc')}
              placeholder={t('auth.register.username_placeholder')}
              value={form.username}
              onChange={set('username')}
              autoComplete="username"
              minLength={3}
              required
            />
            <TextInput
              label={t('auth.register.email_label')}
              type="email"
              placeholder={t('auth.register.email_placeholder')}
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
            />
            <PasswordInput
              label={t('auth.register.password_label')}
              description={t('auth.register.password_desc')}
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              minLength={6}
              required
            />

            {error && (
              <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              size="md"
              fullWidth
              mt="xs"
              variant="gradient"
              gradient={{ from: 'brandCyan.5', to: 'brandPurple.5', deg: 120 }}
              className="auth-submit-btn"
              loading={loading}
              disabled={!form.name || !form.username || !form.email || !form.password}
            >
              {t('auth.register.submit')}
            </Button>
          </Stack>
        </form>

        <Text ta="center" size="sm" mt="lg" c="dimmed">
          {t('auth.register.has_account')}{' '}
          <Anchor component="button" type="button" onClick={onGoLogin} fw={700}>
            {t('auth.register.login')}
          </Anchor>
        </Text>
      </Card>
    </div>
  )
}
