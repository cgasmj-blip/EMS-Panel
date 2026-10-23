create table public.training_checklists (
 key text primary key, label text not null, sections jsonb not null check(jsonb_typeof(sections)='array')
);
create table public.training_access (
 checklist_key text not null references public.training_checklists(key),
 staff_id uuid not null references public.staff(id),
 primary key(checklist_key,staff_id)
);
create table public.training_evaluations (
 id uuid primary key default gen_random_uuid(), checklist_key text not null references public.training_checklists(key),
 first_name text not null check(length(trim(first_name)) between 1 and 100),
 last_name text not null check(length(trim(last_name)) between 1 and 100),
 answers jsonb not null default '{}' check(jsonb_typeof(answers)='object'),
 observations text not null default '' check(length(observations)<=12000),
 signature text not null default '' check(length(signature)<=200),
 critical_incident boolean not null default false,
 status text not null default 'in_progress' check(status in ('in_progress','correction','refused','accepted')),
 previous_id uuid references public.training_evaluations(id),
 created_by uuid not null references public.staff(id), updated_by uuid not null references public.staff(id),
 version integer not null default 1, history jsonb not null default '[]',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), closed_at timestamptz
);
create index training_evaluations_checklist_idx on public.training_evaluations(checklist_key,updated_at desc);
alter table public.training_checklists enable row level security;
alter table public.training_access enable row level security;
alter table public.training_evaluations enable row level security;
revoke all on public.training_checklists,public.training_access,public.training_evaluations from public,anon,authenticated;
grant select on public.training_checklists to authenticated;
grant select,insert,delete on public.training_access to authenticated;
grant select,insert,update on public.training_evaluations to authenticated;
create policy training_access_read on public.training_access for select to authenticated
using (staff_id=(select auth.uid()) or exists(select 1 from public.staff where id=(select auth.uid()) and active and role in ('directeur','directeur_adjoint')));
create policy training_access_create on public.training_access for insert to authenticated
with check (exists(select 1 from public.staff where id=(select auth.uid()) and active and role in ('directeur','directeur_adjoint')) and exists(select 1 from public.staff s join public.staff_affiliations a on a.staff_id=s.id where s.id=training_access.staff_id and s.active and a.affiliation_id='formateur'));
create policy training_access_remove on public.training_access for delete to authenticated
using (exists(select 1 from public.staff where id=(select auth.uid()) and active and role in ('directeur','directeur_adjoint')));
create policy training_checklists_read on public.training_checklists for select to authenticated
using (exists(select 1 from public.staff s where s.id=(select auth.uid()) and s.active and (s.role in ('directeur','directeur_adjoint') or (exists(select 1 from public.staff_affiliations a where a.staff_id=s.id and a.affiliation_id='formateur') and exists(select 1 from public.training_access x where x.staff_id=s.id and x.checklist_key=training_checklists.key)))));
create policy training_evaluations_read on public.training_evaluations for select to authenticated
using (exists(select 1 from public.staff s join public.staff_affiliations a on a.staff_id=s.id join public.training_access x on x.staff_id=s.id where s.id=(select auth.uid()) and s.active and a.affiliation_id='formateur' and x.checklist_key=training_evaluations.checklist_key));
create policy training_evaluations_create on public.training_evaluations for insert to authenticated
with check (created_by=(select auth.uid()) and exists(select 1 from public.staff s join public.staff_affiliations a on a.staff_id=s.id join public.training_access x on x.staff_id=s.id where s.id=(select auth.uid()) and s.active and a.affiliation_id='formateur' and x.checklist_key=training_evaluations.checklist_key));
create policy training_evaluations_edit on public.training_evaluations for update to authenticated
using (exists(select 1 from public.staff s join public.staff_affiliations a on a.staff_id=s.id join public.training_access x on x.staff_id=s.id where s.id=(select auth.uid()) and s.active and a.affiliation_id='formateur' and x.checklist_key=training_evaluations.checklist_key))
with check (exists(select 1 from public.staff s join public.staff_affiliations a on a.staff_id=s.id join public.training_access x on x.staff_id=s.id where s.id=(select auth.uid()) and s.active and a.affiliation_id='formateur' and x.checklist_key=training_evaluations.checklist_key));

create function public.guard_training_evaluation() returns trigger language plpgsql security invoker set search_path='' as $$
declare sections jsonb; item_ids text[]; director record;
begin
 select c.sections into sections from public.training_checklists c where c.key=new.checklist_key;
 if sections is null then raise exception 'Checklist inaccessible' using errcode='42501'; end if;
 select array_agg(i->>'id') into item_ids from jsonb_array_elements(sections) sec cross join lateral jsonb_array_elements(sec->'items') i;
 if exists(select 1 from jsonb_each_text(new.answers) a where not(a.key=any(item_ids)) or a.value not in ('done','not_done','not_evaluated')) then raise exception 'Réponses invalides' using errcode='23514'; end if;
 if new.status='accepted' and (new.critical_incident or exists(select 1 from unnest(item_ids) i where coalesce(new.answers->>i,'not_evaluated')<>'done')) then raise exception 'Tous les points doivent être acquis et aucun incident éliminatoire ne doit être déclaré' using errcode='23514'; end if;
 if new.status='correction' and new.critical_incident then raise exception 'Un incident éliminatoire impose un refus de la séance' using errcode='23514'; end if;
 if new.status<>'in_progress' and length(trim(new.signature))=0 then raise exception 'Signature du formateur requise' using errcode='23514'; end if;
 if new.status='correction' and length(trim(new.observations))=0 then raise exception 'Précisez les points à retravailler' using errcode='23514'; end if;
 if tg_op='UPDATE' then
   if old.status in ('accepted','refused') then raise exception 'Tentative clôturée : créez une nouvelle demande après un refus' using errcode='42501'; end if;
   if new.id<>old.id or new.checklist_key<>old.checklist_key or new.created_by<>old.created_by or new.created_at<>old.created_at or new.previous_id is distinct from old.previous_id then raise exception 'Identité de la tentative non modifiable' using errcode='42501'; end if;
   new.version:=old.version+1; new.history:=old.history;
 else
   if new.created_by<>auth.uid() then raise exception 'Auteur invalide' using errcode='42501'; end if;
   if new.previous_id is not null and not exists(select 1 from public.training_evaluations e where e.id=new.previous_id and e.status='refused' and e.checklist_key=new.checklist_key) then raise exception 'La nouvelle demande doit référencer une tentative refusée accessible' using errcode='23514'; end if;
   new.version:=1; new.history:='[]'::jsonb; new.created_at:=now();
 end if;
 new.updated_by:=auth.uid(); new.updated_at:=now(); new.closed_at:=case when new.status in ('accepted','refused') then now() else null end;
 new.history:=new.history || jsonb_build_array(jsonb_build_object('actor',auth.uid(),'status',new.status,'at',now(),'observations',new.observations));
 if new.status='accepted' then
   for director in select s.id from public.staff s where s.active and s.role in ('directeur','directeur_adjoint') and s.id<>auth.uid() loop
     insert into public.internal_messages(sender_id,recipient_id,body) values(auth.uid(),director.id,
       'Formation '||(select label from public.training_checklists where key=new.checklist_key)||' acceptée — '||new.last_name||' '||new.first_name||E'\nMerci d’attribuer le sous-grade correspondant.\nFormateur : '||new.signature||E'\nDossier de suivi : '||new.id::text);
   end loop;
 end if;
 return new;
end $$;
revoke all on function public.guard_training_evaluation() from public,anon,authenticated;
create trigger guard_training_evaluation before insert or update on public.training_evaluations for each row execute function public.guard_training_evaluation();

insert into public.training_checklists(key,label,sections) values('mu','M.U.',$mu$[
  {
    "title": "A. Connaissances et préparation",
    "items": [
      {
        "id": "a1",
        "label": "Identifie et respecte l’exclusion de la face nord du Mont Chiliad."
      },
      {
        "id": "a2",
        "label": "Vérifie l’état général du Caracara."
      },
      {
        "id": "a3",
        "label": "Vérifie la présence du matériel médical."
      },
      {
        "id": "a4",
        "label": "Recueille la localisation et prévoit un accès principal ainsi qu’une solution de repli."
      },
      {
        "id": "a5",
        "label": "Annonce son départ et sa destination."
      }
    ]
  },
  {
    "title": "B. Conduite et lecture du terrain",
    "items": [
      {
        "id": "b1",
        "label": "Adapte sa vitesse au relief et à la visibilité."
      },
      {
        "id": "b2",
        "label": "Conserve une conduite progressive et maîtrisée."
      },
      {
        "id": "b3",
        "label": "Repère les dévers, obstacles et ruptures de pente."
      },
      {
        "id": "b4",
        "label": "Évalue un passage incertain et immobilise le véhicule en sécurité avant une reconnaissance à pied."
      },
      {
        "id": "b5",
        "label": "Réalise les montées et descentes en gardant la maîtrise."
      },
      {
        "id": "b6",
        "label": "Réalise ses manœuvres sans exposer le véhicule à une chute."
      },
      {
        "id": "b7",
        "label": "Préserve une possibilité de retour ou de demi-tour."
      },
      {
        "id": "b8",
        "label": "Renonce à un passage dangereux, l’annonce et propose une autre solution."
      }
    ]
  },
  {
    "title": "C. Intervention seul",
    "items": [
      {
        "id": "c1",
        "label": "Précise qu’il intervient seul, conserve sa radio et transmet sa position en cas de difficulté ou de progression à pied."
      },
      {
        "id": "c2",
        "label": "Prépare le matériel nécessaire avant de s’éloigner du véhicule."
      },
      {
        "id": "c3",
        "label": "Identifie les limites de ses moyens et demande les renforts avant une opération qu’il ne peut pas gérer seul."
      },
      {
        "id": "c4",
        "label": "Choisit un autre accès ou attend un renfort lorsque la situation l’exige."
      }
    ]
  },
  {
    "title": "D. Arrivée et prise en charge",
    "items": [
      {
        "id": "d1",
        "label": "Évalue les dangers avant de rejoindre le patient."
      },
      {
        "id": "d2",
        "label": "Stationne et immobilise le véhicule sur un emplacement stable, loin des ruptures de pente, en préservant l’accès des renforts."
      },
      {
        "id": "d3",
        "label": "Annonce son arrivée et décrit les conditions d’accès."
      },
      {
        "id": "d4",
        "label": "Réalise le bilan et la prise en charge selon les protocoles du service."
      },
      {
        "id": "d5",
        "label": "Transmet le bilan et les besoins supplémentaires à la régulation."
      },
      {
        "id": "d6",
        "label": "Protège le patient des dangers du terrain et des conditions extérieures."
      }
    ]
  },
  {
    "title": "E. Évacuation et gestion des difficultés",
    "items": [
      {
        "id": "e1",
        "label": "Choisit un moyen d’évacuation compatible avec l’état du patient et vérifie que le Caracara permet une installation adaptée."
      },
      {
        "id": "e2",
        "label": "Demande une assistance lorsque le déplacement du patient nécessite plusieurs intervenants."
      },
      {
        "id": "e3",
        "label": "Identifie un point de transfert accessible aux renforts."
      },
      {
        "id": "e4",
        "label": "Face à un véhicule immobilisé, sécurise les lieux et transmet sa position."
      }
    ]
  },
  {
    "title": "F. Fin d’intervention",
    "items": [
      {
        "id": "f1",
        "label": "Annonce la fin d’intervention et son statut à la régulation."
      },
      {
        "id": "f2",
        "label": "Contrôle le véhicule et signale les dommages éventuels."
      },
      {
        "id": "f3",
        "label": "Nettoie, désinfecte et réapprovisionne le matériel utilisé."
      },
      {
        "id": "f4",
        "label": "Effectue un compte rendu des difficultés rencontrées."
      }
    ]
  }
]
$mu$::jsonb);
