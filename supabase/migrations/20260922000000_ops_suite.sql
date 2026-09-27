-- Duty units ("Services"): agents create or join a unit instead of just
-- toggling their own status. A unit is "active" for display purposes as
-- long as at least one staff member currently points at it.
create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,
  status text not null default 'en_service' check (status in ('en_service', 'en_pause', 'hors_service')),
  created_at timestamptz not null default now()
);

alter table public.staff add column unit_id uuid references public.units(id) on delete set null;

alter table public.units enable row level security;

create policy "staff can view units"
  on public.units for select to authenticated using (true);
create policy "staff can create units"
  on public.units for insert to authenticated with check (true);
create policy "staff can update units"
  on public.units for update to authenticated using (true) with check (true);

-- Closed-shift history, written once per "Prendre service" / "Fin" cycle so
-- Historique can show past shifts (the `staff` row only holds the current one).
create table public.shifts (
  id bigint generated always as identity primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  unit_name text,
  sector text,
  status_label text,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.shifts enable row level security;

create policy "staff can view shifts"
  on public.shifts for select to authenticated using (true);
create policy "staff can create own shift"
  on public.shifts for insert to authenticated with check (staff_id = auth.uid());
create policy "staff can update own open shift"
  on public.shifts for update to authenticated using (staff_id = auth.uid()) with check (staff_id = auth.uid());
create policy "direction can update any shift"
  on public.shifts for update to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (true);

-- Absence requests.
create table public.absences (
  id bigint generated always as identity primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  motif text,
  status text not null default 'en_attente' check (status in ('en_attente', 'validee', 'refusee')),
  created_at timestamptz not null default now()
);

alter table public.absences enable row level security;

create policy "staff can view absences"
  on public.absences for select to authenticated using (true);
create policy "staff can create own absence"
  on public.absences for insert to authenticated with check (staff_id = auth.uid());
create policy "direction can update absence status"
  on public.absences for update to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (true);

-- Medical stock: a fixed item catalogue, a live quantity per item, and an
-- append-only movement ledger (récolte / fabrication / registre) that a
-- trigger folds into the live quantity so `stock` never drifts from history.
create table public.stock_items (
  key text primary key,
  label text not null
);

insert into public.stock_items (key, label) values
  ('medicaments', 'Medicaments'),
  ('methadone', 'Méthadone'),
  ('trousse_de_soin', 'Trousse de soin'),
  ('pince_a_epiler', 'Pince à épiler'),
  ('creme_brulures', 'Crème pour brûlures'),
  ('poche_de_glace', 'Poche de glace'),
  ('sedatif', 'Sédatif'),
  ('kit_de_suture', 'Kit de suture'),
  ('bandage', 'Bandage'),
  ('vicodin_5mg', 'Vicodin 5Mg'),
  ('morphine_30mg', 'Morphine 30mg'),
  ('percocet_5mg', 'Percocet 5mg'),
  ('percocet_10mg', 'Percocet 10mg'),
  ('percocet_30mg', 'Percocet 30mg'),
  ('defibrillateur', 'Défibrilateur'),
  ('morceaux_de_tissus', 'Morceaux de tissus'),
  ('produit_chimique', 'Produit Chimique'),
  ('kit_de_nettoyage', 'Kit de nettoyage'),
  ('kit_de_reparation', 'Kit de réparation');

create table public.stock (
  item_key text primary key references public.stock_items(key),
  quantity int not null default 0
);

insert into public.stock (item_key, quantity) select key, 0 from public.stock_items;

create table public.stock_movements (
  id bigint generated always as identity primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  item_key text not null references public.stock_items(key),
  delta int not null,
  source text not null check (source in ('recolte', 'fabrication', 'registre_depot', 'registre_retrait')),
  lieu text not null default 'Morgue',
  created_at timestamptz not null default now()
);

alter table public.stock_items enable row level security;
alter table public.stock enable row level security;
alter table public.stock_movements enable row level security;

create policy "staff can view stock items"
  on public.stock_items for select to authenticated using (true);
create policy "staff can view stock"
  on public.stock for select to authenticated using (true);
create policy "direction can update stock"
  on public.stock for update to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (true);
create policy "staff can view stock movements"
  on public.stock_movements for select to authenticated using (true);
create policy "staff can create own stock movement"
  on public.stock_movements for insert to authenticated with check (staff_id = auth.uid());

create function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select quantity from public.stock where item_key = new.item_key) + new.delta < 0 then
    raise exception 'Stock insuffisant';
  end if;
  update public.stock set quantity = quantity + new.delta where item_key = new.item_key;
  return new;
end;
$$;

create trigger stock_movement_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- Let Direction manage the roster directly (change a rank, force-end
-- someone's shift) instead of only their own row.
create policy "direction can update any staff"
  on public.staff for update to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (true);

-- Direction may change anyone's rank directly; everyone else is still
-- blocked from touching `role` (self-promotion), matching the original intent.
create or replace function public.staff_guard_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    select role into caller_role from public.staff where id = auth.uid();
    if caller_role is null or caller_role not in ('directeur', 'directeur_adjoint', 'directeur_centre') then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

alter publication supabase_realtime add table public.units;
alter publication supabase_realtime add table public.shifts;
alter publication supabase_realtime add table public.stock;
alter publication supabase_realtime add table public.absences;
