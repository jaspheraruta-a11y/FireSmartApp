
import React, { useEffect, useState } from 'react';
import { Smartphone, PlusCircle, Loader2 } from 'lucide-react';
import BfpLogo from '../../components/BfpLogo';
import { registerDeviceWithLocation, supabase } from '../../services/supabase';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/** Detect Electron/Nativefier for map sizing workarounds. */
const isElectron = typeof navigator !== 'undefined' && /Electron|nativefier/i.test(navigator.userAgent);

/** Custom location pin icon (DivIcon) - avoids default Leaflet marker image loading issues in Nativefier/Electron. */
const locationPinIcon = new L.DivIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 24 36" fill="#E53935"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12zm0 17c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg></div>`,
    className: 'bg-transparent border-0',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
});

function MapResizer() {
    const map = useMap();
    useEffect(() => {
        const run = () => map.invalidateSize();
        requestAnimationFrame(run);
        const t1 = setTimeout(run, 50);
        const t2 = setTimeout(run, 200);
        const t3 = setTimeout(run, 500);
        const t4 = setTimeout(run, 1000);
        const t5 = isElectron ? setTimeout(run, 2000) : null;
        const handleResize = () => map.invalidateSize();
        window.addEventListener('resize', handleResize);
        const container = map.getContainer();
        const ro = container ? new ResizeObserver(() => map.invalidateSize()) : null;
        if (ro && container) ro.observe(container);
        return () => {
            [t1, t2, t3, t4].forEach(clearTimeout);
            if (t5) clearTimeout(t5);
            window.removeEventListener('resize', handleResize);
            if (ro && container) ro.unobserve(container);
        };
    }, [map]);
    return null;
}

type DeviceRow = {
    id: number;
    device_uid: string;
    device_type: string | null;
    status: string | null;
    last_seen: string | null;
    location_id: number | null;
};

type LocationRow = {
    id: number;
    location_name: string;
    address: string;
};

type DeviceWithLocation = DeviceRow & {
    location?: LocationRow;
};

type DeviceFormState = {
    device_uid: string;
    custom_device_uid: string;
    device_type: string;
    status: string;
    location_name: string;
    address: string;
    latitude: string;
    longitude: string;
};

type LatLngValue = {
    lat: number;
    lng: number;
} | null;

const VALENCIA_CITY_CENTER: [number, number] = [7.9064, 125.0942];

const LocationPicker: React.FC<{
    value: LatLngValue;
    onChange: (value: LatLngValue) => void;
}> = ({ value, onChange }) => {
    const [position, setPosition] = useState<[number, number] | null>(
        value ? [value.lat, value.lng] : VALENCIA_CITY_CENTER
    );

    const MapClickHandler: React.FC = () => {
        useMapEvents({
            click(e) {
                const next: [number, number] = [e.latlng.lat, e.latlng.lng];
                setPosition(next);
                onChange({ lat: next[0], lng: next[1] });
            },
        });
        return null;
    };

    return (
        <MapContainer
            center={position ?? VALENCIA_CITY_CENTER}
            zoom={14}
            style={{ height: '260px', minHeight: '260px', width: '100%', borderRadius: '0.5rem', overflow: 'hidden' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <MapResizer />
            <MapClickHandler />
            {position && <Marker position={position} icon={locationPinIcon} />}
        </MapContainer>
    );
};

const Devices: React.FC = () => {
    const [devices, setDevices] = useState<DeviceWithLocation[]>([]);
    const [locations, setLocations] = useState<LocationRow[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [showForm, setShowForm] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [pickedLocation, setPickedLocation] = useState<LatLngValue>(null);
    const [isMapMounted, setIsMapMounted] = useState(false);
    const [mapContainerReady, setMapContainerReady] = useState(false);
    const mapWrapperRef = React.useRef<HTMLDivElement>(null);
    const [form, setForm] = useState<DeviceFormState>({
        device_uid: '',
        custom_device_uid: '',
        device_type: 'fire_sensor',
        status: 'active',
        location_name: '',
        address: '',
        latitude: '',
        longitude: '',
    });

    useEffect(() => {
        setIsMapMounted(true);
    }, []);

    // Wait for map wrapper to have dimensions before rendering map (fixes half-map in Nativefier/Electron)
    useEffect(() => {
        if (!showForm || !isMapMounted) {
            setMapContainerReady(false);
            return;
        }
        const el = mapWrapperRef.current;
        if (!el) return;
        const check = () => {
            if (el.offsetHeight > 0 && el.offsetWidth > 0) {
                setMapContainerReady(true);
                return true;
            }
            return false;
        };
        if (check()) return;
        const ro = new ResizeObserver(() => {
            if (check()) ro.disconnect();
        });
        ro.observe(el);
        const t = setTimeout(() => {
            check();
            ro.disconnect();
        }, isElectron ? 600 : 150);
        return () => {
            ro.disconnect();
            clearTimeout(t);
        };
    }, [showForm, isMapMounted]);

    // Auto-fill address when a pin is dropped on the map
    useEffect(() => {
        const fetchAddress = async () => {
            if (!pickedLocation) return;

            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pickedLocation.lat}&lon=${pickedLocation.lng}`
                );

                if (!response.ok) {
                    console.error('Failed to reverse geocode address');
                    return;
                }

                const data: any = await response.json();
                const autoAddress: string | undefined = data?.display_name;

                if (autoAddress) {
                    setForm(prev => ({
                        ...prev,
                        address: autoAddress,
                    }));
                }
            } catch (err) {
                console.error('Error while reverse geocoding address:', err);
            }
        };

        void fetchAddress();
    }, [pickedLocation]);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [{ data: deviceRows, error: deviceError }, { data: locationRows, error: locationError }] =
                await Promise.all([
                    supabase
                        .from('devices')
                        .select('id, device_uid, device_type, status, last_seen, location_id')
                        .order('id', { ascending: true }),
                    supabase
                        .from('locations')
                        .select('id, location_name, address')
                        .order('location_name', { ascending: true }),
                ]);

            if (deviceError) {
                console.error('Error loading devices:', deviceError);
                throw deviceError;
            }

            if (locationError) {
                console.error('Error loading locations:', locationError);
                throw locationError;
            }

            const locationsById = new Map<number, LocationRow>();
            (locationRows ?? []).forEach((loc: any) => {
                locationsById.set(loc.id, loc as LocationRow);
            });

            const withLocation: DeviceWithLocation[] = (deviceRows ?? []).map((d: any) => ({
                ...(d as DeviceRow),
                location: d.location_id ? locationsById.get(d.location_id) : undefined,
            }));

            setDevices(withLocation);
            setLocations((locationRows ?? []) as LocationRow[]);
        } catch (err: any) {
            setError(err?.message ?? 'Failed to load devices. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const handleChange = (field: keyof DeviceFormState, value: string) => {
        setForm(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setSuccessMessage(null);

        const isCustomUid = form.device_uid === '__custom';
        const effectiveDeviceUid = isCustomUid ? form.custom_device_uid.trim() : form.device_uid.trim();

        if (!effectiveDeviceUid) {
            setError('Device UID is required.');
            return;
        }

        if (!form.location_name.trim() || !form.address.trim()) {
            setError('Location name and address are required.');
            return;
        }

        if (!form.latitude || !form.longitude) {
            setError('Please pick a location on the map to capture latitude and longitude.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { device, location } = await registerDeviceWithLocation({
                device_uid: effectiveDeviceUid,
                device_type: form.device_type,
                status: form.status,
                location_name: form.location_name,
                address: form.address,
                latitude: Number(form.latitude),
                longitude: Number(form.longitude),
            });

            setDevices(prev => [
                ...prev,
                {
                    ...(device as any as DeviceRow),
                    location,
                },
            ]);

            setLocations(prev => [...prev, location]);

            setForm({
                device_uid: '',
                custom_device_uid: '',
                device_type: 'fire_sensor',
                status: 'active',
                location_name: '',
                address: '',
                latitude: '',
                longitude: '',
            });
            setPickedLocation(null);

            setSuccessMessage('Device registered successfully.');
        } catch (err: any) {
            console.error('Unexpected error registering device:', err);
            setError(err?.message ?? 'Unexpected error while registering device.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-3">
                        <BfpLogo size="lg" showText={false} />
                        <h1 className="text-3xl font-bold text-white">IoT Device Management</h1>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                        Register new sensor nodes and monitor their status in real-time.
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(prev => !prev)}
                    className="bg-[#E53935] hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                >
                    <PlusCircle className="h-5 w-5" />
                    <span>{showForm ? 'Close Form' : 'Register New Device'}</span>
                </button>
            </div>

            {showForm && (
                <div className="bg-[#2A2A2A] rounded-lg border border-gray-700 p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">Register New Device</h2>

                    {error && (
                        <div className="mb-4 rounded border border-red-500 bg-red-900/30 px-3 py-2 text-sm text-red-200">
                            {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="mb-4 rounded border border-emerald-500 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-200">
                            {successMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Device UID <span className="text-red-400">*</span>
                            </label>
                            <select
                                aria-label="Device UID"
                                value={form.device_uid}
                                onChange={e => handleChange('device_uid', e.target.value)}
                                className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                            >
                                <option value="">Select a device UID</option>
                                <option value="ESP32-001">ESP32-001</option>
                                <option value="ESP32-002">ESP32-002</option>
                                <option value="NODE-ABC123">NODE-ABC123</option>
                                <option value="NODE-XYZ789">NODE-XYZ789</option>
                                <option value="__custom">Custom UID...</option>
                            </select>
                            {form.device_uid === '__custom' && (
                                <input
                                    type="text"
                                    value={form.custom_device_uid}
                                    onChange={e => handleChange('custom_device_uid', e.target.value)}
                                    placeholder="Enter custom device UID"
                                    className="mt-2 w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                                />
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                                This should match the unique identifier programmed into your IoT board.
                            </p>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Location Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.location_name}
                                onChange={e => handleChange('location_name', e.target.value)}
                                placeholder="e.g. Barangay Hall, Building A"
                                className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Address <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.address}
                                onChange={e => handleChange('address', e.target.value)}
                                placeholder="Street, Barangay, City"
                                className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Pin Location on Map <span className="text-red-400">*</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Click on the map to drop a pin where this device is installed. Latitude and longitude
                                will be filled automatically.
                            </p>
                            <div
                                ref={mapWrapperRef}
                                className="w-full rounded-lg overflow-hidden border border-gray-700 bg-black/40 min-h-[260px]"
                            >
                                {mapContainerReady ? (
                                    <LocationPicker
                                        value={pickedLocation}
                                        onChange={value => {
                                            setPickedLocation(value);
                                            if (value) {
                                                handleChange('latitude', String(value.lat));
                                                handleChange('longitude', String(value.lng));
                                            } else {
                                                handleChange('latitude', '');
                                                handleChange('longitude', '');
                                            }
                                        }}
                                    />
                                ) : (
                                    <div className="h-[260px] flex items-center justify-center bg-[#121212] text-gray-500 text-sm">
                                        Loading map...
                                    </div>
                                )}
                            </div>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                        Latitude
                                    </label>
                                    <input
                                        type="text"
                                        value={form.latitude}
                                        readOnly
                                        className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-1.5 text-gray-300 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                        Longitude
                                    </label>
                                    <input
                                        type="text"
                                        value={form.longitude}
                                        readOnly
                                        className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-1.5 text-gray-300 text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-300 mb-1" id="device-type-label">
                                Device Type
                            </label>
                            <select
                                aria-labelledby="device-type-label"
                                value={form.device_type}
                                onChange={e => handleChange('device_type', e.target.value)}
                                className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                            >
                                <option value="fire_sensor">Fire Sensor (Default)</option>
                                <option value="smoke_sensor">Smoke Sensor</option>
                                <option value="multi_sensor">Multi-Sensor Node</option>
                            </select>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-300 mb-1" id="device-status-label">
                                Status
                            </label>
                            <select
                                aria-labelledby="device-status-label"
                                value={form.status}
                                onChange={e => handleChange('status', e.target.value)}
                                className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="maintenance">Maintenance</option>
                            </select>
                        </div>

                        <div className="col-span-1 md:col-span-2 flex justify-end mt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex items-center rounded-md bg-[#E53935] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmitting ? 'Registering...' : 'Register Device'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-[#2A2A2A] rounded-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <Smartphone className="h-8 w-8 text-gray-400" />
                        <div>
                            <h2 className="text-xl font-semibold text-white">Registered Devices</h2>
                            <p className="text-gray-400 text-sm">
                                {isLoading
                                    ? 'Loading devices...'
                                    : devices.length === 0
                                        ? 'No devices registered yet. Add your first device above.'
                                        : `${devices.length} device${devices.length !== 1 ? 's' : ''} connected to Fire Smart.`}
                            </p>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                        <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                        <span>Fetching devices from Supabase...</span>
                    </div>
                ) : devices.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-gray-400">
                            No devices found. Use the <span className="font-semibold text-white">Register New Device</span>{' '}
                            button above to onboard your first IoT node.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left">
                            <thead>
                                <tr className="border-b border-gray-700 text-gray-300">
                                    <th className="py-2 pr-4 font-medium">ID</th>
                                    <th className="py-2 pr-4 font-medium">Device UID</th>
                                    <th className="py-2 pr-4 font-medium">Type</th>
                                    <th className="py-2 pr-4 font-medium">Status</th>
                                    <th className="py-2 pr-4 font-medium">Location</th>
                                    <th className="py-2 pr-4 font-medium">Last Seen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {devices.map(device => (
                                    <tr key={device.id} className="border-b border-gray-800 last:border-0">
                                        <td className="py-2 pr-4 text-gray-400">#{device.id}</td>
                                        <td className="py-2 pr-4 font-mono text-white">{device.device_uid}</td>
                                        <td className="py-2 pr-4 text-gray-300">
                                            {device.device_type ?? 'fire_sensor'}
                                        </td>
                                        <td className="py-2 pr-4">
                                            <span
                                                className={
                                                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ' +
                                                    (device.status === 'active'
                                                        ? 'bg-emerald-900/40 text-emerald-300'
                                                        : device.status === 'maintenance'
                                                            ? 'bg-amber-900/40 text-amber-300'
                                                            : 'bg-gray-800 text-gray-300')
                                                }
                                            >
                                                {device.status ?? 'unknown'}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-4 text-gray-300">
                                            {device.location
                                                ? (
                                                    <>
                                                        <div className="font-medium">{device.location.location_name}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {device.location.address}
                                                        </div>
                                                    </>
                                                  )
                                                : <span className="text-gray-500">Unassigned</span>}
                                        </td>
                                        <td className="py-2 pr-4 text-gray-400">
                                            {device.last_seen
                                                ? new Date(device.last_seen).toLocaleString()
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Devices;
