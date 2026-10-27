import { useState } from 'react'

const TITLES = { login: 'Login', register: 'Create account', reset: 'Reset password' }
const SUBMIT_LABELS = { login: 'Sign in', register: 'Create account', reset: 'Send reset link' }

// Connexion, inscription et demande de réinitialisation du mot de passe.
export default function AuthPage({ onLogin, onRegister, onSendReset, onDone }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const switchMode = (next) => {
    setMode(next)
    setMessage('')
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setMessage('')
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await onLogin(email, password)
        onDone()
      } else if (mode === 'register') {
        const { needsConfirmation } = await onRegister(name.trim(), email, password)
        if (needsConfirmation) {
          setMode('login')
          setMessage('Compte créé. Confirmez votre adresse e-mail (lien reçu), puis connectez-vous.')
        } else {
          onDone()
        }
      } else {
        await onSendReset(email)
        setMessage("Si ce compte existe, un e-mail de réinitialisation vient d'être envoyé.")
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-box">
      <h2>{TITLES[mode]}</h2>
      {message && <p className="msg-ok" role="status">{message}</p>}
      {error && <p className="msg-error" role="alert">{error}</p>}

      <form onSubmit={submit}>
        {mode === 'register' && (
          <input className="input" aria-label="Full name" placeholder="Full name" autoComplete="name"
            value={name} onChange={(e) => setName(e.target.value)} required />
        )}
        <input className="input" aria-label="Email" placeholder="Email" type="email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        {mode !== 'reset' && (
          <input className="input" aria-label="Password" placeholder="Password" type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={mode === 'register' ? 8 : undefined}
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        )}
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : SUBMIT_LABELS[mode]}
        </button>
      </form>

      <p style={{ margin: '16px 0 0' }}>
        {mode === 'login' ? (
          <>
            <button className="btn btn--link" onClick={() => switchMode('register')}>Create an account</button>
            {' · '}
            <button className="btn btn--link" onClick={() => switchMode('reset')}>Forgot password?</button>
          </>
        ) : (
          <button className="btn btn--link" onClick={() => switchMode('login')}>Back to login</button>
        )}
      </p>
    </div>
  )
}
