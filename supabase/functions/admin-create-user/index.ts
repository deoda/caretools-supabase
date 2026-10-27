// Edge Function : création d'un utilisateur par un administrateur.
//
// Pourquoi une fonction serveur ?
//  - `supabase.auth.signUp()` depuis le navigateur CONNECTE le nouvel utilisateur
//    à la place de l'administrateur.
//  - Le rôle ne doit jamais être décidé par le navigateur : on le vérifie ici,
//    avec la clé service_role qui reste secrète côté serveur.
//
// Règles :
//  - `admin`      : peut créer uniquement des comptes `client`.
//  - `superadmin` : peut créer `client`, `admin` et `superadmin`.
//
// Déploiement :  supabase functions deploy admin-create-user
// (SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournies
//  automatiquement par Supabase aux Edge Functions.)

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const ROLES = ['client', 'admin', 'superadmin']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. Qui appelle ? (jeton de l'utilisateur connecté)
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Non authentifié' }, 401)

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Non authentifié' }, 401)

  // 2. Quel est son rôle ? (lu avec la clé service, pas depuis le navigateur)
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role, status')
    .eq('id', userData.user.id)
    .single()

  const callerRole = callerProfile?.status === 'active' || callerProfile?.status == null
    ? callerProfile?.role
    : null
  if (callerRole !== 'admin' && callerRole !== 'superadmin') {
    return json({ error: 'Accès refusé' }, 403)
  }

  // 3. Validation des données reçues
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Corps de requête invalide' }, 400)
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const name = String(body.name ?? '').trim().slice(0, 200)
  const role = String(body.role ?? 'client')

  if (!EMAIL_RE.test(email)) return json({ error: 'Adresse e-mail invalide' }, 400)
  if (password.length < 8) return json({ error: 'Mot de passe trop court (8 caractères minimum)' }, 400)
  if (!ROLES.includes(role)) return json({ error: 'Rôle invalide' }, 400)
  if (role !== 'client' && callerRole !== 'superadmin') {
    return json({ error: 'Seul un superadmin peut créer un administrateur' }, 403)
  }

  // 4. Création du compte (sans toucher à la session de l'administrateur)
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'Création impossible' }, 400)
  }

  // 5. Profil : le trigger SQL a déjà créé la ligne avec le rôle « client »;
  //    on applique ici le rôle voulu (clé service : le trigger de protection l'autorise).
  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    email,
    name: name || email.split('@')[0],
    role,
    status: 'active',
  })
  if (profileError) {
    // Pas de compte à moitié créé : on le retire.
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: profileError.message }, 500)
  }

  return json({ id: created.user.id, email, role })
})
