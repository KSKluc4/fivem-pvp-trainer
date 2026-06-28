import { useState } from 'react'
import { submitQuestionnaire } from '../services/api'

const QUESTIONS = [
  {
    id: 'focus_area',
    question: 'Qual é seu maior desafio no PvP?',
    subtitle: 'Isso define o foco principal do seu treino diário',
    options: [
      { value: 'aim', label: 'Mira', description: 'Erro muito ao atirar, crosshair impreciso ou tremido', icon: '🎯' },
      { value: 'reflex', label: 'Reflexo', description: 'Reajo lento, demoro para sacar e atirar', icon: '⚡' },
      { value: 'movement', label: 'Movimento', description: 'Me movo de forma previsível, levo muita bala', icon: '🏃' },
    ],
  },
  {
    id: 'experience_level',
    question: 'Qual é seu nível de experiência em PvP?',
    subtitle: 'Isso define a dificuldade dos exercícios gerados',
    options: [
      { value: 'iniciante', label: 'Iniciante', description: 'Comecei a jogar FiveM PvP recentemente', icon: '🌱' },
      { value: 'intermediario', label: 'Intermediário', description: 'Jogo há alguns meses, ganho algumas fights', icon: '⚔️' },
      { value: 'avancado', label: 'Avançado', description: 'Jogo há mais de 1 ano, quero refinar a técnica', icon: '🏆' },
    ],
  },
  {
    id: 'aim_difficulty',
    question: 'Que tipo de mira é mais difícil para você?',
    subtitle: 'Selecione sua maior dificuldade com o crosshair',
    options: [
      { value: 'tracking', label: 'Tracking', description: 'Manter a mira em inimigos que se movem', icon: '👁️' },
      { value: 'flick', label: 'Flick Shot', description: 'Miras rápidas para alvos distantes', icon: '💥' },
      { value: 'close', label: 'Close Range', description: 'Trocar tiros de perto sob pressão', icon: '🔫' },
    ],
  },
  {
    id: 'reflex_level',
    question: 'Como você avalia seu reflexo atual?',
    subtitle: 'Seja honesto — isso calibra a intensidade do treino',
    options: [
      { value: 'lento', label: 'Lento', description: 'Frequentemente fico no delay, o inimigo sempre atira primeiro', icon: '🐢' },
      { value: 'medio', label: 'Médio', description: 'Às vezes reajo bem, às vezes não', icon: '⏱️' },
      { value: 'rapido', label: 'Rápido', description: 'Reajo bem, quero levar ao próximo nível', icon: '🐆' },
    ],
  },
  {
    id: 'movement_quality',
    question: 'Como é seu movimento durante o combate?',
    subtitle: 'Movimento imprevisível é uma das habilidades mais importantes',
    options: [
      { value: 'previsivel', label: 'Previsível', description: 'Fico parado ou ando em linha reta, levo muito dano', icon: '🪆' },
      { value: 'moderado', label: 'Moderado', description: 'Às vezes consigo confundir o inimigo', icon: '🎲' },
      { value: 'imprevisivel', label: 'Imprevisível', description: 'Movimento bom, quero combinar com mira melhor', icon: '🌪️' },
    ],
  },
  {
    id: 'daily_time',
    question: 'Quanto tempo você pode treinar por dia?',
    subtitle: 'Consistência diária é mais importante que sessões longas',
    options: [
      { value: 25, label: '15–30 min', description: 'Treino rápido e focado no ponto crítico', icon: '⚡' },
      { value: 45, label: '30–60 min', description: 'Sessão completa com aquecimento e revisão', icon: '🔥' },
      { value: 65, label: '60+ min', description: 'Treino intensivo para evolução acelerada', icon: '💪' },
    ],
  },
  {
    id: 'preferred_tool',
    question: 'Qual ferramenta de treino você usa?',
    subtitle: 'Os exercícios serão adaptados para sua ferramenta',
    options: [
      { value: 'kovaak', label: "KovaaK's", description: 'Focado em FPS, altamente customizável', icon: '🎮' },
      { value: 'aimlab', label: 'Aim Lab', description: 'Gratuito, interface moderna, boas métricas', icon: '🎯' },
      { value: 'ambos', label: 'Ambos', description: 'Uso as duas ferramentas', icon: '⚡' },
      { value: 'nenhum', label: 'Nenhum (ainda)', description: 'Vou baixar agora — Aim Lab é gratuito na Steam', icon: '🆕' },
    ],
  },
]

export default function Questionnaire({ username, onComplete }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const current = QUESTIONS[step]
  const progress = (step / QUESTIONS.length) * 100

  const handleSelect = async (value) => {
    const newAnswers = { ...answers, [current.id]: value }
    setAnswers(newAnswers)

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await submitQuestionnaire({ name: username, ...newAnswers })
      onComplete(res.data)
    } catch {
      setError('Erro ao enviar questionário. Verifique se o backend está rodando na porta 5000.')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Gerando sua rotina personalizada...</p>
      </div>
    )
  }

  return (
    <div className="questionnaire">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="step-indicator">
        Pergunta {step + 1} de {QUESTIONS.length}
      </div>

      <div className="question-card">
        <h2 className="question-title">{current.question}</h2>
        <p className="question-subtitle">{current.subtitle}</p>

        <div className="options-grid">
          {current.options.map((opt) => (
            <button
              key={opt.value}
              className={`option-card ${answers[current.id] === opt.value ? 'selected' : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              <span className="option-icon">{opt.icon}</span>
              <span className="option-label">{opt.label}</span>
              <span className="option-desc">{opt.description}</span>
            </button>
          ))}
        </div>

        {error && <p className="error-msg">{error}</p>}

        {step > 0 && (
          <button className="btn-back" onClick={() => setStep(step - 1)}>
            ← Voltar
          </button>
        )}
      </div>
    </div>
  )
}
