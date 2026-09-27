-- Quick interventions can be restricted to a grade/sous-grade/affiliation,
-- same eligibility pattern already used by vehicles and prestation_types.
alter table public.intervention_shortcuts add column grade text;
alter table public.intervention_shortcuts add column sous_grade_id text references public.sous_grades(id) on delete set null;
alter table public.intervention_shortcuts add column affiliation_id text references public.affiliations(id) on delete set null;
