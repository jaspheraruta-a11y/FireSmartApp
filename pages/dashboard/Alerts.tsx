import { Flame, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AlertCard from '../../components/AlertCard';
import { resolveIncident, respondToIncident, subscribeToIncidents, subscribeToTruckLocations, TruckLocation } from '../../services/supabase';
import { Incident, IncidentStatus } from '../../types';
import { useAlarm } from '../../hooks/useAlarm';

const Alerts: React.FC = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
    const [truckLocations, setTruckLocations] = useState<TruckLocation[]>([]);
    const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
    const [dispatchIncidentId, setDispatchIncidentId] = useState<string | null>(null);
    const [selectedTruckId, setSelectedTruckId] = useState<string>('');
    const [dispatchError, setDispatchError] = useState<string>('');
    const [isDispatching, setIsDispatching] = useState(false);
    const { isMuted, toggleMute } = useAlarm();
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = subscribeToIncidents(setIncidents);
        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeToTruckLocations(setTruckLocations);
        return () => unsubscribe();
    }, []);

    // Show active and responding incidents, most recent first
    const activeIncidents = useMemo(() => {
        return [...incidents]
            .filter(incident =>
                incident.status === IncidentStatus.ACTIVE ||
                incident.status === IncidentStatus.RESPONDING ||
                (typeof incident.status === 'string' &&
                    (incident.status.toLowerCase() === 'active' ||
                     incident.status.toLowerCase() === 'responding'))
            )
            .sort(
                (a, b) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
    }, [incidents]);

    const handleDispatch = (incidentId: string) => {
        setDispatchError('');
        setDispatchIncidentId(incidentId);
        // Default to first available truck
        const firstTruckId = truckLocations?.[0]?.truck_id ?? '';
        setSelectedTruckId(firstTruckId);
        setDispatchModalOpen(true);
    };

    const confirmDispatch = async () => {
        if (!dispatchIncidentId) return;
        setDispatchError('');

        if (!selectedTruckId) {
            setDispatchError('Please select a unit to dispatch.');
            return;
        }

        try {
            setIsDispatching(true);

            // Optimistically update local state so UI and alarm react instantly
            setIncidents(prev =>
                prev.map(incident =>
                    incident.id === dispatchIncidentId
                        ? { ...incident, status: IncidentStatus.RESPONDING, assignedUnit: selectedTruckId }
                        : incident
                )
            );

            // Persist status change in Supabase
            await respondToIncident(dispatchIncidentId);

            // Go straight to map focusing the incident and routing from the selected unit
            navigate('/dashboard/map', {
                state: { focusIncidentId: dispatchIncidentId, fromTruckId: selectedTruckId },
            });

            setDispatchModalOpen(false);
            setDispatchIncidentId(null);
        } catch (error) {
            console.error('Failed to dispatch unit:', error);
            setDispatchError('Failed to dispatch unit. Please try again.');
        } finally {
            setIsDispatching(false);
        }
    };

    const handleResolve = async (incidentId: string) => {
        try {
            setIsUpdatingId(incidentId);
            await resolveIncident(incidentId);
        } catch (error) {
            console.error('Failed to mark incident as resolved:', error);
        } finally {
            setIsUpdatingId(null);
        }
    };

    const handleViewOnMap = (incident: Incident) => {
        navigate('/dashboard/map', { state: { focusIncidentId: incident.id } });
    };

    const handleToggleMute = () => {
        toggleMute();
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                        <Flame className="h-4 w-4 text-[#ff6600]" />
                        Live Alerts
                    </h1>
                    <p className="text-gray-400 text-sm">
                        Active alerts: <span className="font-bold text-white">{activeIncidents.length}</span>
                        {activeIncidents.length > 0 && (
                            <span className="ml-2 text-red-400 animate-pulse inline-flex items-center gap-1">
                                <Flame className="h-3.5 w-3.5 text-[#ff2244]" />
                                ALERT ACTIVE
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={handleToggleMute}
                    className={`p-3 rounded-lg transition-colors ${
                        isMuted
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                    title={isMuted ? 'Unmute Alarm' : 'Mute Alarm'}
                >
                    {isMuted ? (
                        <VolumeX className="h-6 w-6" />
                    ) : (
                        <Volume2 className="h-6 w-6" />
                    )}
                </button>
            </div>
            {activeIncidents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeIncidents.map(incident => (
                        <AlertCard
                            key={incident.id}
                            incident={incident}
                            onResolve={handleResolve}
                            onDispatch={handleDispatch}
                            onViewOnMap={handleViewOnMap}
                            isResolving={isUpdatingId === incident.id}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-[#2A2A2A] rounded-lg border border-gray-700">
                    <p className="text-gray-400 text-lg">No active alerts at the moment.</p>
                </div>
            )}

            {dispatchModalOpen && (
                <div
                    className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => {
                        if (isDispatching) return;
                        setDispatchModalOpen(false);
                        setDispatchIncidentId(null);
                    }}
                >
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
                    <div
                        className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-[#141414]/95 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-semibold tracking-[0.22em] text-gray-400 uppercase">Dispatch</div>
                                <div className="text-sm font-bold text-white">Select Unit to Dispatch</div>
                            </div>
                            <button
                                type="button"
                                disabled={isDispatching}
                                className="h-9 w-9 inline-flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Close"
                                onClick={() => {
                                    setDispatchModalOpen(false);
                                    setDispatchIncidentId(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="px-5 py-5 space-y-4">
                            <p className="text-sm text-gray-300">
                                Choose which unit to dispatch for this alert.
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Available units
                                </label>
                                <select
                                    value={selectedTruckId}
                                    onChange={(e) => setSelectedTruckId(e.target.value)}
                                    disabled={isDispatching}
                                    className="block w-full px-4 py-2.5 bg-[#1F1F1F] border border-gray-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-[#E53935] transition disabled:opacity-50"
                                >
                                    {truckLocations.length === 0 ? (
                                        <option value="">No units found</option>
                                    ) : (
                                        <>
                                            <option value="" disabled>
                                                Select a unit…
                                            </option>
                                            {truckLocations.map(t => (
                                                <option key={t.truck_id} value={t.truck_id}>
                                                    {t.truck_id} {t.status ? `(${t.status})` : ''}
                                                </option>
                                            ))}
                                        </>
                                    )}
                                </select>
                                {truckLocations.length === 0 && (
                                    <p className="mt-2 text-xs text-gray-500">
                                        Tip: units are loaded from `truck_locations`. If this is empty, check that your truck app is sending GPS updates and your RLS policy allows SELECT.
                                    </p>
                                )}
                            </div>

                            {dispatchError && (
                                <div className="text-sm text-red-300 bg-red-900/40 border border-red-700 rounded-md px-3 py-2">
                                    {dispatchError}
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    disabled={isDispatching}
                                    className="flex-1 bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white font-semibold py-2.5 px-4 rounded-lg border border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => {
                                        setDispatchModalOpen(false);
                                        setDispatchIncidentId(null);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isDispatching || !selectedTruckId}
                                    className="flex-1 bg-[#E53935] hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={confirmDispatch}
                                >
                                    {isDispatching ? 'Dispatching…' : 'Dispatch'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Alerts;
