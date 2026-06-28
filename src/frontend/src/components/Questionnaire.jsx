import { useState } from 'react'
import { submitQuestionnaire } from '../services/api'

const QUESTIONS = [
  // ── FiveM context ──────────────────────────────────────────────────────────
  {
    id: 'server_type',
    question: 'Qual servidor FiveM você joga?',
    subtitle: 'Isso calibra o treino para o meta e ritmo do seu servidor',
    options: [
      { value: 'goat',  label: 'Goat PvP',  description: 'Combates táticos, range médio-longo, muito pre-aim', icon: '🐐' },
      { value: '1v99',  label: '1v99',       description: 'Arena competitiva, ritmo frenético, fights curtas',   icon: '⚔️' },
      { value: 'ambos', label: 'Ambos',      description: 'Jogo em múltiplos servidores e estilos',              icon: '🌐' },
      { value: 'outro', label: 'Outro',      description: 'Servidor diferente ou privado',                       icon: '🎮' },
    ],
  },
  {
    id: 'specific_weakness',
    question: 'Qual é sua maior dificuldade específica?',
    subtitle: 'Vamos focar no seu maior gargalo técnico',
    options: [
      { value: 'moving_target', label: 'Mira em Movimento',    description: 'Erro muito quando o inimigo se movimenta',       icon: '🏃' },
      { value: 'headshot',      label: 'Headshot Consistente', description: 'Acerto no corpo mas raramente na cabeça',         icon: '🎯' },
      { value: 'long_range',    label: 'Distância Longa',      description: 'Perco fights de longe facilmente',               icon: '🔭' },
      { value: 'reaction',      label: 'Reação sob Pressão',   description: 'Travo quando levo o primeiro tiro',              icon: '⚡' },
    ],
  },
  // ── Aim training profile ───────────────────────────────────────────────────
  {
    id: 'focus_area',
    question: 'Qual é seu maior desafio no PvP?',
    subtitle: 'Define o foco principal dos exercícios gerados',
    options: [
      { value: 'aim',      label: 'Mira',      description: 'Erro muito ao atirar, crosshair impreciso ou tremido', icon: '🎯' },
      { value: 'reflex',   label: 'Reflexo',   description: 'Reajo lento, demoro para sacar e atirar',             icon: '⚡' },
      { value: 'movement', label: 'Movimento', description: 'Me movo de forma previsível, levo muita bala',         icon: '🏃' },
    ],
  },
  {
    id: 'experience_level',
    question: 'Qual é seu nível de experiência em PvP?',
    subtitle: 'Define a dificuldade dos exercícios gerados',
    options: [
      { value: 'iniciante',    label: 'Iniciante',    description: 'Comecei a jogar FiveM PvP recentemente',           icon: '🌱' },
      { value: 'intermediario', label: 'Intermediário', description: 'Jogo há alguns meses, ganho algumas fights',     icon: '⚔️' },
      { value: 'avancado',     label: 'Avançado',     description: 'Jogo há mais de 1 ano, quero refinar a técnica',  icon: '🏆' },
    ],
  },
  {
    id: 'aim_difficulty',
    question: 'Que tipo de mira é mais difícil para você?',
    subtitle: 'Selecione sua maior dificuldade com o crosshair',
    options: [
      { value: 'tracking', label: 'Tracking',    description: 'Manter a mira em inimigos que se movem',   icon: '👁️' },
      { value: 'flick',    label: 'Flick Shot',  description: 'Miras rápidas para alvos distantes',       icon: '💥' },
      { value: 'close',    label: 'Close Range', description: 'Trocar tiros de perto sob pressão',        icon: '🔫' },
    ],
  },
  {
    id: 'reflex_level',
    question: 'Como você avalia seu reflexo atual?',
    subtitle: 'Seja honesto — isso calibra a intensidade do treino',
    options: [
      { value: 'lento',  label: 'Lento',  description: 'Inimigo frequentemente atira primeiro',  icon: '🐢' },
      { value: 'medio',  label: 'Médio',  description: 'Às vezes reajo bem, às vezes não',       icon: '⏱️' },
      { value: 'rapido', label: 'Rápido', description: 'Reajo bem, quero ir ao próximo nível',   icon: '🐆' },
    ],
  },
  {
    id: 'movement_quality',
    question: 'Como é seu movimento durante o combate?',
    subtitle: 'Movimento imprevisível é uma das habilidades mais importantes',
    options: [
      { value: 'previsivel',   label: 'Previsível',   description: 'Fico parado ou ando linear, levo muito dano', icon: '🪆' },
      { value: 'moderado',     label: 'Moderado',     description: 'Às vezes consigo confundir o inimigo',        icon: '🎲' },
      { value: 'imprevisivel', label: 'Imprevisível', description: 'Movimento bom, quero combinar com mira',      icon: '🌪️' },
    ],
  },
  {
    id: 'daily_time',
    question: 'Quanto tempo você pode treinar por dia?',
    subtitle: 'Consistência diária supera sessões longas esporádicas',
    options: [
      { value: 25, label: '15–30 min', description: 'Treino rápido e focado no ponto crítico',       icon: '⚡' },
      { value: 45, label: '30–60 min', description: 'Sessão completa com aquecimento e revisão',     icon: '🔥' },
      { value: 65, label: '60+ min',   description: 'Treino intensivo para evolução acelerada',      icon: '💪' },
    ],
  },
  {
    id: 'preferred_tool',
    question: 'Qual ferramenta de treino você usa?',
    subtitle: 'Os exercícios serão adaptados para sua ferramenta',
    options: [
      { value: 'kovaak', label: "KovaaK's",      description: 'Focado em FPS, altamente customizável',              icon: '🎮' },
      { value: 'aimlab', label: 'Aim Lab',        description: 'Gratuito, interface moderna, boas métricas',         icon: '🎯' },
      { value: 'ambos',  label: 'Ambos',          description: 'Uso as duas ferramentas',                            icon: '⚡' },
      { value: 'nenhum', label: 'Nenhum (ainda)', description: 'Vou baixar agora — Aim Lab é gratuito na Steam',     icon: '🆕' },
    ],
  },
]

export default function Questionnaire({ username, onComplete }) {
  const [step, setStep]       = useState(0)
  const [animDir, setAnimDir] = useState('right')
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const current  = QUESTIONS[step]
  const progress = (step / QUESTIONS.length) * 100

  const handleSelect = async (value) => {
    const newAnswers = { ...answers, [current.id]: value }
    setAnswers(newAnswers)

    if (step < QUESTIONS.length - 1) {
      setAnimDir('right')
      setStep(step + 1)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await submitQuestionnaire({ name: username, ...newAnswers })
      onComplete(res.data)
    } catch {
      setError('Erro ao enviar. Verifique se o backend está rodando na porta 5000.')
      setLoading(false)
    }
  }

  const handleBack = () => {
    setAnimDir('left')
    setStep(step - 1)
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-crosshair">
          <div className="lc-ring lc-ring-1" />
          <div className="lc-ring lc-ring-2" />
          <div className="lc-dot" />
        </div>
        <p>Gerando sua rotina personalizada...</p>
        <span className="loading-sub">Analisando perfil de {username}</span>
      </div>
    )
  }

  return (
    <div className="questionnaire">
      <div className="q-header">
        <div className="q-logo-small">🎯 FiveM PvP Trainer</div>
        <div className="step-indicator">
          {Array.from({ length: QUESTIONS.length }, (_, i) => (
            <div
              key={i}
              className={`step-dot ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="q-step-label">
        Pergunta <strong>{step + 1}</strong> de {QUESTIONS.length}
      </div>

      <div key={step} className={`question-card anim-${animDir}`}>
        <h2 className="question-title">{current.question}</h2>
        <p className="question-subtitle">{current.subtitle}</p>

        <div className="options-grid">
          {current.options.map((opt, i) => (
            <button
              key={opt.value}
              className={`option-card ${answers[current.id] === opt.value ? 'selected' : ''}`}
              onClick={() => handleSelect(opt.value)}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="option-card-inner">
                <span className="option-icon">{opt.icon}</span>
                <div className="option-text">
                  <span className="option-label">{opt.label}</span>
                  <span className="option-desc">{opt.description}</span>
                </div>
                <span className="option-arrow">›</span>
              </div>
            </button>
          ))}
        </div>

        {error && <p className="error-msg">⚠️ {error}</p>}

        {step > 0 && (
          <button className="btn-back" onClick={handleBack}>
            ← Pergunta anterior
          </button>
        )}
      </div>
    </div>
  )
}
