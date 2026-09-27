-- Prestation types: a separate "service public" price, since it's often
-- different (usually free/reduced) from the normal tarif.
alter table public.prestation_types add column tarif_public int;

-- Direction can delete absences (needed for the expired-absence cleanup
-- triggered from Gestion, on top of the pg_cron job below).
create policy "direction can delete absences"
  on public.absences for delete to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

-- Automatic daily cleanup of absences whose end date has passed, so expired
-- entries disappear even if nobody opens the app. pg_cron isn't available on
-- every Supabase plan, so this is wrapped to fail silently rather than abort
-- the migration if the extension can't be enabled here.
do $$
begin
  execute 'create extension if not exists pg_cron with schema extensions';
  execute $cron$
    select cron.schedule(
      'delete-expired-absences',
      '0 3 * * *',
      $job$ delete from public.absences where end_date < current_date $job$
    )
  $cron$;
exception when others then
  raise notice 'pg_cron setup skipped: %', sqlerrm;
end $$;
