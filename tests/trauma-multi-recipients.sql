-- Three active EMS and one active firefighter; every test dossier is rolled back.
begin;
do $$
declare ids uuid[]; firefighter uuid; doc uuid; n integer;
begin
  select s.id into firefighter from public.staff s join public.staff_affiliations a on a.staff_id=s.id where s.active and s.role not in ('directeur','directeur_adjoint','membre') and a.affiliation_id='pompier' order by s.id limit 1;
  select array_agg(id) into ids from (select id from public.staff s where active and s.role not in ('directeur','directeur_adjoint','membre') and s.id<>firefighter order by id limit 3) a;
  if cardinality(ids)<3 or firefighter is null then raise exception 'Three EMS and one firefighter required'; end if;
  perform set_config('request.jwt.claim.sub',firefighter::text,true);
  set local role authenticated;
  insert into public.trauma_handoffs(title,payload,created_by,assigned_to) values('__rollback_multi_test__','{}',firefighter,firefighter) returning id into doc;
  update public.trauma_handoffs set assigned_staff=array[ids[1],ids[2]],status='transferred' where id=doc and version=1;
  get diagnostics n=row_count; if n<>1 then raise exception 'Firefighter cannot transmit to multiple EMS'; end if;
  begin
    update public.trauma_handoffs set title='must not write' where id=doc;
    get diagnostics n=row_count;
    if n<>0 then raise exception 'Sender still has write access'; end if;
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',ids[1]::text,true);
  if not exists(select 1 from public.trauma_handoffs where id=doc and assigned_staff=array[ids[1],ids[2]]) then raise exception 'First EMS cannot read'; end if;
  update public.trauma_handoffs set payload='{"notes":"first EMS edit"}',status='draft' where id=doc and version=2;
  get diagnostics n=row_count; if n<>1 then raise exception 'First EMS cannot edit'; end if;
  perform set_config('request.jwt.claim.sub',ids[2]::text,true);
  if not exists(select 1 from public.trauma_handoffs where id=doc and payload->>'notes'='first EMS edit') then raise exception 'Second EMS cannot read edits'; end if;
  update public.trauma_handoffs set status='completed' where id=doc and version=2;
  get diagnostics n=row_count; if n<>0 then raise exception 'Concurrent stale save overwrites data'; end if;
  update public.trauma_handoffs set status='completed' where id=doc and version=3;
  get diagnostics n=row_count; if n<>1 then raise exception 'Second EMS cannot complete'; end if;
  begin
    update public.trauma_handoffs set assigned_staff=array[gen_random_uuid()],status='transferred' where id=doc;
    raise exception 'Invalid recipient accepted';
  exception when check_violation then null;
  end;
  perform set_config('request.jwt.claim.sub',ids[3]::text,true);
  if exists(select 1 from public.trauma_handoffs where id=doc) then raise exception 'Unselected EMS can read'; end if;
  reset role;
end $$;
select 'PASS: firefighter creates, multiple EMS receive/edit/complete, stale save denied, invalid destination denied, outsider denied' as verification;
rollback;
