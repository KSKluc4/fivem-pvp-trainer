import { useState } from 'react'
import Questionnaire from './components/Questionnaire'
import TrainingRoutine from './components/TrainingRoutine'
import Progress from './components/Progress'

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
          <div className="welcome-content">
            <div className="logo">
              <span className="logo-icon">🎯</span>
              <h1>FiveM PvP Trainer</h1>
            </div>
            <p className="welcome-subtitle">
              Treine como um pro. Domine o PvP no FiveM com rotinas personalizadas de KovaaK&apos;s e Aim Lab.
            </p>
            <div className="welcome-form">
              <input
                type="text"
                placeholder="Qual é o seu nome?"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                className="name-input"
                autoFocus
              />
              <button
                className="btn-primary btn-large"
                onClick={handleStart}
                disabled={!inputName.trim()}
              >
                Começar Avaliação →
              </button>
            </div>
            <div className="welcome-features">
              <div className="feature">⚡ Rotina diária personalizada</div>
              <div className="feature">🎮 Exercícios do KovaaK&apos;s e Aim Lab</div>
              <div className="feature">📊 Acompanhe seu progresso</div>
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
