# Database Setup Guide

## Fixed Issues

### 1. Database Query Structure
- **Problem**: The code was trying to query fields directly from `fire_alerts` table that don't exist there.
- **Solution**: Updated queries to properly join `fire_alerts` with `locations` and `sensor_readings` tables.

### 2. Data Mapping
- **Problem**: The mapping function expected flat data structure.
- **Solution**: Updated `mapRowToIncident` to handle joined/nested data from Supabase.

### 3. Environment Variables
- **Status**: ✅ Verified - `.env` file contains correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Note**: Vite automatically loads variables prefixed with `VITE_` from `.env` file

## Database Schema Requirements

The following tables and relationships are expected:

1. **fire_alerts** - Main alerts table
   - `id` (bigint, primary key)
   - `device_id` (bigint, foreign key to devices)
   - `location_id` (bigint, foreign key to locations)
   - `alert_level` (text)
   - `status` (text)
   - `triggered_at` (timestamp)

2. **locations** - Establishment / location information
   - `id` (bigint, primary key)
   - `location_name` (text)
   - `address` (text)
   - `phone` (text, optional establishment contact)
   - `photo_url` (text, optional establishment image URL)
   - `latitude` (numeric)
   - `longitude` (numeric)

3. **devices** - Device information
   - `id` (bigint, primary key)
   - `device_uid` (text)

4. **sensor_readings** - Sensor data
   - `device_id` (bigint, foreign key to devices)
   - `temperature` (numeric)
   - `smoke_level` (numeric)
   - `gas_level` (numeric)
   - `created_at` (timestamp)

## Supabase Configuration Required

### 1. Row Level Security (RLS) Policies
Make sure RLS policies allow reading from these tables:
- `fire_alerts` - Should allow SELECT for authenticated/anonymous users
- `locations` - Should allow SELECT (at least for records referenced by fire_alerts)
- `devices` - Should allow SELECT (at least for records referenced by fire_alerts)
- `sensor_readings` - Should allow SELECT (at least for records referenced by devices)

### 2. Foreign Key Relationships
Ensure these foreign keys exist:
- `fire_alerts.location_id` → `locations.id`
- `fire_alerts.device_id` → `devices.id`
- `sensor_readings.device_id` → `devices.id`

### 3. Realtime Subscriptions
Enable Realtime for the `fire_alerts` table in Supabase Dashboard:
1. Go to Database → Replication
2. Enable replication for `fire_alerts` table

## Testing the Connection

The code includes a `testConnection()` function that can be called to verify database connectivity:

```typescript
import { testConnection } from './services/supabase';

// Test connection
testConnection().then(isConnected => {
    console.log('Database connected:', isConnected);
});
```

## Common Issues and Solutions

### Issue: "permission denied for table"
**Solution**: Check RLS policies in Supabase Dashboard → Authentication → Policies

### Issue: "relation does not exist"
**Solution**: Verify table names match exactly (case-sensitive in PostgreSQL)

### Issue: "foreign key relationship not found"
**Solution**: Ensure foreign keys are properly defined in Supabase Dashboard → Database → Relationships

### Issue: Realtime not working
**Solution**: Enable replication for `fire_alerts` table in Supabase Dashboard → Database → Replication

## Environment Variables

Make sure your `.env` file contains:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

These are automatically loaded by Vite when the app starts.
