-- Local ownership cleanup and EMS terminology/rules.
-- The Discord guild remains the same, but role mappings should only contain
-- role IDs that belong to this EMS server and have been explicitly verified.

-- Habilitations/branches are independent, not hierarchical.
delete from public.staff_sous_grades;
delete from public.sous_grades where id in ('du','logistique');

insert into public.sous_grades (id,label,position) values
  ('mu','M.U.',1),
  ('msu','M.S.U.',2),
  ('fu','F.U.',3),
  ('cgu','C.G.U.',4),
  ('dwu','D.W.U.',5),
  ('au','A.U.',6),
  ('pu','P.U.',7),
  ('tbu','T.B.U.',8)
on conflict (id) do update set label=excluded.label, position=excluded.position;

-- PSU/CAPPA require AU; CAS requires PU.
-- Pompier/Recruteur/Formateur/Logistique are global affiliations.
insert into public.affiliations (id,label,sous_grade_id,position) values
  ('psu','P.S.U.','au',1),
  ('cappa','C.A.P.P.A.','au',2),
  ('cas','C.A.S.','pu',3),
  ('pompier','Pompier',null,4),
  ('recruteur','Recruteur',null,5),
  ('formateur','Formateur',null,6),
  ('logistique','Logistique',null,7)
on conflict (id) do update
set label=excluded.label, sous_grade_id=excluded.sous_grade_id, position=excluded.position;

comment on table public.sous_grades is
'Independent EMS hospital habilitations/branches (not a hierarchy): MU, MSU, FU, CGU, DWU, AU, PU, TBU.';
comment on column public.affiliations.sous_grade_id is
'Optional required habilitation. PSU/CAPPA require AU; CAS requires PU; null means global affiliation.';

-- Trigger-only SECURITY DEFINER functions should not be directly callable via RPC.
revoke execute on function public.apply_stock_movement() from public, anon, authenticated;
revoke execute on function public.handle_new_ems_user() from public, anon, authenticated;
revoke execute on function public.staff_guard_role() from public, anon, authenticated;
