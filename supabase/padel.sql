-- Eenmalig uitvoeren in de Supabase SQL-editor.
-- Bestaande wedstrijden en poules blijven tennis. Niets wordt verwijderd.
BEGIN;

ALTER TABLE public.tennis_matches
  ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'tennis'
  CHECK (sport IN ('tennis', 'padel'));

ALTER TABLE public.tennis_poules
  ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'tennis'
  CHECK (sport IN ('tennis', 'padel'));

CREATE INDEX IF NOT EXISTS tennis_matches_sport_date_idx
  ON public.tennis_matches (sport, date DESC);
CREATE INDEX IF NOT EXISTS tennis_poules_sport_idx
  ON public.tennis_poules (sport);

COMMIT;

-- Laat Supabase de nieuwe kolommen direct herkennen.
NOTIFY pgrst, 'reload schema';
