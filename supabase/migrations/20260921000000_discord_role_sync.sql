-- Full EMS rank hierarchy (most senior first). New ranks can be appended to
-- this constraint later as they're created on Discord — until then, members
-- holding the base "E.M.S" role but no specific rank fall back to 'membre'.
alter table public.staff drop constraint staff_role_check;
alter table public.staff add constraint staff_role_check check (role in (
  'directeur',
  'directeur_adjoint',
  'directeur_centre',
  'chef_pole',
  'chef_service',
  'chef_chirurgie',
  'chirurgien_expert',
  'chirurgien_vacataire',
  'chirurgien_specialise',
  'chirurgien',
  'medecin_chef',
  'urgentiste',
  'generaliste',
  'resident',
  'interne',
  'externe',
  'infirmier',
  'ambulancier',
  'aide_soignant',
  'membre'
));
alter table public.staff alter column role set default 'membre';

-- Maps Discord role IDs (from the E.M.S. | LJ Life guild) to internal ranks.
-- `is_gate` marks the role that simply grants dashboard access (everyone in
-- the EMS faction has it); `staff_role` is null for that row since it isn't
-- itself a rank. `priority` (lower = more senior) picks the rank to use when
-- a member somehow holds more than one rank role at once.
create table public.discord_role_map (
  role_id text primary key,
  staff_role text
    check (staff_role is null or staff_role in (
      'directeur','directeur_adjoint','directeur_centre','chef_pole','chef_service',
      'chef_chirurgie','chirurgien_expert','chirurgien_vacataire','chirurgien_specialise',
      'chirurgien','medecin_chef','urgentiste','generaliste','resident','interne','externe',
      'infirmier','ambulancier','aide_soignant'
    )),
  is_gate boolean not null default false,
  priority int,
  label text not null
);

alter table public.discord_role_map enable row level security;

-- Every authenticated agent can read the mapping (needed client-side for
-- nothing sensitive — it's just role bookkeeping); only service_role writes.
create policy "staff can view discord role map"
  on public.discord_role_map for select
  to authenticated
  using (true);

insert into public.discord_role_map (role_id, staff_role, is_gate, priority, label) values
  ('1455580954809860107', null, true, null, 'E.M.S'),
  ('1452789820098215946', 'directeur', false, 1, 'Directeur'),
  ('1452789854135124070', 'infirmier', false, 17, 'Infirmier');
