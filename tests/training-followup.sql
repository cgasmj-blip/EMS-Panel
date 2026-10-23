-- End-to-end permission and workflow test. Messages and fixtures are rolled back.
begin;
do $$
declare trainer uuid; other_trainer uuid; outsider uuid; director uuid; doc uuid; newdoc uuid; test_answers jsonb; initial_messages bigint; directors integer; n integer;
begin
 select s.id into trainer from public.staff s join public.staff_affiliations a on a.staff_id=s.id where s.active and a.affiliation_id='formateur' and s.role not in ('directeur','directeur_adjoint') limit 1;
 select s.id into other_trainer from public.staff s join public.staff_affiliations a on a.staff_id=s.id where s.active and a.affiliation_id='formateur' and s.id<>trainer limit 1;
 select s.id into outsider from public.staff s where s.active and s.id not in (trainer,other_trainer) and s.role not in ('directeur','directeur_adjoint') limit 1;
 select id into director from public.staff where active and role in ('directeur','directeur_adjoint') limit 1;
 if trainer is null or other_trainer is null or outsider is null or director is null then raise exception 'Test identities unavailable'; end if;
 insert into public.training_access(checklist_key,staff_id) values('mu',trainer) on conflict do nothing;
 select jsonb_object_agg(i->>'id','done') into test_answers from public.training_checklists c cross join lateral jsonb_array_elements(c.sections) sec cross join lateral jsonb_array_elements(sec->'items') i where c.key='mu';
 select count(*) into initial_messages from public.internal_messages where sender_id=trainer;
 select count(*) into directors from public.staff where active and role in ('directeur','directeur_adjoint') and id<>trainer;
 perform set_config('request.jwt.claim.sub',trainer::text,true); set local role authenticated;
 insert into public.training_evaluations(checklist_key,first_name,last_name,signature,created_by,updated_by) values('mu','Test','Candidat','Formateur test',trainer,trainer) returning id into doc;
 update public.training_evaluations set status='correction',observations='Revoir la conduite',answers='{"a1":"done"}' where id=doc and version=1;
 if not exists(select 1 from public.training_evaluations where id=doc and status='correction' and closed_at is null) then raise exception 'Correction was closed'; end if;
 begin
  update public.training_evaluations set status='accepted' where id=doc;
  raise exception 'Acceptance with unevaluated points allowed';
 exception when check_violation then null;
 end;
 update public.training_evaluations set status='refused' where id=doc and version=2;
 begin
  update public.training_evaluations set status='in_progress' where id=doc;
  raise exception 'Refused attempt can be reopened';
 exception when insufficient_privilege then null;
 end;
 insert into public.training_evaluations(checklist_key,first_name,last_name,signature,previous_id,created_by,updated_by) values('mu','Test','Candidat','Formateur test',doc,trainer,trainer) returning id into newdoc;
 begin
  update public.training_evaluations set status='accepted',answers=test_answers,critical_incident=true where id=newdoc;
  raise exception 'Eliminatory incident accepted';
 exception when check_violation then null;
 end;
 update public.training_evaluations e set status='accepted',answers=test_answers,signature='Formateur test' where id=newdoc and version=1;
 get diagnostics n=row_count; if n<>1 then raise exception 'Acceptance failed'; end if;
 if (select count(*) from public.internal_messages where sender_id=trainer)<>initial_messages+directors then raise exception 'Direction message missing'; end if;
 begin
  update public.training_evaluations set observations='must not write' where id=newdoc;
  raise exception 'Accepted attempt can be edited / notified twice';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 if exists(select 1 from public.training_evaluations where id=newdoc) then raise exception 'Non-authorized staff sees training'; end if;
 perform set_config('request.jwt.claim.sub',other_trainer::text,true);
 if exists(select 1 from public.training_evaluations where id=newdoc) then raise exception 'Formateur without named grant sees checklist'; end if;
 reset role;
 insert into public.training_access(checklist_key,staff_id) values('mu',other_trainer) on conflict do nothing;
 perform set_config('request.jwt.claim.sub',other_trainer::text,true); set local role authenticated;
 if not exists(select 1 from public.training_evaluations where id=doc) then raise exception 'Named formateur cannot resume dossier'; end if;
 reset role;
end $$;
select 'PASS: draft persistence, correction stays open, refusal immutable/new sheet, acceptance prerequisites, single direction message, named access' as verification;
rollback;
