-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.devices (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  location_id bigint,
  device_uid text NOT NULL UNIQUE,
  device_type text DEFAULT 'fire_sensor'::text,
  status text DEFAULT 'active'::text,
  last_seen timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.fire_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id bigint,
  location_id bigint,
  alert_level text NOT NULL CHECK (alert_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])),
  status text DEFAULT 'active'::text,
  triggered_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  alert_type text,
  CONSTRAINT fire_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT fire_alerts_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id),
  CONSTRAINT fire_alerts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.locations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  owner_id uuid,
  location_name text NOT NULL,
  address text NOT NULL,
  latitude numeric,
  longitude numeric,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  role text DEFAULT 'admin'::text CHECK (role = ANY (ARRAY['admin'::text, 'bfp'::text, 'resident'::text])),
  phone text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.responses (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  alert_id bigint,
  responder_id uuid,
  response_time timestamp with time zone,
  remarks text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT responses_pkey PRIMARY KEY (id),
  CONSTRAINT responses_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.fire_alerts(id),
  CONSTRAINT responses_responder_id_fkey FOREIGN KEY (responder_id) REFERENCES auth.users(id)
);
CREATE TABLE public.sensor_readings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  device_id bigint,
  temperature numeric,
  smoke_level numeric,
  gas_level numeric,
  fire_detected boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT sensor_readings_pkey PRIMARY KEY (id),
  CONSTRAINT sensor_readings_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id)
);
CREATE TABLE public.truck_locations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  truck_id text NOT NULL UNIQUE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  heading numeric,
  status text DEFAULT 'on_duty'::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT truck_locations_pkey PRIMARY KEY (id)
);