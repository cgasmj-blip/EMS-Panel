-- Run with a database administrator in a test environment containing three active staff.
-- Uses existing identities without changing them. Every test row is rolled back.
begin;
do $$
declare ids uuid[]; doc uuid; n integer;
begin
  select array_agg(id) into ids from (select id from public.staff where active and role not in ('directeur','directeur_adjoint') order by id limit 3) a;
  if cardinality(ids)<3 then raise exception 'Three active staff required'; end if;
  perform set_config('request.jwt.claim.sub',ids[1]::text,true);
  set local role authenticated;
  insert into public.trauma_handoffs(title,payload,created_by,assigned_to)
    values('__rollback_handoff_test__','{"zones":[]}',ids[1],ids[1]) returning id into doc;
  update public.trauma_handoffs set assigned_to=ids[2],payload='{"notes":"test"}' where id=doc and version=1;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Transfer failed'; end if;
  begin
    update public.trauma_handoffs set title='must not write' where id=doc;
    get diagnostics n=row_count;
    if n<>0 then raise exception 'Sender still has write access'; end if;
  exception when insufficient_privilege then null;
  end;
  if not exists(select 1 from public.trauma_handoffs where id=doc) then raise exception 'Sender lost read access'; end if;
  perform set_config('request.jwt.claim.sub',ids[3]::text,true);
  if exists(select 1 from public.trauma_handoffs where id=doc) then raise exception 'Unrelated staff can read'; end if;
  perform set_config('request.jwt.claim.sub',ids[2]::text,true);
  if not exists(select 1 from public.trauma_handoffs where id=doc and payload->>'notes'='test' and version=2) then raise exception 'Receiver cannot read payload'; end if;
  update public.trauma_handoffs set status='completed' where id=doc and version=2;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Receiver cannot complete'; end if;
  update public.trauma_handoffs set status='draft' where id=doc and version=2;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Stale version overwrite allowed'; end if;
  begin
    update public.trauma_handoffs set created_by=ids[2] where id=doc;
    raise exception 'Authorship spoofing allowed';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;
select 'PASS: transmission, permissions, resumption, version conflicts and immutable authorship' as verification;
rollback;
