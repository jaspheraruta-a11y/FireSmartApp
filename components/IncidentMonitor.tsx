import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToIncidents } from '../services/supabase';
import { Incident, IncidentStatus } from '../types';
import { alarmSystem } from '../utils/alarm';
import { useAlarm } from '../hooks/useAlarm';

function isIncidentActive(incident: Incident): boolean {
    return (
        incident.status === IncidentStatus.ACTIVE ||
        (typeof incident.status === 'string' && incident.status.toLowerCase() === 'active')
    );
}

/**
 * Global incident watcher that:
 * - Plays the loud siren only for active **fire** alerts (unless muted)
 * - Shows a yellow full-screen modal for active **smoke** alerts (visual only; no siren)
 * - Shows the existing red emergency modal + siren for active **fire** alerts
 * - Shows browser notifications when new active incidents appear
 *
 * Mounted once inside the dashboard layout so it works on any page.
 */
const IncidentMonitor: React.FC = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const previousFireActiveCountRef = useRef<number>(0);
    const previousSmokeActiveCountRef = useRef<number>(0);
    const { isMuted } = useAlarm();
    const navigate = useNavigate();
    const [hasDismissedFireEmergency, setHasDismissedFireEmergency] = useState(false);
    const [hasDismissedSmokeEmergency, setHasDismissedSmokeEmergency] = useState(false);

    const activeFireIncidents = incidents.filter(i => isIncidentActive(i) && i.alertType === 'fire');
    const activeSmokeIncidents = incidents.filter(i => isIncidentActive(i) && i.alertType === 'smoke');

    useEffect(() => {
        if (activeFireIncidents.length === 0) {
            setHasDismissedFireEmergency(false);
        }
    }, [activeFireIncidents.length]);

    useEffect(() => {
        if (activeSmokeIncidents.length === 0) {
            setHasDismissedSmokeEmergency(false);
        }
    }, [activeSmokeIncidents.length]);

    useEffect(() => {
        const unsubscribe = subscribeToIncidents(setIncidents);
        return () => {
            unsubscribe();
            alarmSystem.stopAlarm();
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!('Notification' in window)) return;

        if (Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {
                // Ignore errors
            });
        }
    }, []);

    useEffect(() => {
        const activeFireCount = activeFireIncidents.length;
        const activeSmokeCount = activeSmokeIncidents.length;
        const prevFire = previousFireActiveCountRef.current;
        const prevSmoke = previousSmokeActiveCountRef.current;

        if (activeFireCount > 0 && !isMuted) {
            if (!alarmSystem.getIsPlaying() || activeFireCount > prevFire) {
                alarmSystem.playAlarm().catch(error => {
                    console.error('Failed to play global alarm:', error);
                });
            }
        } else {
            alarmSystem.stopAlarm();
        }

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
                if (activeFireCount > prevFire) {
                    const n = activeFireCount - prevFire;
                    const title =
                        n === 1 ? 'New fire incident detected' : `${n} new fire incidents detected`;
                    const body =
                        activeFireCount === 1
                            ? 'There is 1 active fire incident that requires immediate attention.'
                            : `There are now ${activeFireCount} active fire incidents.`;
                    const notification = new Notification(title, {
                        body,
                        tag: 'fire-smart-fire',
                        renotify: true,
                    });
                    notification.onclick = () => {
                        try {
                            window.focus();
                            window.location.hash = '#/dashboard/map';
                        } catch (err) {
                            console.error('Failed to handle notification click:', err);
                        }
                    };
                } else if (activeSmokeCount > prevSmoke && activeFireCount === 0) {
                    const n = activeSmokeCount - prevSmoke;
                    const title =
                        n === 1 ? 'Smoke alert detected' : `${n} new smoke alerts detected`;
                    const body =
                        activeSmokeCount === 1
                            ? 'Elevated smoke reported at one location. Verify conditions and watch for escalation to fire.'
                            : `There are now ${activeSmokeCount} active smoke alerts.`;
                    const notification = new Notification(title, {
                        body,
                        tag: 'fire-smart-smoke',
                        renotify: true,
                    });
                    notification.onclick = () => {
                        try {
                            window.focus();
                            window.location.hash = '#/dashboard/map';
                        } catch (err) {
                            console.error('Failed to handle notification click:', err);
                        }
                    };
                }
            } catch (err) {
                console.error('Failed to show notification:', err);
            }
        }

        previousFireActiveCountRef.current = activeFireCount;
        previousSmokeActiveCountRef.current = activeSmokeCount;
    }, [activeFireIncidents.length, activeSmokeIncidents.length, isMuted]);

    const handleViewOnMap = (target: Incident) => {
        if (!target) return;
        if (activeFireIncidents.some(i => i.id === target.id)) {
            setHasDismissedFireEmergency(true);
        } else {
            setHasDismissedSmokeEmergency(true);
        }
        navigate('/dashboard/map', {
            state: { focusIncidentId: target.id },
        });
    };

    const showFireEmergencyModal = activeFireIncidents.length > 0 && !hasDismissedFireEmergency;
    const showSmokeEmergencyModal =
        activeSmokeIncidents.length > 0 &&
        activeFireIncidents.length === 0 &&
        !hasDismissedSmokeEmergency;

    const primaryFire = activeFireIncidents[0];
    const primarySmoke = activeSmokeIncidents[0];

    return (
        <>
            {showFireEmergencyModal && primaryFire && (
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
                                    <p className="text-xs font-semibold tracking-[0.28em] text-red-200 uppercase">
                                        Emergency Alert
                                    </p>
                                    <p className="text-sm font-bold text-white">Active fire detected</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setHasDismissedFireEmergency(true)}
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

                            <div className="rounded-lg border border-red-500/30 bg-red-950/60 px-4 py-3 text-xs text-red-100">
                                <p className="font-semibold text-red-100 mb-1">
                                    Priority location:{' '}
                                    <span className="text-white">
                                        {primaryFire.locationName || primaryFire.address || 'Unknown location'}
                                    </span>
                                </p>
                                <p className="text-[11px] text-red-200/90">
                                    Tap &quot;View on map&quot; to center the live map on this incident and coordinate
                                    response immediately.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-red-500/40 bg-[#1A0000]/90 px-5 py-3 rounded-b-2xl">
                            <p className="text-[11px] text-red-200/80">
                                System siren is{' '}
                                <span className="font-semibold">{isMuted ? 'muted' : 'active'}</span>. Check the
                                dashboard header controls to adjust audio.
                            </p>
                            <button
                                type="button"
                                onClick={() => handleViewOnMap(primaryFire)}
                                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-red-500 via-red-400 to-orange-400 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black shadow-[0_0_25px_rgba(248,113,113,0.95)] hover:from-red-400 hover:via-red-300 hover:to-orange-300 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 focus:ring-offset-[#1A0000] transition-transform hover:-translate-y-0.5"
                            >
                                View on map
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSmokeEmergencyModal && primarySmoke && (
                <div
                    className="fixed inset-0 z-[1200] flex items-center justify-center bg-amber-950/55 backdrop-blur-sm p-4"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full max-w-xl rounded-2xl border border-amber-400/70 bg-[#1c1400]/92 text-white shadow-[0_0_36px_rgba(253,216,53,0.55)]">
                        <div className="flex items-center justify-between border-b border-amber-500/40 px-5 py-3 bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-800 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full border border-amber-200 bg-amber-400 flex items-center justify-center text-amber-950 shadow-[0_0_18px_rgba(253,216,53,0.95)] pulse-yellow-animation">
                                    <span className="text-lg font-black">!</span>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold tracking-[0.28em] text-amber-950/90 uppercase">
                                        Smoke alert
                                    </p>
                                    <p className="text-sm font-bold text-amber-950">Smoke detected</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setHasDismissedSmokeEmergency(true)}
                                className="rounded-full px-2 py-1 text-xs text-amber-950/80 hover:bg-amber-950/15 hover:text-amber-950 transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>

                        <div className="space-y-3 px-5 py-4">
                            <p className="text-sm text-amber-100/95">
                                There {activeSmokeIncidents.length === 1 ? 'is' : 'are'}{' '}
                                <span className="font-semibold text-amber-50">{activeSmokeIncidents.length}</span>{' '}
                                active smoke {activeSmokeIncidents.length === 1 ? 'alert' : 'alerts'}. Investigate the
                                source; the loud siren is reserved for confirmed fire alerts.
                            </p>

                            <div className="rounded-lg border border-amber-500/35 bg-amber-950/50 px-4 py-3 text-xs text-amber-100">
                                <p className="font-semibold text-amber-50 mb-1">
                                    Location:{' '}
                                    <span className="text-white">
                                        {primarySmoke.locationName || primarySmoke.address || 'Unknown location'}
                                    </span>
                                </p>
                                <p className="text-[11px] text-amber-200/90">
                                    Use &quot;View on map&quot; to open the live map on this reading.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-amber-500/35 bg-[#141000]/90 px-5 py-3 rounded-b-2xl">
                            <p className="text-[11px] text-amber-200/85">
                                This is a <span className="font-semibold text-amber-100">visual yellow alarm</span>{' '}
                                only — no automatic siren for smoke.
                            </p>
                            <button
                                type="button"
                                onClick={() => handleViewOnMap(primarySmoke)}
                                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-950 shadow-[0_0_22px_rgba(253,216,53,0.75)] hover:from-amber-300 hover:via-yellow-300 hover:to-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-[#141000] transition-transform hover:-translate-y-0.5"
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
