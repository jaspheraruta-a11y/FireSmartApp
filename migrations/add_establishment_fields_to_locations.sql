-- Add establishment contact fields to locations table.
-- Run in Supabase Dashboard → SQL Editor.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS photo_url text;
