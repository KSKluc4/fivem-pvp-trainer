import { useState } from 'react'
import Questionnaire from './components/Questionnaire'
import TrainingRoutine from './components/TrainingRoutine'
import Progress from './components/Progress'

function CrosshairLogo() {
  return (
    <svg className="logo-svg" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="28" r="24" stroke="url(#grad)" strokeWidth="2.5" />
      <circle cx="28" cy="28" r="10" stroke="url(#grad)" strokeWidth="2" />
      <circle cx="28" cy="28" r="3" fill="url(#grad)" />
      {/* crosshair lines */}
      <line x1="28" y1="2" x2="28" y2="16" stroke="url(#grad)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="28" y1="40" x2="28" y2="54" stroke="url(#grad)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="2" y1="28" x2="16" y2="28" stroke="url(#grad)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="28" x2="54" y2="28" stroke="url(#grad)" strokeWidth="2.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d4ff" />
          <stop offset="1" stopColor="#7b2fd4" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function App() {
  const [view, setView] = useState('welcome')
  const [username, setUsername] = useState('')
  const [inputName, setInputName] = useState('')
  const [userId, setUserId] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [routine, setRoutine] = useState(null)

  const handleStart = () => {
    if (!inputName.trim()) return
    setUsername(inputName.trim())
    setView('questionnaire')
  }

  const handleQuestionnaireComplete = (data) => {
    setUserId(data.user_id)
    setSessionId(data.session_id)
    setRoutine(data.routine)
    setView('routine')
  }

  return (
    <div className="app">
      {view === 'welcome' && (
        <div className="welcome">
          <div className="welcome-bg-glow" />
          <div className="welcome-content">
            <div className="logo">
              <CrosshairLogo />
              <div className="logo-text">
                <h1>FiveM PvP Trainer</h1>
                <span className="logo-tagline">TRAINING SYSTEM v1.0</span>
              </div>
            </div>

            <p className="welcome-subtitle">
              Treine como um pro. Domine o PvP no FiveM com rotinas personalizadas
              de <strong>KovaaK&apos;s</strong> e <strong>Aim Lab</strong>.
            </p>

            <div className="welcome-form">
              <input
                type="text"
                placeholder="Qual é o seu nome, soldado?"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                className="name-input"
                autoFocus
              />
              <button
                className="btn-primary btn-large btn-glow"
                onClick={handleStart}
                disabled={!inputName.trim()}
              >
                Iniciar Avaliação →
              </button>
            </div>

            <div className="welcome-features">
              <div className="feature"><span>⚡</span> Rotina diária personalizada</div>
              <div className="feature"><span>🎮</span> KovaaK&apos;s &amp; Aim Lab</div>
              <div className="feature"><span>📊</span> Progresso &amp; streak</div>
              <div className="feature"><span>🎯</span> Exercícios curados por nível</div>
            </div>
          </div>
        </div>
      )}

      {view === 'questionnaire' && (
        <Questionnaire username={username} onComplete={handleQuestionnaireComplete} />
      )}

      {view === 'routine' && routine && (
        <TrainingRoutine
          userId={userId}
          sessionId={sessionId}
          routine={routine}
          username={username}
          onViewProgress={() => setView('progress')}
        />
      )}

      {view === 'progress' && (
        <Progress
          userId={userId}
          username={username}
          onBack={() => setView('routine')}
        />
      )}
    </div>
  )
}
