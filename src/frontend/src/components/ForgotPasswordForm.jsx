import { useState } from 'react'
import { Card, TextInput, Button, Stack, Title, Text, Anchor, Alert } from '@mantine/core'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { forgotPassword } from '../services/api'
import BrandIcon from './BrandIcon'

function useFriendlyError() {
  const { t } = useTranslation()
  return (err) => {
    if (!err.response) return t('comum.erros.servidor_indisponivel')
    const code = err.response?.status
    if (code === 429) return t('comum.erros.muitas_tentativas')
    if (code >= 500) return t('comum.erros.erro_servidor')
    return t('comum.erros.erro_generico')
  }
}

export default function ForgotPasswordForm({ onGoLogin }) {
  const { t } = useTranslation()
  const friendlyError = useFriendlyError()
  const [email,   setEmail]   = useState('')
  const [error,   setError]   = useState(null)
  const [sent,    setSent]    = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await forgotPassword(email)
      setMessage(res.data?.message || t('auth.forgot_password.default_sent_message'))
      setSent(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <Card w="100%" maw={400} p="xl" className="auth-card">
        <Stack align="center" gap={2} mb="lg">
          <div className="auth-card-icon"><BrandIcon size={36} /></div>
          <Title order={2} ta="center" mt="xs">{t('auth.forgot_password.title')}</Title>
          <Text c="dimmed" size="sm" ta="center">
            {t('auth.forgot_password.subtitle')}
          </Text>
        </Stack>

        {sent ? (
          <Alert color="teal" variant="light" icon={<IconCheck size={16} />}>
            {message}
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <TextInput
                label={t('auth.forgot_password.email_label')}
                type="email"
                placeholder={t('auth.forgot_password.email_placeholder')}
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

              <Button
                type="submit"
                size="md"
                fullWidth
                mt="xs"
                variant="gradient"
                gradient={{ from: 'brandCyan.5', to: 'brandPurple.5', deg: 120 }}
                className="auth-submit-btn"
                loading={loading}
                disabled={!email}
              >
                {t('auth.forgot_password.submit')}
              </Button>
            </Stack>
          </form>
        )}

        <Text ta="center" size="sm" mt="lg" c="dimmed">
          <Anchor component="button" type="button" onClick={onGoLogin} fw={700}>
            {t('auth.forgot_password.back_to_login')}
          </Anchor>
        </Text>
      </Card>
    </div>
  )
}
