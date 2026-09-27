-- Paying out an agent's commission archives their current shifts and
-- prestations (stamped with archived_at + payout_id) instead of deleting
-- them, so the agent's live totals reset to 0 while Direction keeps a full
-- record in the Archive.
alter table public.shifts add column archived_at timestamptz;
alter table public.prestations add column archived_at timestamptz;

create table public.payouts (
  id bigint generated always as identity primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  paid_by uuid references public.staff(id) on delete set null,
  services_count int not null default 0,
  prestations_count int not null default 0,
  prestations_total int not null default 0,
  commission int not null default 0,
  paid_at timestamptz not null default now()
);

alter table public.shifts add column payout_id bigint references public.payouts(id) on delete set null;
alter table public.prestations add column payout_id bigint references public.payouts(id) on delete set null;

alter table public.payouts enable row level security;

create policy "direction can view payouts"
  on public.payouts for select to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));
create policy "direction can create payouts"
  on public.payouts for insert to authenticated
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

alter publication supabase_realtime add table public.payouts;

-- Direction needs to stamp archived_at/payout_id on existing rows when
-- paying an agent out.
create policy "direction can archive prestations"
  on public.prestations for update to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

create policy "direction can archive shifts"
  on public.shifts for update to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));
