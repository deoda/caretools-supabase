import { useEffect, useState } from 'react'
import { supabase, onAuthStateChange, signIn, signUp, signOut } from '../services/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  // Le profil est rangé avec l'identifiant de son propriétaire (jamais montré après un changement d'utilisateur).
  const [profileState, setProfileState] = useState({ id: null, data: null })
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  // 1) Session : le callback reste synchrone (appeler Supabase à l'intérieur
  //    peut provoquer un blocage, c'est déconseillé par la documentation).
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
      if (!session?.user) setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 2) Profil (rôle) : chargé quand l'utilisateur change.
  const userId = user?.id

  useEffect(() => {
    if (!userId) return undefined

    let cancelled = false
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Impossible de charger le profil :', error.message)
        setProfileState({ id: userId, data: data ?? null })
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [userId])

  const profile = userId && profileState.id === userId ? profileState.data : null

  const login = async (email, password) => {
    const { error } = await signIn(email, password)
    if (error) throw error
  }

  // Le rôle n'est jamais envoyé : le serveur attribue toujours « client ».
  const register = async (name, email, password) => {
    const { data, error } = await signUp(email, password, { name })
    if (error) throw error
    // Si la confirmation par e-mail est activée, aucune session n'est ouverte.
    return { needsConfirmation: !data.session }
  }

  const sendPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) throw error
  }

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    setRecovering(false)
  }

  const logout = async () => {
    await signOut()
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'
  const isSuperAdmin = profile?.role === 'superadmin'

  return {
    user,
    profile,
    loading,
    recovering,
    isAdmin,
    isSuperAdmin,
    login,
    register,
    sendPasswordReset,
    updatePassword,
    logout,
  }
}
