import { useState } from 'react'

// Affichée quand l'utilisateur arrive depuis le lien « mot de passe oublié » reçu par e-mail.
export default function RecoveryPage({ onUpdatePassword, onDone }) {
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onUpdatePassword(newPassword)
      alert('Mot de passe mis à jour')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-box">
      <h2>Choose a new password</h2>
      {error && <p className="msg-error" role="alert">{error}</p>}
      <form onSubmit={submit}>
        <input className="input" aria-label="New password" placeholder="New password (8 caractères min.)"
          type="password" autoComplete="new-password" minLength={8}
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : 'Save password'}
        </button>
      </form>
    </div>
  )
}
