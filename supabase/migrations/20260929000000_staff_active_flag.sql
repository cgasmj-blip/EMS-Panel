-- Tracks whether a staff member still holds the E.M.S. gate role on Discord.
-- Set to false (instead of deleting the row) when a login attempt detects the
-- role is gone, so their history (shifts, prestations, payouts) is preserved
-- but they disappear from the active roster (Effectif).
alter table public.staff add column active boolean not null default true;
