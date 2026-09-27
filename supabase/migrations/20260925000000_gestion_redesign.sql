-- Emergency codes and intervention shortcuts, now admin-editable from
-- Gestion instead of hardcoded in the frontend.
create table public.emergency_codes (
  code text primary key,
  label text not null,
  position int not null default 0
);

insert into public.emergency_codes (code, label, position) values
  ('1', 'Code 1 · Routine', 1),
  ('2', 'Code 2 · Urgent', 2),
  ('3', 'Code 3 · Feux & sirènes', 3);

alter table public.emergency_codes enable row level security;

create policy "staff can view emergency codes"
  on public.emergency_codes for select to authenticated using (true);
create policy "direction can manage emergency codes"
  on public.emergency_codes for all to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

alter publication supabase_realtime add table public.emergency_codes;

create table public.intervention_shortcuts (
  id bigint generated always as identity primary key,
  label text not null,
  position int not null default 0
);

insert into public.intervention_shortcuts (label, position) values
  ('M.A.R.U.', 1),
  ('A.S.G.', 2),
  ('M.R.G.', 3),
  ('D.W.B.', 4),
  ('Don du sang', 5),
  ('Superviseur (M.T.T.)', 6),
  ('G.O.P.S.', 7),
  ('P.S.S.', 8);

alter table public.intervention_shortcuts enable row level security;

create policy "staff can view intervention shortcuts"
  on public.intervention_shortcuts for select to authenticated using (true);
create policy "direction can manage intervention shortcuts"
  on public.intervention_shortcuts for all to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

alter publication supabase_realtime add table public.intervention_shortcuts;

-- Aide (help articles) can now be authored by any role senior to
-- "chirurgien" in the hierarchy, not just Direction, since that management
-- UI moved into Gestion (which those roles can now open).
drop policy "direction can manage help articles" on public.help_articles;

create policy "senior staff can manage help articles"
  on public.help_articles for all to authenticated
  using (exists (
    select 1 from public.staff s
    where s.id = auth.uid()
    and s.role in (
      'directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service',
      'chef_chirurgie', 'chirurgien_expert', 'chirurgien_vacataire', 'chirurgien_specialise'
    )
  ))
  with check (exists (
    select 1 from public.staff s
    where s.id = auth.uid()
    and s.role in (
      'directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service',
      'chef_chirurgie', 'chirurgien_expert', 'chirurgien_vacataire', 'chirurgien_specialise'
    )
  ));
