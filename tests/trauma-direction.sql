begin;
do $$
declare owner_id uuid; recipient uuid; outsider uuid; director uuid; doc uuid; n integer;
begin
 select s.id into owner_id from public.staff s where s.active and s.role not in ('membre','directeur','directeur_adjoint') order by s.id limit 1;
 select s.id into recipient from public.staff s join public.staff_affiliations a on a.staff_id=s.id where s.active and s.role not in ('membre','directeur','directeur_adjoint') and a.affiliation_id='pompier' and s.id<>owner_id limit 1;
 select s.id into outsider from public.staff s where s.active and s.role not in ('membre','directeur','directeur_adjoint') and s.id not in (owner_id,recipient) limit 1;
 select s.id into director from public.staff s where s.active and s.role in ('directeur','directeur_adjoint') limit 1;
 if owner_id is null or recipient is null or outsider is null or director is null then raise exception 'Test staff required'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true); set local role authenticated;
 insert into public.trauma_handoffs(title,payload,created_by,assigned_to) values('__rollback_direction_test__','{}',owner_id,owner_id) returning id into doc;
 update public.trauma_handoffs set assigned_staff=array[recipient],status='transferred' where id=doc;
 get diagnostics n=row_count; if n<>1 then raise exception 'Dual EMS/firefighter recipient rejected'; end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 if exists(select 1 from public.trauma_handoffs where id=doc) then raise exception 'Unrelated staff can read'; end if;
 update public.trauma_handoffs set deleted_at=now() where id=doc;
 get diagnostics n=row_count; if n<>0 then raise exception 'Outsider can delete'; end if;
 perform set_config('request.jwt.claim.sub',recipient::text,true);
 begin
   update public.trauma_handoffs set deleted_at=now() where id=doc;
   raise exception 'Non-owner recipient can delete';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 update public.trauma_handoffs set deleted_at=now() where id=doc and version=2;
 get diagnostics n=row_count; if n<>1 then raise exception 'Owner cannot delete after transfer'; end if;
 perform set_config('request.jwt.claim.sub',recipient::text,true);
 begin
   update public.trauma_handoffs set payload='{"bad":true}' where id=doc;
   raise exception 'Deleted dossier can be edited';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',director::text,true);
 if not exists(select 1 from public.trauma_handoffs where id=doc and deleted_at is not null) then raise exception 'Direction cannot see unrelated dossier'; end if;
 update public.trauma_handoffs set deleted_at=null,deleted_by=null where id=doc;
 get diagnostics n=row_count; if n<>1 then raise exception 'Direction cannot restore'; end if;
 update public.trauma_handoffs set deleted_at=now() where id=doc;
 get diagnostics n=row_count; if n<>1 then raise exception 'Direction cannot delete'; end if;
 reset role;
end $$;
select 'PASS: dual EMS roster, owner deletion, direction global access/delete/restore, outsider restrictions and deleted dossier lock' as verification;
rollback;
