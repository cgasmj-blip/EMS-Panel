-- Emergency response codes (1 = routine, 2 = urgent, 3 = lights & sirens),
-- tracked on the unit while it's in service and snapshotted onto the shift
-- record for the historique once the shift is logged.
alter table public.units add column code text check (code in ('1', '2', '3'));
alter table public.shifts add column code text check (code in ('1', '2', '3'));

-- Prestations: billable acts with an admin-configurable price list.
create table public.prestation_types (
  id text primary key,
  label text not null,
  tarif int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.prestation_types (id, label, tarif) values
  ('soins', 'Soins', 1000);

create table public.prestations (
  id bigint generated always as identity primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  prestation_type_id text not null references public.prestation_types(id),
  montant int not null,
  is_public boolean not null default false,
  details text,
  created_at timestamptz not null default now()
);

alter table public.prestation_types enable row level security;
alter table public.prestations enable row level security;

create policy "staff can view prestation types"
  on public.prestation_types for select to authenticated using (true);
create policy "direction can manage prestation types"
  on public.prestation_types for all to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

create policy "staff can view prestations"
  on public.prestations for select to authenticated using (true);
create policy "staff can create own prestation"
  on public.prestations for insert to authenticated with check (staff_id = auth.uid());

alter publication supabase_realtime add table public.prestation_types;

-- Agenda: shared appointment book (CAS / CAPPA exams, medical visits, etc).
create table public.appointments (
  id bigint generated always as identity primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  type text not null check (type in ('cas', 'cappa', 'visite_medicale', 'autre')),
  title text,
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.appointments enable row level security;

create policy "staff can view appointments"
  on public.appointments for select to authenticated using (true);
create policy "staff can create own appointment"
  on public.appointments for insert to authenticated with check (staff_id = auth.uid());
create policy "staff can delete own appointment"
  on public.appointments for delete to authenticated using (staff_id = auth.uid());
create policy "direction can delete any appointment"
  on public.appointments for delete to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

alter publication supabase_realtime add table public.appointments;
