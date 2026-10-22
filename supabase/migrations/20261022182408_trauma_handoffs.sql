-- Explicit colleague-to-colleague handoff, shared by active EMS and firefighter staff.
create table public.trauma_handoffs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 160),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 524288),
  created_by uuid not null references public.staff(id),
  assigned_to uuid not null references public.staff(id),
  participants uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','transferred','completed')),
  version integer not null default 1,
  history jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.trauma_handoffs enable row level security;
revoke all on public.trauma_handoffs from public, anon, authenticated;
grant select, insert, update on public.trauma_handoffs to authenticated;
create index trauma_handoffs_assignee_idx on public.trauma_handoffs(assigned_to, updated_at desc);
create index trauma_handoffs_participants_idx on public.trauma_handoffs using gin(participants);

create policy trauma_handoffs_read on public.trauma_handoffs for select to authenticated
using ((select auth.uid()) = any(participants) and exists(select 1 from public.staff where id=(select auth.uid()) and active));
create policy trauma_handoffs_create on public.trauma_handoffs for insert to authenticated
with check (created_by=(select auth.uid()) and exists(select 1 from public.staff where id=(select auth.uid()) and active));
create policy trauma_handoffs_edit on public.trauma_handoffs for update to authenticated
using (assigned_to=(select auth.uid()) and exists(select 1 from public.staff where id=(select auth.uid()) and active))
with check ((select auth.uid())=any(participants) and exists(select 1 from public.staff where id=(select auth.uid()) and active));

-- Invoker trigger: no elevated rights; the client cannot forge authorship or history.
create function public.guard_trauma_handoff() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.staff where id=auth.uid() and active) then
    raise exception 'Membre actif requis' using errcode='42501';
  end if;
  if not exists(select 1 from public.staff where id=new.assigned_to and active) then
    raise exception 'Le destinataire doit être un membre actif' using errcode='23514';
  end if;
  if tg_op='INSERT' then
    if new.created_by <> auth.uid() then raise exception 'Auteur invalide' using errcode='42501'; end if;
    new.participants:=array[new.created_by,new.assigned_to];
    new.version:=1;
    new.history:='[]'::jsonb;
    new.created_at:=now();
  else
    if old.assigned_to <> auth.uid() then raise exception 'Dossier confié à un autre collègue' using errcode='42501'; end if;
    if new.id<>old.id or new.created_by<>old.created_by or new.created_at<>old.created_at then
      raise exception 'Identité du dossier non modifiable' using errcode='42501';
    end if;
    new.participants:=array(select distinct u from unnest(old.participants || array[new.assigned_to]) u);
    new.version:=old.version+1;
    new.history:=old.history;
  end if;
  if new.assigned_to<>auth.uid() then new.status:='transferred'; end if;
  new.updated_at:=now();
  new.history:=new.history || jsonb_build_array(jsonb_build_object('actor',auth.uid(),'assigned_to',new.assigned_to,'action',new.status,'at',new.updated_at));
  return new;
end;
$$;
revoke all on function public.guard_trauma_handoff() from public,anon,authenticated;
create trigger guard_trauma_handoff before insert or update on public.trauma_handoffs
for each row execute function public.guard_trauma_handoff();
