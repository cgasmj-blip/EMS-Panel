-- Habilitation holders may consult the shared follow-up; named trainers retain write access.
alter policy training_checklists_read on public.training_checklists to authenticated
using (exists(select 1 from public.staff s where s.id=(select auth.uid()) and s.active and (
 s.role in ('directeur','directeur_adjoint')
 or exists(select 1 from public.staff_sous_grades g where g.staff_id=s.id and g.sous_grade_id=training_checklists.key)
 or (exists(select 1 from public.staff_affiliations a where a.staff_id=s.id and a.affiliation_id='formateur') and exists(select 1 from public.training_access x where x.staff_id=s.id and x.checklist_key=training_checklists.key))
)));
alter policy training_evaluations_read on public.training_evaluations to authenticated
using (exists(select 1 from public.staff s where s.id=(select auth.uid()) and s.active and (
 exists(select 1 from public.staff_sous_grades g where g.staff_id=s.id and g.sous_grade_id=training_evaluations.checklist_key)
 or (exists(select 1 from public.staff_affiliations a where a.staff_id=s.id and a.affiliation_id='formateur') and exists(select 1 from public.training_access x where x.staff_id=s.id and x.checklist_key=training_evaluations.checklist_key))
)));
-- Realtime delivery still follows the existing row-level authorization policies.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='trauma_handoffs') then
   alter publication supabase_realtime add table public.trauma_handoffs;
 end if;
end $$;
