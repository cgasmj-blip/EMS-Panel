-- 1) Grade restrictions become multi-select (a vehicle/prestation/shortcut/
-- rendez-vous type can be restricted to several grades at once instead of
-- just one).
alter table public.vehicles alter column grade type text[] using (case when grade is null then null else array[grade] end);
alter table public.prestation_types alter column grade type text[] using (case when grade is null then null else array[grade] end);
alter table public.intervention_shortcuts alter column grade type text[] using (case when grade is null then null else array[grade] end);

-- Rendez-vous types gain the same eligibility restriction (grade[] /
-- sous-grade / affiliation) already used by vehicles/prestations/shortcuts.
alter table public.appointment_types add column grade text[];
alter table public.appointment_types add column sous_grade_id text references public.sous_grades(id) on delete set null;
alter table public.appointment_types add column affiliation_id text references public.affiliations(id) on delete set null;

-- 2) Direction can manage sous-grades and affiliations themselves (add,
-- rename, delete) from a new Gestion section — the tables only had a select
-- policy before.
create policy "direction can manage sous grades"
  on public.sous_grades for all to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')));

create policy "direction can manage affiliations"
  on public.affiliations for all to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')));

-- 3) Gestion access tiers: directeur/directeur-adjoint keep full access to
-- every section. directeur de centre, chef de pôle, chef de service and
-- chef de chirurgie now get a limited subset (utilisateurs, services,
-- absences, aide, payes, historique) but lose access to the
-- full-access-only sections (tarifs, codes, archive, rdv, véhicules, and the
-- new sous-grade/affiliation management) that they previously had as
-- "directeur_centre" was bundled into every direction policy.

-- Tighten to full-access-only (drop directeur_centre):
alter policy "direction can manage emergency codes" on public.emergency_codes
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')));

alter policy "direction can delete emergency codes" on public.emergency_codes
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')));

alter policy "direction can manage intervention shortcuts" on public.intervention_shortcuts
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')));

alter policy "direction can manage prestation types" on public.prestation_types
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')));

alter policy "direction can delete any appointment" on public.appointments
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')));

alter policy "direction can manage vehicles" on public.vehicles
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')));

alter policy "direction can manage appointment types" on public.appointment_types
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')));

alter policy "direction can delete payouts" on public.payouts
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint')));

-- Broaden to the limited-access tier (add chef_pole/chef_service/chef_chirurgie, keep directeur_centre):
alter policy "direction can update any staff" on public.staff
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')));

alter policy "direction can update any shift" on public.shifts
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')));

alter policy "direction can update absence status" on public.absences
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')));

alter policy "direction can delete absences" on public.absences
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')));

alter policy "direction can view payouts" on public.payouts
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')));

alter policy "direction can create payouts" on public.payouts
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')));

alter policy "direction can archive prestations" on public.prestations
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')));

alter policy "direction can archive shifts" on public.shifts
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')));

alter policy "direction can manage staff sous grades" on public.staff_sous_grades
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')));

alter policy "direction can manage staff affiliations" on public.staff_affiliations
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre', 'chef_pole', 'chef_service', 'chef_chirurgie')));
