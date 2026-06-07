-- ============================================================
-- RLS policies for Fire-Smart (run in Supabase SQL Editor)
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Enable RLS on tables (safe to run if already on)
ALTER TABLE public.fire_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

-- 2) Drop existing policies if you want to replace them (optional)
-- Uncomment the next 4 lines to replace policies:
-- DROP POLICY IF EXISTS "Allow read fire_alerts" ON public.fire_alerts;
-- DROP POLICY IF EXISTS "Allow update fire_alerts status" ON public.fire_alerts;
-- DROP POLICY IF EXISTS "Allow read locations" ON public.locations;
-- DROP POLICY IF EXISTS "Allow read devices" ON public.devices;
-- DROP POLICY IF EXISTS "Allow read sensor_readings" ON public.sensor_readings;

-- 3) fire_alerts: allow everyone (anon + authenticated) to read
CREATE POLICY "Allow read fire_alerts"
ON public.fire_alerts
FOR SELECT
TO public
USING (true);

-- 4) fire_alerts: allow update (so app can set status = resolved)
CREATE POLICY "Allow update fire_alerts status"
ON public.fire_alerts
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 5) locations: allow read (so app can show address on alerts)
CREATE POLICY "Allow read locations"
ON public.locations
FOR SELECT
TO public
USING (true);

-- 5b) locations: allow insert (so app can create locations during device registration)
CREATE POLICY "Allow insert locations"
ON public.locations
FOR INSERT
TO public
WITH CHECK (true);

-- 5c) locations: allow update (so app can edit establishment phone, photo, address)
CREATE POLICY "Allow update locations"
ON public.locations
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 6) devices: allow read
CREATE POLICY "Allow read devices"
ON public.devices
FOR SELECT
TO public
USING (true);

-- 6b) devices: allow insert
CREATE POLICY "Allow insert devices"
ON public.devices
FOR INSERT
TO public
WITH CHECK (true);

-- 7) sensor_readings: allow read (so app can show temperature/smoke/gas)
CREATE POLICY "Allow read sensor_readings"
ON public.sensor_readings
FOR SELECT
TO public
USING (true);

-- Done. Your Alerts page should now load rows from fire_alerts.
