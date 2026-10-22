-- Existing rows keep their legacy single recipient until next save.
alter table public.trauma_handoffs add column assigned_staff uuid[] not null default '{}';
create index trauma_handoffs_assigned_staff_idx on public.trauma_handoffs using gin(assigned_staff);
alter policy trauma_handoffs_edit on public.trauma_handoffs to authenticated
using (((select auth.uid())=assigned_to or (select auth.uid())=any(assigned_staff)) and exists(select 1 from public.staff where id=(select auth.uid()) and active))
with check ((select auth.uid())=any(participants) and exists(select 1 from public.staff where id=(select auth.uid()) and active));

create or replace function public.guard_trauma_handoff() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare old_recipients uuid[]; recipients_changed boolean;
begin
  if auth.uid() is null or not exists(select 1 from public.staff where id=auth.uid() and active) then
    raise exception 'Membre actif requis' using errcode='42501';
  end if;
  if tg_op='UPDATE' then
    old_recipients:=case when cardinality(old.assigned_staff)>0 then old.assigned_staff else array[old.assigned_to] end;
    if not auth.uid()=any(old_recipients) then raise exception 'Dossier confié à une autre équipe' using errcode='42501'; end if;
    if new.id<>old.id or new.created_by<>old.created_by or new.created_at<>old.created_at then
      raise exception 'Identité du dossier non modifiable' using errcode='42501';
    end if;
    -- Compatibility for old clients updating only assigned_to.
    if new.assigned_staff=old.assigned_staff then
      new.assigned_staff:=case when new.assigned_to<>old.assigned_to then array[new.assigned_to] else old_recipients end;
    end if;
  elsif cardinality(new.assigned_staff)=0 then new.assigned_staff:=array[new.assigned_to];
  end if;
  if cardinality(new.assigned_staff) not between 1 and 100 or array_position(new.assigned_staff,null) is not null then
    raise exception 'Sélectionnez entre 1 et 100 destinataires' using errcode='23514';
  end if;
  if cardinality(new.assigned_staff)<>(select count(distinct u) from unnest(new.assigned_staff) u) then
    raise exception 'Destinataires en double' using errcode='23514';
  end if;
  recipients_changed:=tg_op='INSERT' or new.assigned_staff is distinct from old_recipients;
  if recipients_changed then
    if exists(select 1 from unnest(new.assigned_staff) u where not exists(select 1 from public.staff where id=u and active)) then
      raise exception 'Tous les destinataires doivent être actifs' using errcode='23514';
    end if;
    -- Firefighters may create their own report, but transmissions go to EMS only.
    if exists(select 1 from unnest(new.assigned_staff) u join public.staff_affiliations a on a.staff_id=u and a.affiliation_id='pompier'
      where not (cardinality(new.assigned_staff)=1 and u=auth.uid() and new.status<>'transferred')) then
      raise exception 'La transmission est réservée aux destinataires EMS' using errcode='23514';
    end if;
  end if;
  new.assigned_to:=new.assigned_staff[1];
  if tg_op='INSERT' then
    if new.created_by<>auth.uid() then raise exception 'Auteur invalide' using errcode='42501'; end if;
    new.participants:=array(select distinct u from unnest(array[new.created_by] || new.assigned_staff) u);
    new.version:=1; new.history:='[]'::jsonb; new.created_at:=now();
  else
    new.participants:=array(select distinct u from unnest(old.participants || new.assigned_staff) u);
    new.version:=old.version+1; new.history:=old.history;
  end if;
  if (recipients_changed and new.assigned_staff<>array[auth.uid()]) or (tg_op='UPDATE' and not auth.uid()=any(new.assigned_staff)) then new.status:='transferred'; end if;
  new.updated_at:=now();
  new.history:=new.history || jsonb_build_array(jsonb_build_object('actor',auth.uid(),'assigned_to',new.assigned_to,'assigned_staff',new.assigned_staff,'action',new.status,'at',new.updated_at));
  return new;
end;
$$;
revoke all on function public.guard_trauma_handoff() from public,anon,authenticated;
