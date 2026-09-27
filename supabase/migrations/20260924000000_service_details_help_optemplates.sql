-- Extra "prise de service" fields seen on reference tools: vehicle, free-text
-- comment (status/intervention code), defibrillator usage.
alter table public.units add column vehicule text;
alter table public.units add column commentaire text;
alter table public.units add column defibrillateur boolean not null default false;

alter table public.shifts add column vehicule text;
alter table public.shifts add column commentaire text;
alter table public.shifts add column defibrillateur boolean not null default false;

-- Op templates for the Dossier médical tab, now admin-editable instead of
-- hardcoded (exact injury list to be confirmed later; seeded with a
-- reasonable starting set that Direction can rename/replace/extend).
create table public.op_templates (
  id text primary key,
  label text not null,
  motif text not null,
  procede text not null,
  prescription text not null,
  created_at timestamptz not null default now()
);

insert into public.op_templates (id, label, motif, procede, prescription) values
  ('fusillade_retrait_balle', 'Fusillade · Retrait de balle', 'Plaie par arme à feu',
   'Désinfection de la zone, exploration de la plaie, extraction du(des) projectile(s), hémostase, lavage à la solution saline, suture des tissus par plans, pansement compressif.',
   'Antalgique (Morphine 30mg), antibiothérapie large spectre, contrôle du pansement sous 48h.'),
  ('fracture_immobilisation', 'Fracture · Immobilisation', 'Traumatisme avec suspicion de fracture',
   'Examen clinique, réduction si déplacement, immobilisation par attelle/plâtre, contrôle de la sensibilité et de la mobilité distale.',
   'Antalgique (Percocet 5mg), repos et immobilisation stricte, contrôle à 3 semaines.'),
  ('plaie_arme_blanche', 'Plaie par arme blanche', 'Plaie pénétrante par arme blanche',
   'Désinfection, exploration de la profondeur de plaie, vérification de l''absence de lésion vasculaire/organe, suture par plans, pansement.',
   'Antalgique standard, antibiothérapie, vaccination antitétanique à vérifier.'),
  ('polytraumatisme', 'Accident de la route · Polytraumatisme', 'Polytraumatisme suite à accident de la route',
   'Bilan lésionnel complet, immobilisation cervicale, pose de voie veineuse, remplissage vasculaire, prise en charge des lésions par ordre de priorité vitale.',
   'Antalgique majeur (Morphine 30mg), surveillance constante, examens complémentaires si disponibles.'),
  ('overdose', 'Overdose / Intoxication', 'Suspicion de surdosage médicamenteux ou intoxication',
   'Mise en sécurité des voies aériennes, surveillance des constantes, pose de voie veineuse, administration d''antidote si identifié, lavage gastrique si indiqué.',
   'Surveillance rapprochée, réévaluation à 1h, orientation vers suivi si récidive.'),
  ('arret_cardiaque', 'Arrêt cardio-respiratoire', 'Arrêt cardio-respiratoire',
   'Réanimation cardio-pulmonaire, défibrillation si rythme choquable, intubation, administration d''adrénaline selon protocole, surveillance post-réanimation.',
   'Surveillance continue en observation, bilan cardiaque complet dès que possible.'),
  ('brulure', 'Brûlure', 'Brûlure thermique ou chimique',
   'Refroidissement de la zone, évaluation de la surface et du degré, nettoyage, application de crème pour brûlures, pansement stérile non adhérent.',
   'Antalgique, crème pour brûlures à renouveler quotidiennement, contrôle sous 48h.');

alter table public.op_templates enable row level security;

create policy "staff can view op templates"
  on public.op_templates for select to authenticated using (true);
create policy "direction can manage op templates"
  on public.op_templates for all to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

alter publication supabase_realtime add table public.op_templates;

-- Help / guide page: Direction posts articles (title + optional image URL +
-- text) that everyone can read; images are external URLs the user pastes in
-- (Discord CDN, imgur, etc.) rather than an upload pipeline.
create table public.help_articles (
  id bigint generated always as identity primary key,
  title text not null,
  image_url text,
  content text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.help_articles enable row level security;

create policy "staff can view help articles"
  on public.help_articles for select to authenticated using (true);
create policy "direction can manage help articles"
  on public.help_articles for all to authenticated
  using (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')))
  with check (exists (select 1 from public.staff s where s.id = auth.uid() and s.role in ('directeur', 'directeur_adjoint', 'directeur_centre')));

alter publication supabase_realtime add table public.help_articles;
