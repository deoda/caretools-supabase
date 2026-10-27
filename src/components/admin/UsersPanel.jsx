import { useState } from 'react'
import { supabase } from '../../services/supabase'

const EMPTY_USER = { email: '', password: '', name: '', role: 'client' }

export default function UsersPanel({ users, isSuperAdmin, onChanged }) {
  const [newUser, setNewUser] = useState(EMPTY_USER)
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setNewUser({ ...newUser, [key]: e.target.value })

  const createUser = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      // Création côté serveur : le navigateur ne décide jamais du rôle
      // et la session de l'administrateur n'est pas remplacée.
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: newUser.email,
          password: newUser.password,
          name: newUser.name,
          role: isSuperAdmin ? newUser.role : 'client',
        },
      })
      if (error) {
        let message = error.message
        try {
          const details = await error.context?.json()
          if (details?.error) message = details.error
        } catch { /* réponse non JSON : on garde le message d'origine */ }
        throw new Error(message)
      }
      if (data?.error) throw new Error(data.error)
      setNewUser(EMPTY_USER)
      onChanged()
      alert('User created')
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const updateRole = async (id, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) alert(error.message)
    onChanged()
  }

  return (
    <>
      <div className="section">
        <h2>Create User</h2>
        <form onSubmit={createUser}>
          <input className="input" aria-label="Name" placeholder="Name" value={newUser.name} onChange={set('name')} />
          <input className="input" aria-label="Email" placeholder="Email" type="email" value={newUser.email} onChange={set('email')} required />
          <input className="input" aria-label="Password" placeholder="Password (8 caractères min.)" type="password"
            minLength={8} autoComplete="new-password" value={newUser.password} onChange={set('password')} required />
          {isSuperAdmin && (
            <select className="input" aria-label="Role" value={newUser.role} onChange={set('role')}>
              <option value="client">Client</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
          )}
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create User'}
          </button>
        </form>
      </div>

      <h3>Users ({users.length})</h3>
      {users.map((u) => (
        <div key={u.id} className="user-row">
          <span>{u.name || '—'} <small>({u.email})</small></span>
          {isSuperAdmin ? (
            <select aria-label={`Role of ${u.email}`} value={u.role} onChange={(e) => updateRole(u.id, e.target.value)}>
              <option value="client">Client</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
          ) : (
            <span>{u.role}</span>
          )}
        </div>
      ))}
    </>
  )
}
