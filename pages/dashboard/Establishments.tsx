
import React, { useEffect, useState } from 'react';
import {
    Building2,
    PlusCircle,
    Loader2,
    ChevronDown,
    ChevronUp,
    Phone,
    MapPin,
    Pencil,
    X,
} from 'lucide-react';
import BfpLogo from '../../components/BfpLogo';
import {
    EstablishmentWithDevices,
    fetchEstablishmentsWithDevices,
    fetchUnassignedDevices,
    registerDeviceToExistingLocation,
    registerDeviceWithLocation,
    updateEstablishment,
} from '../../services/supabase';
import type { DeviceInsertRow } from '../../services/supabase';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const isElectron = typeof navigator !== 'undefined' && /Electron|nativefier/i.test(navigator.userAgent);

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

type LatLngValue = { lat: number; lng: number } | null;

type RegistrationMode = 'new' | 'existing';

type NewEstablishmentFormState = {
    device_uid: string;
    custom_device_uid: string;
    device_type: string;
    status: string;
    location_name: string;
    address: string;
    phone: string;
    photo_url: string;
    latitude: string;
    longitude: string;
};

type ExistingEstablishmentFormState = {
    location_id: string;
    device_uid: string;
    custom_device_uid: string;
    device_type: string;
    status: string;
};

type EditFormState = {
    location_name: string;
    address: string;
    phone: string;
    photo_url: string;
};

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

const EstablishmentPhoto: React.FC<{ photoUrl: string | null; name: string }> = ({ photoUrl, name }) => {
    const [failed, setFailed] = useState(false);

    if (!photoUrl || failed) {
        return (
            <div className="h-24 w-24 flex-shrink-0 rounded-lg bg-[#121212] border border-gray-700 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-gray-500" />
            </div>
        );
    }

    return (
        <img
            src={photoUrl}
            alt={name}
            className="h-24 w-24 flex-shrink-0 rounded-lg object-cover border border-gray-700 bg-[#121212]"
            onError={() => setFailed(true)}
        />
    );
};

const DeviceStatusBadge: React.FC<{ status: string | null }> = ({ status }) => (
    <span
        className={
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ' +
            (status === 'active'
                ? 'bg-emerald-900/40 text-emerald-300'
                : status === 'maintenance'
                    ? 'bg-amber-900/40 text-amber-300'
                    : 'bg-gray-800 text-gray-300')
        }
    >
        {status ?? 'unknown'}
    </span>
);

const DevicesTable: React.FC<{ devices: DeviceInsertRow[] }> = ({ devices }) => {
    if (devices.length === 0) {
        return <p className="text-sm text-gray-500 py-2">No devices installed at this establishment.</p>;
    }

    return (
        <div className="overflow-x-auto mt-3">
            <table className="min-w-full text-sm text-left">
                <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                        <th className="py-2 pr-4 font-medium">ID</th>
                        <th className="py-2 pr-4 font-medium">Device UID</th>
                        <th className="py-2 pr-4 font-medium">Type</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Last Seen</th>
                    </tr>
                </thead>
                <tbody>
                    {devices.map(device => (
                        <tr key={device.id} className="border-b border-gray-800 last:border-0">
                            <td className="py-2 pr-4 text-gray-400">#{device.id}</td>
                            <td className="py-2 pr-4 font-mono text-white">{device.device_uid}</td>
                            <td className="py-2 pr-4 text-gray-300">{device.device_type ?? 'fire_sensor'}</td>
                            <td className="py-2 pr-4">
                                <DeviceStatusBadge status={device.status} />
                            </td>
                            <td className="py-2 pr-4 text-gray-400">
                                {device.last_seen ? new Date(device.last_seen).toLocaleString() : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const Establishments: React.FC = () => {
    const [establishments, setEstablishments] = useState<EstablishmentWithDevices[]>([]);
    const [unassignedDevices, setUnassignedDevices] = useState<DeviceInsertRow[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('new');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [pickedLocation, setPickedLocation] = useState<LatLngValue>(null);
    const [isMapMounted, setIsMapMounted] = useState(false);
    const [mapContainerReady, setMapContainerReady] = useState(false);
    const mapWrapperRef = React.useRef<HTMLDivElement>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<EditFormState>({
        location_name: '',
        address: '',
        phone: '',
        photo_url: '',
    });
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const [newForm, setNewForm] = useState<NewEstablishmentFormState>({
        device_uid: '',
        custom_device_uid: '',
        device_type: 'fire_sensor',
        status: 'active',
        location_name: '',
        address: '',
        phone: '',
        photo_url: '',
        latitude: '',
        longitude: '',
    });

    const [existingForm, setExistingForm] = useState<ExistingEstablishmentFormState>({
        location_id: '',
        device_uid: '',
        custom_device_uid: '',
        device_type: 'fire_sensor',
        status: 'active',
    });

    useEffect(() => {
        setIsMapMounted(true);
    }, []);

    useEffect(() => {
        if (!showForm || !isMapMounted || registrationMode !== 'new') {
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
    }, [showForm, isMapMounted, registrationMode]);

    useEffect(() => {
        const fetchAddress = async () => {
            if (!pickedLocation) return;
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pickedLocation.lat}&lon=${pickedLocation.lng}`
                );
                if (!response.ok) return;
                const data: any = await response.json();
                const autoAddress: string | undefined = data?.display_name;
                if (autoAddress) {
                    setNewForm(prev => ({ ...prev, address: autoAddress }));
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
            const [establishmentRows, unassignedRows] = await Promise.all([
                fetchEstablishmentsWithDevices(),
                fetchUnassignedDevices(),
            ]);
            setEstablishments(establishmentRows);
            setUnassignedDevices(unassignedRows);
        } catch (err: any) {
            setError(err?.message ?? 'Failed to load establishments. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const toggleExpanded = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const resolveDeviceUid = (deviceUid: string, customUid: string): string | null => {
        const isCustom = deviceUid === '__custom';
        const effective = isCustom ? customUid.trim() : deviceUid.trim();
        return effective || null;
    };

    const handleNewFormChange = (field: keyof NewEstablishmentFormState, value: string) => {
        setNewForm(prev => ({ ...prev, [field]: value }));
    };

    const handleExistingFormChange = (field: keyof ExistingEstablishmentFormState, value: string) => {
        setExistingForm(prev => ({ ...prev, [field]: value }));
    };

    const resetForms = () => {
        setNewForm({
            device_uid: '',
            custom_device_uid: '',
            device_type: 'fire_sensor',
            status: 'active',
            location_name: '',
            address: '',
            phone: '',
            photo_url: '',
            latitude: '',
            longitude: '',
        });
        setExistingForm({
            location_id: '',
            device_uid: '',
            custom_device_uid: '',
            device_type: 'fire_sensor',
            status: 'active',
        });
        setPickedLocation(null);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsSubmitting(true);

        try {
            if (registrationMode === 'new') {
                const effectiveDeviceUid = resolveDeviceUid(newForm.device_uid, newForm.custom_device_uid);
                if (!effectiveDeviceUid) {
                    setError('Device UID is required.');
                    return;
                }
                if (!newForm.location_name.trim() || !newForm.address.trim()) {
                    setError('Establishment name and address are required.');
                    return;
                }
                if (!newForm.latitude || !newForm.longitude) {
                    setError('Please pick a location on the map to capture latitude and longitude.');
                    return;
                }

                await registerDeviceWithLocation({
                    device_uid: effectiveDeviceUid,
                    device_type: newForm.device_type,
                    status: newForm.status,
                    location_name: newForm.location_name,
                    address: newForm.address,
                    latitude: Number(newForm.latitude),
                    longitude: Number(newForm.longitude),
                    phone: newForm.phone || null,
                    photo_url: newForm.photo_url || null,
                });
                setSuccessMessage('Establishment and device registered successfully.');
            } else {
                const effectiveDeviceUid = resolveDeviceUid(
                    existingForm.device_uid,
                    existingForm.custom_device_uid
                );
                if (!existingForm.location_id) {
                    setError('Please select an establishment.');
                    return;
                }
                if (!effectiveDeviceUid) {
                    setError('Device UID is required.');
                    return;
                }

                await registerDeviceToExistingLocation(Number(existingForm.location_id), {
                    device_uid: effectiveDeviceUid,
                    device_type: existingForm.device_type,
                    status: existingForm.status,
                });
                setSuccessMessage('Device added to establishment successfully.');
            }

            resetForms();
            await loadData();
        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err?.message ?? 'Unexpected error while registering.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEdit = (establishment: EstablishmentWithDevices) => {
        setEditingId(establishment.id);
        setEditForm({
            location_name: establishment.location_name,
            address: establishment.address,
            phone: establishment.phone ?? '',
            photo_url: establishment.photo_url ?? '',
        });
        setError(null);
    };

    const closeEdit = () => {
        setEditingId(null);
    };

    const handleSaveEdit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (editingId === null) return;

        setIsSavingEdit(true);
        setError(null);
        try {
            await updateEstablishment(editingId, {
                location_name: editForm.location_name,
                address: editForm.address,
                phone: editForm.phone || null,
                photo_url: editForm.photo_url || null,
            });
            setSuccessMessage('Establishment updated successfully.');
            closeEdit();
            await loadData();
        } catch (err: any) {
            setError(err?.message ?? 'Failed to update establishment.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const totalDevices = establishments.reduce((sum, e) => sum + e.devices.length, 0) + unassignedDevices.length;

    const deviceUidFields = (
        deviceUid: string,
        customUid: string,
        onDeviceUidChange: (v: string) => void,
        onCustomChange: (v: string) => void
    ) => (
        <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">
                Device UID <span className="text-red-400">*</span>
            </label>
            <select
                aria-label="Device UID"
                value={deviceUid}
                onChange={e => onDeviceUidChange(e.target.value)}
                className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
            >
                <option value="">Select a device UID</option>
                <option value="ESP32-001">ESP32-001</option>
                <option value="ESP32-002">ESP32-002</option>
                <option value="NODE-ABC123">NODE-ABC123</option>
                <option value="NODE-XYZ789">NODE-XYZ789</option>
                <option value="__custom">Custom UID...</option>
            </select>
            {deviceUid === '__custom' && (
                <input
                    type="text"
                    value={customUid}
                    onChange={e => onCustomChange(e.target.value)}
                    placeholder="Enter custom device UID"
                    className="mt-2 w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                />
            )}
        </div>
    );

    const deviceTypeStatusFields = (
        deviceType: string,
        status: string,
        onTypeChange: (v: string) => void,
        onStatusChange: (v: string) => void
    ) => (
        <>
            <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-300 mb-1" id="device-type-label">
                    Device Type
                </label>
                <select
                    aria-labelledby="device-type-label"
                    value={deviceType}
                    onChange={e => onTypeChange(e.target.value)}
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
                    value={status}
                    onChange={e => onStatusChange(e.target.value)}
                    className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                </select>
            </div>
        </>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-3">
                        <BfpLogo size="lg" showText={false} />
                        <h1 className="text-3xl font-bold text-white">Establishment Management</h1>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                        Monitor establishments and their installed IoT devices.
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(prev => !prev)}
                    className="bg-[#E53935] hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                >
                    <PlusCircle className="h-5 w-5" />
                    <span>{showForm ? 'Close Form' : 'Register Establishment / Device'}</span>
                </button>
            </div>

            {showForm && (
                <div className="bg-[#2A2A2A] rounded-lg border border-gray-700 p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">Register Establishment / Device</h2>

                    <div className="flex gap-2 mb-4">
                        <button
                            type="button"
                            onClick={() => setRegistrationMode('new')}
                            className={
                                'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
                                (registrationMode === 'new'
                                    ? 'bg-[#E53935] text-white'
                                    : 'bg-[#121212] text-gray-300 border border-gray-700 hover:text-white')
                            }
                        >
                            New establishment + device
                        </button>
                        <button
                            type="button"
                            onClick={() => setRegistrationMode('existing')}
                            className={
                                'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
                                (registrationMode === 'existing'
                                    ? 'bg-[#E53935] text-white'
                                    : 'bg-[#121212] text-gray-300 border border-gray-700 hover:text-white')
                            }
                        >
                            Add device to existing
                        </button>
                    </div>

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
                        {registrationMode === 'existing' ? (
                            <>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Establishment <span className="text-red-400">*</span>
                                    </label>
                                    <select
                                        aria-label="Establishment"
                                        value={existingForm.location_id}
                                        onChange={e => handleExistingFormChange('location_id', e.target.value)}
                                        className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                                    >
                                        <option value="">Select an establishment</option>
                                        {establishments.map(est => (
                                            <option key={est.id} value={est.id}>
                                                {est.location_name} — {est.address}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {deviceUidFields(
                                    existingForm.device_uid,
                                    existingForm.custom_device_uid,
                                    v => handleExistingFormChange('device_uid', v),
                                    v => handleExistingFormChange('custom_device_uid', v)
                                )}
                                {deviceTypeStatusFields(
                                    existingForm.device_type,
                                    existingForm.status,
                                    v => handleExistingFormChange('device_type', v),
                                    v => handleExistingFormChange('status', v)
                                )}
                            </>
                        ) : (
                            <>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Establishment Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newForm.location_name}
                                        onChange={e => handleNewFormChange('location_name', e.target.value)}
                                        placeholder="e.g. Barangay Hall, Building A"
                                        className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={newForm.phone}
                                        onChange={e => handleNewFormChange('phone', e.target.value)}
                                        placeholder="e.g. 0917 123 4567"
                                        className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Address <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newForm.address}
                                        onChange={e => handleNewFormChange('address', e.target.value)}
                                        placeholder="Street, Barangay, City"
                                        className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Photo URL
                                    </label>
                                    <input
                                        type="url"
                                        value={newForm.photo_url}
                                        onChange={e => handleNewFormChange('photo_url', e.target.value)}
                                        placeholder="https://example.com/photo.jpg"
                                        className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Pin Location on Map <span className="text-red-400">*</span>
                                    </label>
                                    <p className="text-xs text-gray-500 mb-2">
                                        Click on the map to drop a pin where this establishment is located.
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
                                                        handleNewFormChange('latitude', String(value.lat));
                                                        handleNewFormChange('longitude', String(value.lng));
                                                    } else {
                                                        handleNewFormChange('latitude', '');
                                                        handleNewFormChange('longitude', '');
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div className="h-[260px] flex items-center justify-center bg-[#121212] text-gray-500 text-sm">
                                                Loading map...
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {deviceUidFields(
                                    newForm.device_uid,
                                    newForm.custom_device_uid,
                                    v => handleNewFormChange('device_uid', v),
                                    v => handleNewFormChange('custom_device_uid', v)
                                )}
                                {deviceTypeStatusFields(
                                    newForm.device_type,
                                    newForm.status,
                                    v => handleNewFormChange('device_type', v),
                                    v => handleNewFormChange('status', v)
                                )}
                            </>
                        )}

                        <div className="col-span-1 md:col-span-2 flex justify-end mt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex items-center rounded-md bg-[#E53935] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                            >
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isSubmitting ? 'Registering...' : 'Register'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-[#2A2A2A] rounded-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <Building2 className="h-8 w-8 text-gray-400" />
                        <div>
                            <h2 className="text-xl font-semibold text-white">Registered Establishments</h2>
                            <p className="text-gray-400 text-sm">
                                {isLoading
                                    ? 'Loading establishments...'
                                    : establishments.length === 0
                                        ? 'No establishments registered yet.'
                                        : `${establishments.length} establishment${establishments.length !== 1 ? 's' : ''} · ${totalDevices} device${totalDevices !== 1 ? 's' : ''} total`}
                            </p>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                        <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                        <span>Fetching establishments from Supabase...</span>
                    </div>
                ) : establishments.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-gray-400">
                            No establishments found. Use{' '}
                            <span className="font-semibold text-white">Register Establishment / Device</span> above to
                            onboard your first site.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {establishments.map(establishment => {
                            const activeCount = establishment.devices.filter(d => d.status === 'active').length;
                            const isExpanded = expandedIds.has(establishment.id);

                            return (
                                <div
                                    key={establishment.id}
                                    className="rounded-lg border border-gray-700 bg-[#1E1E1E] overflow-hidden"
                                >
                                    <div className="p-4 flex flex-col sm:flex-row gap-4">
                                        <EstablishmentPhoto
                                            photoUrl={establishment.photo_url}
                                            name={establishment.location_name}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h3 className="text-lg font-semibold text-white">
                                                        {establishment.location_name}
                                                    </h3>
                                                    <div className="flex items-start gap-1.5 mt-1 text-sm text-gray-400">
                                                        <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                                        <span>{establishment.address}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-400">
                                                        <Phone className="h-4 w-4 flex-shrink-0" />
                                                        <span>{establishment.phone || '—'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(establishment)}
                                                        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
                                                        aria-label="Edit establishment"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleExpanded(establishment.id)}
                                                        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors"
                                                        aria-label={isExpanded ? 'Collapse devices' : 'Expand devices'}
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronUp className="h-5 w-5" />
                                                        ) : (
                                                            <ChevronDown className="h-5 w-5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="mt-2 text-sm text-gray-300">
                                                <span className="font-medium text-white">
                                                    {establishment.devices.length}
                                                </span>{' '}
                                                device{establishment.devices.length !== 1 ? 's' : ''} installed
                                                {establishment.devices.length > 0 && (
                                                    <span className="text-gray-500">
                                                        {' '}
                                                        · {activeCount} active
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="px-4 pb-4 border-t border-gray-700 pt-3">
                                            <h4 className="text-sm font-medium text-gray-300 mb-1">Installed Devices</h4>
                                            <DevicesTable devices={establishment.devices} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {!isLoading && unassignedDevices.length > 0 && (
                <div className="bg-[#2A2A2A] rounded-lg border border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-2">Unassigned Devices</h2>
                    <p className="text-gray-400 text-sm mb-4">
                        These devices are not linked to any establishment.
                    </p>
                    <DevicesTable devices={unassignedDevices} />
                </div>
            )}

            {editingId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-[#2A2A2A] rounded-lg border border-gray-700 p-6 w-full max-w-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Edit Establishment</h3>
                            <button
                                type="button"
                                onClick={closeEdit}
                                className="p-1 text-gray-400 hover:text-white"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editForm.location_name}
                                    onChange={e => setEditForm(prev => ({ ...prev, location_name: e.target.value }))}
                                    className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                                <input
                                    type="text"
                                    value={editForm.address}
                                    onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                    className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={editForm.phone}
                                    onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                    className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Photo URL</label>
                                <input
                                    type="url"
                                    value={editForm.photo_url}
                                    onChange={e => setEditForm(prev => ({ ...prev, photo_url: e.target.value }))}
                                    className="w-full rounded-md bg-[#121212] border border-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeEdit}
                                    className="px-4 py-2 rounded-lg text-sm text-gray-300 border border-gray-700 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEdit}
                                    className="inline-flex items-center rounded-md bg-[#E53935] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                    {isSavingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Establishments;
