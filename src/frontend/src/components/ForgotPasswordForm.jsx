import { useState } from 'react'
import { Card, TextInput, Button, Stack, Title, Text, Anchor, Alert } from '@mantine/core'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { forgotPassword } from '../services/api'
import BrandLogo from './BrandLogo'

function friendlyError(err) {
  if (!err.response) return 'Servidor indisponível. Verifique sua conexão e tente novamente.'
  const code = err.response?.status
  if (code === 429) return 'Muitas tentativas. Aguarde um momento e tente novamente.'
  if (code >= 500) return 'Erro interno do servidor. Tente novamente em instantes.'
  return 'Ocorreu um erro. Tente novamente.'
}

export default function ForgotPasswordForm({ onGoLogin }) {
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
      setMessage(res.data?.message || 'Se este email estiver cadastrado, enviamos um link de redefinição de senha.')
      setSent(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <Card w="100%" maw={420} p="xl">
        <BrandLogo />

        <Title order={2} mt="lg" mb={4}>Esqueceu a senha?</Title>
        <Text c="dimmed" size="sm" mb="xl">
          Digite o email da sua conta para receber um link de redefinição
        </Text>

        {sent ? (
          <Alert color="teal" variant="light" icon={<IconCheck size={16} />}>
            {message}
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
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

              <Button type="submit" size="md" fullWidth loading={loading} disabled={!email}>
                Enviar link →
              </Button>
            </Stack>
          </form>
        )}

        <Text ta="center" size="sm" mt="lg" c="dimmed">
          <Anchor component="button" type="button" onClick={onGoLogin} fw={700}>
            ← Voltar para o login
          </Anchor>
        </Text>
      </Card>
    </div>
  )
}
