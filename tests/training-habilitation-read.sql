begin;
do $$
declare trainer uuid; viewer uuid; outsider uuid; doc uuid; n integer;
begin
 select s.id into trainer from public.staff s join public.staff_affiliations a on a.staff_id=s.id where s.active and a.affiliation_id='formateur' limit 1;
 select s.id into viewer from public.staff s where s.active and s.id<>trainer and s.role not in ('directeur','directeur_adjoint') and not exists(select 1 from public.training_access x where x.staff_id=s.id and x.checklist_key='mu') limit 1;
 select s.id into outsider from public.staff s where s.active and s.id not in (trainer,viewer) and s.role not in ('directeur','directeur_adjoint') and not exists(select 1 from public.staff_sous_grades g where g.staff_id=s.id and g.sous_grade_id='mu') and not exists(select 1 from public.training_access x where x.staff_id=s.id and x.checklist_key='mu') limit 1;
 if trainer is null or viewer is null or outsider is null then raise exception 'Training test identities unavailable'; end if;
 insert into public.training_access(checklist_key,staff_id) values('mu',trainer) on conflict do nothing;
 insert into public.staff_sous_grades(staff_id,sous_grade_id) values(viewer,'mu') on conflict do nothing;
 perform set_config('request.jwt.claim.sub',trainer::text,true); set local role authenticated;
 insert into public.training_evaluations(checklist_key,first_name,last_name,created_by,updated_by) values('mu','Habilitation','Test',trainer,trainer) returning id into doc;
 perform set_config('request.jwt.claim.sub',viewer::text,true);
 if not exists(select 1 from public.training_checklists where key='mu') or not exists(select 1 from public.training_evaluations where id=doc) then raise exception 'MU holder cannot consult shared follow-up'; end if;
 update public.training_evaluations set observations='forbidden' where id=doc;
 get diagnostics n=row_count; if n<>0 then raise exception 'Read-only MU holder can evaluate'; end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 if exists(select 1 from public.training_evaluations where id=doc) then raise exception 'Unrelated staff can view follow-up'; end if;
 reset role;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='trauma_handoffs') then raise exception 'Trauma realtime publication missing'; end if;
end $$;
select 'PASS: shared MU holder read access, evaluations restricted to named trainers, unrelated staff denied, trauma realtime publication active' as verification;
rollback;
