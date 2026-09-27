-- Sous-grades (unit specializations) and affiliations (habilitations tied
-- to a sous-grade, e.g. PSU/CAPPA under AU, CAS under PU). Both are read
-- automatically from Discord roles via discord_role_map, the same mechanism
-- already used for the main grade — Direction extends discord_role_map with
-- the matching Discord role ids as those roles exist on the server.
create table public.sous_grades (
  id text primary key,
  label text not null,
  position int not null default 0
);

insert into public.sous_grades (id, label, position) values
  ('fu', 'FU · Fly Unit', 1),
  ('cgu', 'CGU · Coast Guard Unit', 2),
  ('dwu', 'DWU · Doctor Worldwide Unit', 3),
  ('mu', 'MU · Mountain Unit', 4),
  ('msu', 'MSU · Mass Shooting Unit', 5),
  ('au', 'AU · Analyst Unit', 6),
  ('du', 'DU · Detoxification Unit', 7),
  ('pu', 'PU · Physiotherapy Unit', 8),
  ('tbu', 'TBU · Transblood Unit', 9),
  ('logistique', 'Logistique', 10);

create table public.affiliations (
  id text primary key,
  label text not null,
  sous_grade_id text references public.sous_grades(id) on delete set null,
  position int not null default 0
);

insert into public.affiliations (id, label, sous_grade_id, position) values
  ('psu', 'PSU · Psychologue Unité', 'au', 1),
  ('cappa', 'CAPPA · Certificat d''aptitude au port d''arme', 'au', 2),
  ('cas', 'CAS · Certificat d''aptitude sportive', 'pu', 3),
  ('recruteur', 'Recruteur', null, 4),
  ('formateur', 'Formateur', null, 5);

alter table public.sous_grades enable row level security;
alter table public.affiliations enable row level security;

create policy "staff can view sous grades" on public.sous_grades for select to authenticated using (true);
create policy "staff can view affiliations" on public.affiliations for select to authenticated using (true);

alter publication supabase_realtime add table public.sous_grades;
alter publication supabase_realtime add table public.affiliations;

-- staff: sous-grade/affiliation, both auto-synced from Discord on login,
-- never editable by hand from Gestion.
alter table public.staff add column sous_grade_id text references public.sous_grades(id) on delete set null;
alter table public.staff add column affiliation_id text references public.affiliations(id) on delete set null;

-- discord_role_map: a single Discord role id can now also carry a
-- sous-grade or affiliation assignment (in addition to, or instead of, the
-- staff_role it may already carry).
alter table public.discord_role_map add column sous_grade_id text references public.sous_grades(id) on delete set null;
alter table public.discord_role_map add column affiliation_id text references public.affiliations(id) on delete set null;

-- Emergency codes: Direction can now add/remove codes freely, not just
-- rename the original three, so the old fixed check constraint has to go.
alter table public.units drop constraint if exists units_code_check;
alter table public.shifts drop constraint if exists shifts_code_check;

create policy "direction can delete emergency codes"
  on public.emergency_codes for delete to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

-- Vehicles: a simple named fleet list, optionally restricted to a grade
-- and/or sous-grade and/or affiliation.
create table public.vehicles (
  id bigint generated always as identity primary key,
  name text not null,
  grade text,
  sous_grade_id text references public.sous_grades(id) on delete set null,
  affiliation_id text references public.affiliations(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;

create policy "staff can view vehicles" on public.vehicles for select to authenticated using (true);
create policy "direction can manage vehicles"
  on public.vehicles for all to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

alter publication supabase_realtime add table public.vehicles;

-- Prestation types: same optional eligibility restriction as vehicles.
alter table public.prestation_types add column grade text;
alter table public.prestation_types add column sous_grade_id text references public.sous_grades(id) on delete set null;
alter table public.prestation_types add column affiliation_id text references public.affiliations(id) on delete set null;

-- Appointment types: now a configurable list instead of a hardcoded enum.
create table public.appointment_types (
  id text primary key,
  label text not null,
  position int not null default 0
);

insert into public.appointment_types (id, label, position) values
  ('cas', 'CAS', 1),
  ('cappa', 'CAPPA', 2),
  ('visite_medicale', 'Visite médicale', 3),
  ('autre', 'Autre', 4);

alter table public.appointment_types enable row level security;
create policy "staff can view appointment types" on public.appointment_types for select to authenticated using (true);
create policy "direction can manage appointment types"
  on public.appointment_types for all to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

alter publication supabase_realtime add table public.appointment_types;

alter table public.appointments drop constraint if exists appointments_type_check;
alter table public.appointments add constraint appointments_type_fkey foreign key (type) references public.appointment_types(id);
