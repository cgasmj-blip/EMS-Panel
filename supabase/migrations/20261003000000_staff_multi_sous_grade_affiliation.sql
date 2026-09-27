-- A staff member can hold several sous-grades and several affiliations at
-- once (e.g. Recruteur and Formateur together), so these move from single
-- columns on staff to many-to-many join tables.
create table public.staff_sous_grades (
  staff_id uuid not null references public.staff(id) on delete cascade,
  sous_grade_id text not null references public.sous_grades(id) on delete cascade,
  primary key (staff_id, sous_grade_id)
);

create table public.staff_affiliations (
  staff_id uuid not null references public.staff(id) on delete cascade,
  affiliation_id text not null references public.affiliations(id) on delete cascade,
  primary key (staff_id, affiliation_id)
);

insert into public.staff_sous_grades (staff_id, sous_grade_id)
  select id, sous_grade_id from public.staff where sous_grade_id is not null;
insert into public.staff_affiliations (staff_id, affiliation_id)
  select id, affiliation_id from public.staff where affiliation_id is not null;

alter table public.staff drop column sous_grade_id;
alter table public.staff drop column affiliation_id;

alter table public.staff_sous_grades enable row level security;
alter table public.staff_affiliations enable row level security;

create policy "staff can view staff sous grades" on public.staff_sous_grades for select to authenticated using (true);
create policy "staff can view staff affiliations" on public.staff_affiliations for select to authenticated using (true);

create policy "direction can manage staff sous grades" on public.staff_sous_grades for all to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

create policy "direction can manage staff affiliations" on public.staff_affiliations for all to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

alter publication supabase_realtime add table public.staff_sous_grades;
alter publication supabase_realtime add table public.staff_affiliations;
