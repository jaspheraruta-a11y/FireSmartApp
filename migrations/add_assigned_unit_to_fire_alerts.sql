-- Run once in the Supabase SQL editor (or psql) before dispatching units from the Alerts page.
ALTER TABLE public.fire_alerts
ADD COLUMN IF NOT EXISTS assigned_unit text;
