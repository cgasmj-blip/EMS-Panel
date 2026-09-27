-- Staff can cancel their own absence request, even once Direction has
-- validated it (RLS previously only let Direction delete absences).
create policy "staff can delete own absence"
  on public.absences for delete to authenticated
  using (staff_id = auth.uid());

-- The Archive's delete button silently failed: there was no delete policy
-- on payouts, so RLS blocked every attempt.
create policy "direction can delete payouts"
  on public.payouts for delete to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));
