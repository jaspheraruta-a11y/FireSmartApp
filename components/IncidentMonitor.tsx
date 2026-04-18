import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToIncidents } from '../services/supabase';
import { Incident, IncidentStatus } from '../types';
import { alarmSystem } from '../utils/alarm';
import { useAlarm } from '../hooks/useAlarm';

/**
 * Global incident watcher that:
 * - Plays a loud alarm whenever there are active incidents (unless muted)
 * - Shows browser notifications when new incidents become active
 * - Displays a full-screen emergency modal when there is an active fire
 *
 * Mounted once inside the dashboard layout so it works on any page.
 */
const IncidentMonitor: React.FC = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const previousActiveCountRef = useRef<number>(0);
    const { isMuted } = useAlarm();
    const navigate = useNavigate();
    const [hasDismissedEmergency, setHasDismissedEmergency] = useState(false);

    const activeFireIncidents = incidents.filter(
        incident =>
            incident.status === IncidentStatus.ACTIVE ||
            (typeof incident.status === 'string' && incident.status.toLowerCase() === 'active')
    );

    // Reset dismissal when all active fires are cleared
    useEffect(() => {
        if (activeFireIncidents.length === 0) {
            setHasDismissedEmergency(false);
        }
    }, [activeFireIncidents.length]);

    // Subscribe globally to incidents
    useEffect(() => {
        const unsubscribe = subscribeToIncidents(setIncidents);
        return () => {
            unsubscribe();
            alarmSystem.stopAlarm();
        };
    }, []);

    // Request browser notification permission once
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!('Notification' in window)) return;

        if (Notification.permission === 'default') {
            // Fire and forget – browsers may ignore if not user-initiated
            Notification.requestPermission().catch(() => {
                // Ignore errors
            });
        }
    }, []);

    // Monitor for active incidents -> alarm + web notifications
    useEffect(() => {
        const activeIncidents = incidents.filter(
            incident =>
                incident.status === IncidentStatus.ACTIVE ||
                (typeof incident.status === 'string' &&
                    incident.status.toLowerCase() === 'active')
        );

        const currentActiveCount = activeIncidents.length;
        const previousActiveCount = previousActiveCountRef.current;

        // Handle audio alarm
        if (currentActiveCount > 0 && !isMuted) {
            if (!alarmSystem.getIsPlaying() || currentActiveCount > previousActiveCount) {
                alarmSystem.playAlarm().catch(error => {
                    console.error('Failed to play global alarm:', error);
                });
            }
        } else {
            alarmSystem.stopAlarm();
        }

        // Handle browser notifications when new incidents appear
        const newIncidentsCount = currentActiveCount - previousActiveCount;
        if (newIncidentsCount > 0) {
            if (typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'granted') {
                    const title =
                        newIncidentsCount === 1
                            ? 'New fire incident detected'
                            : `${newIncidentsCount} new fire incidents detected`;

                    const body =
                        currentActiveCount === 1
                            ? 'There is 1 active fire incident that requires attention.'
                            : `There are now ${currentActiveCount} active fire incidents.`;

                    try {
                        const notification = new Notification(title, {
                            body,
                            tag: 'fire-smart-active-incident',
                            renotify: true,
                        });
                        notification.onclick = () => {
                            try {
                                window.focus();
                                // HashRouter friendly - open live map in Nativefier/Electron or browser
                                window.location.hash = '#/dashboard/map';
                            } catch (err) {
                                console.error('Failed to handle notification click:', err);
                            }
                        };
                    } catch (err) {
                        console.error('Failed to show notification:', err);
                    }
                }
            }
        }

        previousActiveCountRef.current = currentActiveCount;
    }, [incidents, isMuted]);

    const handleViewOnMap = () => {
        if (!activeFireIncidents.length) return;
        const targetIncident = activeFireIncidents[0];
        setHasDismissedEmergency(true);
        navigate('/dashboard/map', {
            state: { focusIncidentId: targetIncident.id },
        });
    };

    const showEmergencyModal = activeFireIncidents.length > 0 && !hasDismissedEmergency;

    return (
        <>
            {showEmergencyModal && (
                <div
                    className="fixed inset-0 z-[1200] flex items-center justify-center bg-red-900/70 backdrop-blur-sm p-4"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full max-w-xl rounded-2xl border border-red-400/60 bg-[#1F0000]/90 text-white shadow-[0_0_40px_rgba(239,68,68,0.8)] animate-pulse-slow">
                        <div className="flex items-center justify-between border-b border-red-500/40 px-5 py-3 bg-gradient-to-r from-red-800 via-red-700 to-red-900 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full border border-red-300 bg-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(248,113,113,0.9)] pulse-red-animation">
                                    <span className="text-lg font-black">!</span>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold tracking-[0.28em] text-red-200 uppercase">Emergency Alert</p>
                                    <p className="text-sm font-bold text-white">Active fire detected</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setHasDismissedEmergency(true)}
                                className="rounded-full px-2 py-1 text-xs text-red-100/80 hover:bg-red-900/60 hover:text-white transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>

                        <div className="space-y-3 px-5 py-4">
                            <p className="text-sm text-red-100">
                                There {activeFireIncidents.length === 1 ? 'is' : 'are'}{' '}
                                <span className="font-semibold text-white">{activeFireIncidents.length}</span>{' '}
                                active fire {activeFireIncidents.length === 1 ? 'incident' : 'incidents'} requiring
                                immediate attention.
                            </p>

                            {activeFireIncidents[0] && (
                                <div className="rounded-lg border border-red-500/30 bg-red-950/60 px-4 py-3 text-xs text-red-100">
                                    <p className="font-semibold text-red-100 mb-1">
                                        Priority location:{' '}
                                        <span className="text-white">
                                            {activeFireIncidents[0].locationName ||
                                                activeFireIncidents[0].address ||
                                                'Unknown location'}
                                        </span>
                                    </p>
                                    <p className="text-[11px] text-red-200/90">
                                        Tap "View on map" to center the live map on this incident and coordinate response
                                        immediately.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-red-500/40 bg-[#1A0000]/90 px-5 py-3 rounded-b-2xl">
                            <p className="text-[11px] text-red-200/80">
                                System siren is{' '}
                                <span className="font-semibold">{isMuted ? 'muted' : 'active'}</span>. Check the dashboard
                                header controls to adjust audio.
                            </p>
                            <button
                                type="button"
                                onClick={handleViewOnMap}
                                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-red-500 via-red-400 to-orange-400 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black shadow-[0_0_25px_rgba(248,113,113,0.95)] hover:from-red-400 hover:via-red-300 hover:to-orange-300 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 focus:ring-offset-[#1A0000] transition-transform hover:-translate-y-0.5"
                            >
                                View on map
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default IncidentMonitor;

