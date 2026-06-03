
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Incident, IncidentAlertType, IncidentStatus, SensorData } from '../types';

// ─── Truck Location Types ─────────────────────────────────────────────────────
export type TruckLocation = {
    id: number;
    truck_id: string;
    latitude: number;
    longitude: number;
    heading: number | null;
    status: string;
    updated_at: string;
};

// IMPORTANT:
// Never expose your service_role / secret key in frontend code.
// Use the PUBLIC anon key from your Supabase project's API settings.
//
// Set these in your env file (for CRA-style apps):
// REACT_APP_SUPABASE_URL=https://....supabase.co
// REACT_APP_SUPABASE_ANON_KEY=your_public_anon_key_here

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export type RegisterDeviceInput = {
    device_uid: string;
    device_type?: string | null;
    status?: string | null;
    location_name: string;
    address: string;
    latitude: number;
    longitude: number;
};

type DeviceInsertRow = {
    id: number;
    device_uid: string;
    device_type: string | null;
    status: string | null;
    last_seen: string | null;
    location_id: number | null;
};

type LocationInsertRow = {
    id: number;
    location_name: string;
    address: string;
};

const isRlsInsertBlocked = (error: any): boolean => {
    const msg = (error?.message ?? '').toString().toLowerCase();
    const code = (error?.code ?? '').toString();
    return (
        code === '42501' ||
        msg.includes('row-level security') ||
        msg.includes('violates row level security') ||
        msg.includes('new row violates row-level security')
    );
};

export const registerDeviceWithLocation = async (
    input: RegisterDeviceInput
): Promise<{ device: DeviceInsertRow; location: LocationInsertRow }> => {
    const {
        device_uid,
        device_type = 'fire_sensor',
        status = 'active',
        location_name,
        address,
        latitude,
        longitude,
    } = input;

    // 1) Create location
    const { data: newLocation, error: locationInsertError } = await supabase
        .from('locations')
        .insert({
            location_name: location_name.trim(),
            address: address.trim(),
            latitude,
            longitude,
        })
        .select('id, location_name, address')
        .single();

    if (locationInsertError || !newLocation) {
        if (isRlsInsertBlocked(locationInsertError)) {
            throw new Error(
                'Database blocked creating locations (Row Level Security). Apply the INSERT policy in `supabase_rls_policies.sql` (Allow insert locations), then try again.'
            );
        }
        throw new Error(locationInsertError?.message ?? 'Failed to create location.');
    }

    // 2) Create device linked to location
    const { data: newDevice, error: deviceInsertError } = await supabase
        .from('devices')
        .insert({
            device_uid: device_uid.trim(),
            device_type,
            status,
            location_id: newLocation.id,
        })
        .select('id, device_uid, device_type, status, last_seen, location_id')
        .single();

    if (deviceInsertError || !newDevice) {
        // Best-effort cleanup to avoid orphaned locations. Ignore cleanup errors (may be blocked by RLS).
        try {
            await supabase.from('locations').delete().eq('id', newLocation.id);
        } catch {
            // ignore
        }

        if ((deviceInsertError as any)?.code === '23505') {
            throw new Error('A device with this UID already exists.');
        }
        if (isRlsInsertBlocked(deviceInsertError)) {
            throw new Error(
                'Database blocked creating devices (Row Level Security). Apply the INSERT policy in `supabase_rls_policies.sql` (Allow insert devices), then try again.'
            );
        }
        throw new Error(deviceInsertError?.message ?? 'Failed to register device.');
    }

    return {
        device: newDevice as DeviceInsertRow,
        location: newLocation as LocationInsertRow,
    };
};

// Test database connection
export const testConnection = async (): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('fire_alerts')
            .select('id')
            .limit(1);
        
        if (error) {
            console.error('Database connection test failed:', error);
            console.error('Error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            return false;
        }
        
        console.log('Database connection test successful');
        return true;
    } catch (err) {
        console.error('Database connection test error:', err);
        return false;
    }
};

// Raw row from fire_alerts (no joins)
type FireAlertRow = {
    id: number;
    device_id: number | null;
    location_id: number | null;
    alert_level: string;
    alert_type: string | null;
    status: string;
    assigned_unit: string | null;
    triggered_at: string;
};

// Fetched separately when joins are not used
type LocationRow = {
    id: number;
    location_name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
};

type DeviceRow = {
    id: number;
    device_uid: string;
};

// Type for sensor readings (we'll fetch separately)
type SensorReadingRow = {
    device_id: number;
    temperature: number | null;
    smoke_level: number | null;
    gas_level: number | null;
    created_at: string;
};

const mapRowToIncident = (
    row: FireAlertRow,
    options?: {
        locationMap?: Map<number, LocationRow>;
        sensorDataMap?: Map<number, SensorData>;
    }
): Incident => {
    const location = options?.locationMap?.get(row.location_id ?? 0);
    const deviceId = row.device_id != null ? String(row.device_id) : '';

    const sensorData: SensorData =
        options?.sensorDataMap?.get(row.device_id ?? 0) ?? {
            temperature: 0,
            smoke: 0,
            gas: 0,
        };

    // Normalize status: DB uses 'active' | 'responding' | 'resolved'
    const rawStatus = (row.status ?? 'active').toString().toLowerCase();
    const status: IncidentStatus =
        rawStatus === 'resolved'
            ? IncidentStatus.RESOLVED
            : rawStatus === 'responding'
              ? IncidentStatus.RESPONDING
              : IncidentStatus.ACTIVE;

    const rawAlertType = (row.alert_type ?? '').toString().toLowerCase().trim();
    const alertType: IncidentAlertType = rawAlertType === 'smoke' ? 'smoke' : 'fire';

    return {
        id: String(row.id),
        deviceId,
        timestamp: row.triggered_at || new Date().toISOString(),
        location: {
            lat: Number(location?.latitude ?? 0),
            lng: Number(location?.longitude ?? 0),
        },
        address: location?.address ?? 'Unknown location',
        locationName: location?.location_name ?? 'Unknown location',
        status,
        alertType,
        sensorData,
        assignedUnit: row.assigned_unit ?? undefined,
        resolvedAt: status === IncidentStatus.RESOLVED ? row.triggered_at : undefined,
    };
};

// Fetch locations by IDs (separate query so RLS on fire_alerts alone is enough to see alerts)
const fetchLocationsByIds = async (locationIds: number[]): Promise<Map<number, LocationRow>> => {
    const map = new Map<number, LocationRow>();
    if (locationIds.length === 0) return map;
    const uniqueIds = [...new Set(locationIds)].filter(Boolean);
    const { data, error } = await supabase
        .from('locations')
        .select('id, location_name, address, latitude, longitude')
        .in('id', uniqueIds);
    if (error) {
        console.warn('Could not fetch locations (RLS?):', error.message);
        return map;
    }
    (data ?? []).forEach((row: LocationRow) => map.set(row.id, row));
    return map;
};

// Helper function to fetch latest sensor readings for devices
const fetchLatestSensorReadings = async (deviceIds: number[]): Promise<Map<number, SensorData>> => {
    const sensorDataMap = new Map<number, SensorData>();
    
    if (deviceIds.length === 0) {
        return sensorDataMap;
    }

    // Fetch latest sensor reading for each device
    const { data: readings, error } = await supabase
        .from('sensor_readings')
        .select('device_id, temperature, smoke_level, gas_level')
        .in('device_id', deviceIds)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching sensor readings:', error);
        return sensorDataMap;
    }

    // Group by device_id and take the latest reading for each device
    const deviceLatestReading = new Map<number, SensorReadingRow>();
    readings?.forEach((reading: any) => {
        const deviceId = reading.device_id;
        if (!deviceLatestReading.has(deviceId)) {
            deviceLatestReading.set(deviceId, reading);
        }
    });

    // Convert to SensorData format
    deviceLatestReading.forEach((reading, deviceId) => {
        sensorDataMap.set(deviceId, {
            temperature: Number(reading.temperature ?? 0),
            smoke: Number(reading.smoke_level ?? 0),
            gas: Number(reading.gas_level ?? 0),
        });
    });

    return sensorDataMap;
};

// Supabase-backed subscription for incidents used by Alerts page
export const subscribeToIncidents = (callback: (incidents: Incident[]) => void) => {
    let currentIncidents: Incident[] = [];
    let pollingInterval: NodeJS.Timeout | null = null;
    let isPolling = false;

    const loadInitial = async () => {
        if (isPolling) return; // Prevent concurrent fetches
        isPolling = true;

        try {
            // Fetch fire_alerts only first (no joins) so Alerts page shows data even if RLS blocks locations/devices
            const { data: alertRows, error } = await supabase
                .from('fire_alerts')
                .select('id, device_id, location_id, alert_level, alert_type, status, assigned_unit, triggered_at')
                .order('triggered_at', { ascending: false });

            if (error) {
                console.error('Error loading incidents from Supabase:', error);
                console.error('Error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                callback([]);
                return;
            }

            if (!alertRows?.length) {
                callback([]);
                return;
            }

            const rows = alertRows as FireAlertRow[];
            const locationIds = rows
                .map(r => r.location_id)
                .filter((id): id is number => id != null);
            const deviceIds = rows
                .map(r => r.device_id)
                .filter((id): id is number => id != null);

            const [locationMap, sensorDataMap] = await Promise.all([
                fetchLocationsByIds(locationIds),
                fetchLatestSensorReadings(deviceIds),
            ]);

            currentIncidents = rows.map(row =>
                mapRowToIncident(row, { locationMap, sensorDataMap })
            );
            callback(currentIncidents);
        } finally {
            isPolling = false;
        }
    };

    // Initial fetch immediately
    void loadInitial();

    // Aggressive polling fallback: Check every 1 second for maximum responsiveness
    pollingInterval = setInterval(() => {
        void loadInitial();
    }, 1000);

    // Realtime updates from Supabase (fire_alerts table) - primary method
    const channel = supabase
        .channel('fire-alerts-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'fire_alerts' },
            async (payload) => {
                // Reload all incidents when there's a change to ensure we have latest data
                await loadInitial();
            }
        )
        .subscribe();

    // Cleanup
    return () => {
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
        supabase.removeChannel(channel);
    };
};

// Mark an incident as responding and optionally record the dispatched unit
export const respondToIncident = async (incidentId: string, assignedUnit?: string) => {
    const update: { status: string; assigned_unit?: string } = {
        status: IncidentStatus.RESPONDING,
    };
    if (assignedUnit) {
        update.assigned_unit = assignedUnit;
    }

    const { error } = await supabase
        .from('fire_alerts')
        .update(update)
        .eq('id', incidentId);

    if (error) {
        console.error('Error updating incident to responding:', error);
        throw error;
    }
};

// Mark an incident as resolved in the fire_alerts table
export const resolveIncident = async (incidentId: string) => {
    const { error } = await supabase
        .from('fire_alerts')
        .update({
            status: IncidentStatus.RESOLVED,
        })
        .eq('id', incidentId);

    if (error) {
        console.error('Error resolving incident:', error);
        throw error;
    }
};

// ─── Truck Location Subscription ─────────────────────────────────────────────
/**
 * Subscribes to real-time updates from the truck_locations table.
 * Calls `callback` with the latest array of truck locations (one per truck_id).
 * Returns a cleanup function to stop polling and unsubscribe.
 *
 * NOTE: If no trucks appear on the map, the most common cause is a missing
 * Supabase RLS SELECT policy. Run in the Supabase SQL editor:
 *   CREATE POLICY "Allow anon select truck_locations" ON public.truck_locations
 *   FOR SELECT TO anon USING (true);
 */
export const subscribeToTruckLocations = (
    callback: (trucks: TruckLocation[]) => void
) => {
    let pollingInterval: NodeJS.Timeout | null = null;
    let isFetching = false;

    const load = async () => {
        if (isFetching) return;
        isFetching = true;
        try {
            const { data, error } = await supabase
                .from('truck_locations')
                .select('id, truck_id, latitude, longitude, heading, status, updated_at')
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('[FireSmart] Error fetching truck_locations:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code,
                });
                console.warn(
                    '[FireSmart] Truck location fetch failed. ' +
                    'Check Supabase RLS: ensure the anon role has SELECT on truck_locations. ' +
                    'Run: CREATE POLICY \'anon select truck_locations\' ON public.truck_locations FOR SELECT TO anon USING (true);'
                );
                callback([]);
                return;
            }

            if (!data?.length) {
                console.warn('[FireSmart] truck_locations table returned 0 rows. Ensure the truck app is running and inserting data.');
                callback([]);
                return;
            }

            // Deduplicate: keep only the most-recent row per truck_id
            // (query is already sorted by updated_at DESC, so first hit wins)
            const seen = new Set<string>();
            const deduplicated = (data as TruckLocation[]).filter(t => {
                if (seen.has(t.truck_id)) return false;
                seen.add(t.truck_id);
                return true;
            });

            console.log(`[FireSmart] Loaded ${deduplicated.length} truck location(s).`, deduplicated);
            callback(deduplicated);
        } finally {
            isFetching = false;
        }
    };

    // Immediate initial load
    void load();

    // Poll every 3 seconds as fallback
    pollingInterval = setInterval(() => void load(), 3000);

    // Primary: Supabase Realtime
    const channel = supabase
        .channel('truck-locations-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'truck_locations' },
            () => void load()
        )
        .subscribe();

    return () => {
        if (pollingInterval) clearInterval(pollingInterval);
        supabase.removeChannel(channel);
    };
};
