# Mise en place Supabase

Ordre à suivre (SQL Editor ou `supabase db push`) :

1. `migrations/001_schema_rls.sql` : tables, RLS, commande atomique `place_order`, rôles protégés.
2. `migrations/002_order_status_stock.sql` : statuts de commande, restauration du stock à l'annulation.
3. Déployer la fonction : `supabase functions deploy admin-create-user`.
4. Se donner le rôle superadmin (une seule fois, dans l'éditeur SQL) :
   `update public.profiles set role = 'superadmin' where email = 'VOTRE_EMAIL';`

Réglages dans le tableau de bord Supabase (Authentication) :

- **URL Configuration > Redirect URLs** : ajouter l'adresse du site (et `http://localhost:5173`),
  sinon le lien « mot de passe oublié » ne ramène pas à l'application.
- **Providers > Email** : choisir si la confirmation par e-mail est obligatoire
  (l'application gère les deux cas à l'inscription).
