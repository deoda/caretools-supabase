-- =====================================================================
-- CareTools : statuts de commande + restauration du stock à l'annulation
-- À exécuter APRÈS 001_schema_rls.sql. Script idempotent.
-- =====================================================================

-- Statuts autorisés (NOT VALID : n'échoue pas sur d'anciennes lignes,
-- mais s'applique à toute nouvelle écriture).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_status_check') then
    alter table public.orders
      add constraint orders_status_check
      check (status in ('Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')) not valid;
  end if;
end $$;

-- Annulation : le stock des articles est remis en rayon UNE seule fois
-- (colonne stock_restored). Une commande annulée ne peut pas être réactivée,
-- sinon le stock devrait être re-décompté (créer une nouvelle commande à la place).
create or replace function public.orders_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_qty  integer;
begin
  if old.status = 'Cancelled' and new.status is distinct from 'Cancelled' then
    raise exception 'Une commande annulée ne peut pas être réactivée'
      using errcode = '22023';
  end if;

  if new.status = 'Cancelled'
     and old.status is distinct from 'Cancelled'
     and not coalesce(old.stock_restored, false) then

    for v_item in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
    loop
      v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
      if v_qty > 0 then
        update public.products
           set stock = stock + v_qty
         where id::text = (v_item ->> 'id');
      end if;
    end loop;

    new.stock_restored := true;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_before_update_trg on public.orders;
create trigger orders_before_update_trg
  before update on public.orders
  for each row execute function public.orders_before_update();
