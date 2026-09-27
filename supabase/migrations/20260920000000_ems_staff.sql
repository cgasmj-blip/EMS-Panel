-- EMS staff roster: one row per authenticated (Discord) user, tracking their
-- role and current duty status.

create table public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text,
  full_name text not null default 'Agent',
  avatar_url text,
  role text not null default 'ambulancier'
    check (role in ('medecin', 'infirmier', 'ambulancier', 'chef_service')),
  status text not null default 'hors_service'
    check (status in ('en_service', 'en_pause', 'hors_service')),
  shift_started_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

-- Every authenticated agent can see the whole roster (needed to display who's on duty).
create policy "staff can view roster"
  on public.staff for select
  to authenticated
  using (true);

-- An agent may only touch their own row (fallback for the client-side profile sync;
-- the row is normally created by the trigger below).
create policy "staff can insert own row"
  on public.staff for insert
  to authenticated
  with check (id = auth.uid());

create policy "staff can update own row"
  on public.staff for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Prevent an agent from promoting themselves: only a service-role call
-- (e.g. an admin edge function) may change `role`.
create function public.staff_guard_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger staff_guard_role_trigger
  before update on public.staff
  for each row execute function public.staff_guard_role();

-- Create the roster row automatically on first Discord sign-in.
create function public.handle_new_ems_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff (id, discord_id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub'),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Agent'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_ems
  after insert on auth.users
  for each row execute function public.handle_new_ems_user();

alter publication supabase_realtime add table public.staff;
