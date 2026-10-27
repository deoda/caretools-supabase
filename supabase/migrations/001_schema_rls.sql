-- =====================================================================
-- CareTools : schéma, sécurité (RLS), commande atomique, rôles
-- À exécuter dans Supabase > SQL Editor (ou `supabase db push`).
-- Script idempotent : il peut être rejoué sans casser les données.
-- Les tables existantes sont conservées ; seules les colonnes
-- manquantes sont ajoutées.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text,
  role       text not null default 'client',
  status     text not null default 'active',
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email      text;
alter table public.profiles add column if not exists name       text;
alter table public.profiles add column if not exists role       text not null default 'client';
alter table public.profiles add column if not exists status     text not null default 'active';
alter table public.profiles add column if not exists created_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('client', 'admin', 'superadmin')) not valid;
  end if;
end $$;

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  price        numeric not null default 0,
  category     text,
  subcategory  text,
  image        text,
  video        text,
  stock        integer not null default 0,
  badge        text,
  product_code text,
  size         text,
  status       text not null default 'active',
  created_at   timestamptz not null default now()
);
alter table public.products add column if not exists description  text;
alter table public.products add column if not exists category     text;
alter table public.products add column if not exists subcategory  text;
alter table public.products add column if not exists image        text;
alter table public.products add column if not exists video        text;
alter table public.products add column if not exists badge        text;
alter table public.products add column if not exists product_code text;
alter table public.products add column if not exists size         text;
alter table public.products add column if not exists status       text not null default 'active';
alter table public.products add column if not exists created_at  timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_stock_check') then
    alter table public.products add constraint products_stock_check check (stock >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_price_check') then
    alter table public.products add constraint products_price_check check (price >= 0) not valid;
  end if;
end $$;

create table if not exists public.orders (
  id             text primary key,
  user_id        uuid references auth.users (id) on delete set null,
  customer       jsonb not null default '{}'::jsonb,
  items          jsonb not null default '[]'::jsonb,
  subtotal       numeric not null default 0,
  shipping       numeric not null default 0,
  total          numeric not null default 0,
  status         text not null default 'Confirmed',
  stock_restored boolean not null default false,
  created_at     timestamptz not null default now()
);
alter table public.orders add column if not exists stock_restored boolean not null default false;
alter table public.orders add column if not exists created_at     timestamptz not null default now();

create index if not exists orders_user_id_idx    on public.orders (user_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- Ancienne table de compteur : conservée pour reprendre la numérotation,
-- mais plus accessible aux clients (voir RLS plus bas).
create table if not exists public.settings (
  key   text primary key,
  value jsonb
);

-- ---------------------------------------------------------------------
-- 2. NUMÉROTATION DES COMMANDES (séquence atomique)
-- ---------------------------------------------------------------------

create sequence if not exists public.order_number_seq start 1001;

-- Reprend après le dernier numéro déjà utilisé (ancien compteur ou commandes).
do $$
declare
  last_used bigint;
begin
  select coalesce(max((regexp_replace(id, '\D', '', 'g'))::bigint), 1000)
    into last_used
    from public.orders
   where id ~ '^CT-\d+$';

  begin
    last_used := greatest(
      last_used,
      coalesce((select (value::text)::bigint from public.settings where key = 'order_counter'), 0)
    );
  exception when others then
    null; -- valeur de compteur non numérique : on ignore
  end;

  perform setval('public.order_number_seq', greatest(last_used + 1, 1001), false);
end $$;

-- ---------------------------------------------------------------------
-- 3. FONCTIONS UTILITAIRES DE RÔLE
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and p.role in ('admin', 'superadmin')
       and coalesce(p.status, 'active') = 'active'
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and p.role = 'superadmin'
       and coalesce(p.status, 'active') = 'active'
  );
$$;

revoke all on function public.is_admin()      from public;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_admin()      to anon, authenticated;
grant execute on function public.is_superadmin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. PROFILS : création automatique + protection des rôles
-- ---------------------------------------------------------------------

-- Chaque nouveau compte Auth reçoit TOUJOURS le rôle « client ».
-- Le rôle n'est jamais lu depuis les métadonnées envoyées par le navigateur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'client',
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rattrapage : crée un profil « client » pour les comptes Auth existants qui n'en ont pas.
insert into public.profiles (id, email, name, role, status)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)), 'client', 'active'
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Empêche toute auto-promotion : seuls un superadmin ou le serveur
-- (service_role / éditeur SQL, où auth.uid() est nul) peuvent changer
-- le rôle, le statut, l'identifiant ou l'e-mail d'un profil.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_superadmin() then
    return new;
  end if;

  if new.role   is distinct from old.role
  or new.status is distinct from old.status
  or new.id     is distinct from old.id
  or new.email  is distinct from old.email then
    raise exception 'Modification du rôle, du statut ou de l''e-mail non autorisée'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_columns_trg on public.profiles;
create trigger protect_profile_columns_trg
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders   enable row level security;
alter table public.settings enable row level security;

-- ---- profiles
drop policy if exists profiles_select          on public.profiles;
drop policy if exists profiles_insert_self     on public.profiles;
drop policy if exists profiles_update_self     on public.profiles;
drop policy if exists profiles_update_admin    on public.profiles;
drop policy if exists profiles_delete          on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'client' and status = 'active');

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.is_superadmin());

-- ---- products
drop policy if exists products_select on public.products;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;
drop policy if exists products_delete on public.products;

-- Public : produits non désactivés. Admin : tout.
create policy products_select on public.products
  for select to anon, authenticated
  using (coalesce(status, 'active') <> 'inactive' or public.is_admin());

create policy products_insert on public.products
  for insert to authenticated
  with check (public.is_admin());

create policy products_update on public.products
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy products_delete on public.products
  for delete to authenticated
  using (public.is_admin());

-- ---- orders : lecture seule côté client, création uniquement via place_order()
drop policy if exists orders_select on public.orders;
drop policy if exists orders_update on public.orders;
drop policy if exists orders_delete on public.orders;
drop policy if exists orders_insert on public.orders;

create policy orders_select on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy orders_update on public.orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy orders_delete on public.orders
  for delete to authenticated
  using (public.is_superadmin());

-- ---- settings : réservé aux administrateurs (plus d'accès public)
drop policy if exists settings_admin_all on public.settings;
create policy settings_admin_all on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. COMMANDE ATOMIQUE : prix, stock et numéro calculés côté serveur
-- ---------------------------------------------------------------------
-- Entrée : p_items  = [{ "id": "<id produit>", "quantity": 2 }, ...]
--          p_customer = { "name": "...", "phone": "...", "address": "..." }
-- Le navigateur n'envoie JAMAIS de prix ni de total : tout est relu en base.

create or replace function public.place_order(p_items jsonb, p_customer jsonb default '{}'::jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_item     jsonb;
  v_prod     public.products%rowtype;
  v_qty      integer;
  v_subtotal numeric := 0;
  v_lines    jsonb := '[]'::jsonb;
  v_email    text;
  v_order    public.orders%rowtype;
begin
  if v_uid is null then
    raise exception 'Connexion requise pour passer commande' using errcode = '28000';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier est vide' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'Panier trop volumineux' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_qty := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Quantité invalide' using errcode = '22023';
    end;

    if v_qty is null or v_qty < 1 or v_qty > 1000 then
      raise exception 'Quantité invalide' using errcode = '22023';
    end if;

    -- Verrou de ligne : deux commandes simultanées ne peuvent pas
    -- consommer le même stock.
    select * into v_prod
      from public.products
     where id::text = (v_item ->> 'id')
       and coalesce(status, 'active') <> 'inactive'
       for update;

    if not found then
      raise exception 'Produit introuvable ou indisponible' using errcode = 'P0002';
    end if;

    if v_prod.stock < v_qty then
      raise exception 'Stock insuffisant pour « % » (disponible : %)', v_prod.name, v_prod.stock
        using errcode = 'P0001';
    end if;

    update public.products set stock = stock - v_qty where id = v_prod.id;

    v_subtotal := v_subtotal + v_prod.price * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'id',       v_prod.id,
      'name',     v_prod.name,
      'price',    v_prod.price,
      'quantity', v_qty
    );
  end loop;

  select email into v_email from auth.users where id = v_uid;

  insert into public.orders (id, user_id, customer, items, subtotal, shipping, total, status, stock_restored)
  values (
    'CT-' || nextval('public.order_number_seq'),
    v_uid,
    jsonb_build_object(
      'name',    nullif(left(coalesce(p_customer ->> 'name', ''), 200), ''),
      'email',   v_email,
      'phone',   nullif(left(coalesce(p_customer ->> 'phone', ''), 50), ''),
      'address', nullif(left(coalesce(p_customer ->> 'address', ''), 500), '')
    ),
    v_lines,
    v_subtotal,
    0,
    v_subtotal,
    'Confirmed',
    false
  )
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.place_order(jsonb, jsonb) from public;
revoke all on function public.place_order(jsonb, jsonb) from anon;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 7. STOCKAGE DES IMAGES (bucket « products »)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

drop policy if exists products_images_read   on storage.objects;
drop policy if exists products_images_insert on storage.objects;
drop policy if exists products_images_update on storage.objects;
drop policy if exists products_images_delete on storage.objects;

create policy products_images_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'products');

create policy products_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'products' and public.is_admin());

create policy products_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'products' and public.is_admin())
  with check (bucket_id = 'products' and public.is_admin());

create policy products_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'products' and public.is_admin());

-- ---------------------------------------------------------------------
-- 8. PREMIER SUPERADMIN (à faire UNE fois, à la main)
-- ---------------------------------------------------------------------
-- Après avoir créé votre compte via l'application (ou Auth > Users),
-- exécutez dans l'éditeur SQL (où auth.uid() est nul, donc autorisé) :
--
--   update public.profiles set role = 'superadmin' where email = 'VOTRE_EMAIL';
--
-- ---------------------------------------------------------------------
