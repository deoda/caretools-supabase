import { createClient } from '@supabase/supabase-js'

const DEFAULT_URL = 'https://qzlqldnjfygdnhskzlmh.supabase.co'
const DEFAULT_KEY = 'sb_publishable_CFr1Sy32qHXQ-t7xAigHzg_PAV08hbI'

// Une variable .env vide ou mal formée ne doit jamais casser l'application :
// on retombe alors sur la valeur par défaut (avec un avertissement dans la console).
const readUrl = (value) => {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url) return DEFAULT_URL
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url
  } catch { /* URL invalide : on utilise la valeur par défaut */ }
  console.warn('VITE_SUPABASE_URL est invalide, utilisation de l\'URL par défaut.')
  return DEFAULT_URL
}

const readKey = (value) => (typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_KEY)

const supabaseUrl = readUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseKey = readKey(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

export const supabase = createClient(supabaseUrl, supabaseKey)

// Auth helpers
export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signUp = (email, password, metadata = {}) =>
  supabase.auth.signUp({ email, password, options: { data: metadata } })

export const signOut = () => supabase.auth.signOut()

export const getCurrentUser = () => supabase.auth.getUser()

export const onAuthStateChange = (callback) =>
  supabase.auth.onAuthStateChange(callback)
