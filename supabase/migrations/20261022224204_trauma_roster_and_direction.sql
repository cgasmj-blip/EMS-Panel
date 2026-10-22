alter table public.trauma_handoffs add column deleted_at timestamptz, add column deleted_by uuid references public.staff(id);
alter policy trauma_handoffs_read on public.trauma_handoffs to authenticated
using (exists(select 1 from public.staff s where s.id=(select auth.uid()) and s.active and (s.role in ('directeur','directeur_adjoint') or (select auth.uid())=any(participants))));
alter policy trauma_handoffs_edit on public.trauma_handoffs to authenticated
using (exists(select 1 from public.staff s where s.id=(select auth.uid()) and s.active and (s.role in ('directeur','directeur_adjoint') or created_by=s.id or assigned_to=s.id or s.id=any(assigned_staff))))
with check (exists(select 1 from public.staff s where s.id=(select auth.uid()) and s.active and (s.role in ('directeur','directeur_adjoint') or s.id=any(participants))));

create or replace function public.guard_trauma_handoff() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare old_recipients uuid[]; recipients_changed boolean; direction boolean;
begin
  if auth.uid() is null or not exists(select 1 from public.staff where id=auth.uid() and active) then
    raise exception 'Membre actif requis' using errcode='42501';
  end if;
  select exists(select 1 from public.staff where id=auth.uid() and active and role in ('directeur','directeur_adjoint')) into direction;
  if tg_op='UPDATE' and (new.deleted_at is distinct from old.deleted_at or new.deleted_by is distinct from old.deleted_by) then
    if old.created_by<>auth.uid() and not direction then raise exception 'Suppression réservée à l’auteur ou à la direction' using errcode='42501'; end if;
    if (to_jsonb(new)-array['deleted_at','deleted_by']) is distinct from (to_jsonb(old)-array['deleted_at','deleted_by']) then
      raise exception 'La suppression ne peut pas modifier le dossier' using errcode='42501';
    end if;
    if new.deleted_at is not null then new.deleted_at:=now(); new.deleted_by:=auth.uid(); else new.deleted_by:=null; end if;
    new.version:=old.version+1; new.updated_at:=now();
    new.history:=old.history || jsonb_build_array(jsonb_build_object('actor',auth.uid(),'assigned_to',old.assigned_to,'assigned_staff',old.assigned_staff,'action',case when new.deleted_at is null then 'restored' else 'deleted' end,'at',new.updated_at));
    return new;
  end if;
  if (tg_op='UPDATE' and old.deleted_at is not null) or (tg_op='INSERT' and (new.deleted_at is not null or new.deleted_by is not null)) then
    raise exception 'Dossier dans la corbeille : restauration requise' using errcode='42501';
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
    -- EMS ranks remain eligible even when the staff member also has a firefighter affiliation.
    if exists(select 1 from unnest(new.assigned_staff) u join public.staff s on s.id=u
      where s.role='membre' and not (cardinality(new.assigned_staff)=1 and u=auth.uid() and new.status<>'transferred')) then
      raise exception 'Choisissez un membre des effectifs EMS' using errcode='23514';
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
