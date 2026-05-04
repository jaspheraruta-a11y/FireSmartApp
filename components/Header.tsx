
import React, { useState, useEffect } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { subscribeToIncidents } from '../services/supabase';
import { Incident, IncidentStatus } from '../types';

const Header: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [activeAlerts, setActiveAlerts] = useState(0);
    const [activeAlertsAreFire, setActiveAlertsAreFire] = useState(true);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeToIncidents((incidents: Incident[]) => {
            const activeList = incidents.filter(i => i.status === IncidentStatus.ACTIVE);
            const anyFire = activeList.some(i => i.alertType === 'fire');
            setActiveAlerts(activeList.length);
            setActiveAlertsAreFire(anyFire);

            const sorted = [...incidents].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            setIncidents(sorted);
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleNotificationClick = (incident: Incident) => {
        setIsNotificationsOpen(false);
        navigate('/dashboard/map', {
            state: { focusIncidentId: incident.id },
        });
    };
    
    return (
        <header className="bg-[#2A2A2A] p-4 flex justify-between items-center border-b border-gray-700">
            <div className="flex items-center space-x-4">
                 <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 pulse-green-animation"></div>
                    <span className="text-sm font-medium text-emerald-300">SYSTEM ONLINE</span>
                </div>
            </div>
            <div className="flex items-center space-x-6">
                <div className="relative">
                    <Bell
                        className="h-6 w-6 text-gray-300 hover:text-white cursor-pointer"
                        onClick={() => setIsNotificationsOpen(prev => !prev)}
                        role="button"
                        aria-label="View notifications"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setIsNotificationsOpen(prev => !prev);
                            }
                        }}
                    />
                    {activeAlerts > 0 && (
                        <span
                            className={
                                'absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ' +
                                (activeAlertsAreFire
                                    ? 'bg-[#E53935] pulse-red-animation'
                                    : 'bg-[#CA8A04] pulse-yellow-animation')
                            }
                        >
                            {activeAlerts}
                        </span>
                    )}

                    {isNotificationsOpen && (
                        <div className="absolute right-0 mt-3 w-96 rounded-lg bg-[#1F1F1F] border border-gray-700 shadow-xl z-20">
                            <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                                <span className="text-sm font-semibold text-white">Incident Notifications</span>
                                <span className="text-[11px] text-gray-400">
                                    Showing latest {Math.min(incidents.length, 5)} of {incidents.length}
                                </span>
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {incidents.length === 0 ? (
                                    <div className="px-4 py-3 text-xs text-gray-400">
                                        No incident activity yet.
                                    </div>
                                ) : (
                                    incidents.slice(0, 5).map((incident) => {
                                        const isActive =
                                            incident.status === IncidentStatus.ACTIVE ||
                                            incident.status === IncidentStatus.RESPONDING;
                                        const statusLabel = isActive ? 'Active' : 'Resolved';
                                        const timestamp = new Date(
                                            incident.resolvedAt && !isActive
                                                ? incident.resolvedAt
                                                : incident.timestamp
                                        ).toLocaleString();
                                        const isSmokeActive =
                                            isActive &&
                                            incident.status === IncidentStatus.ACTIVE &&
                                            incident.alertType === 'smoke';
                                        let title: string;
                                        if (!isActive) {
                                            title = `Resolved incident on ${incident.locationName || 'Unknown location'}`;
                                        } else if (isSmokeActive) {
                                            title = `Smoke alert at ${incident.locationName || 'Unknown location'}`;
                                        } else if (incident.status === IncidentStatus.ACTIVE) {
                                            title = `Active fire on ${incident.locationName || 'Unknown location'}`;
                                        } else {
                                            title = `Response in progress at ${incident.locationName || 'Unknown location'}`;
                                        }
                                        const subtitle = incident.address || 'No address on record';

                                        return (
                                            <button
                                                key={incident.id}
                                                type="button"
                                                onClick={() => handleNotificationClick(incident)}
                                                className="w-full text-left px-4 py-3 hover:bg-[#2A2A2A] transition-colors flex space-x-3"
                                            >
                                                <div className="mt-1">
                                                    <span
                                                        className={
                                                            'inline-flex h-2 w-2 rounded-full ' +
                                                            (!isActive
                                                                ? 'bg-emerald-400'
                                                                : isSmokeActive
                                                                  ? 'bg-amber-400'
                                                                  : 'bg-[#E53935]')
                                                        }
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <p className="text-xs font-semibold text-white truncate pr-2">
                                                            {title}
                                                        </p>
                                                        <span
                                                            className={
                                                                'ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ' +
                                                                (isActive
                                                                    ? 'bg-[#3B1B1B] text-[#FF8A80]'
                                                                    : 'bg-[#143322] text-[#A5D6A7]')
                                                            }
                                                        >
                                                            {statusLabel}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-gray-400 truncate">
                                                        {subtitle}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                                        {timestamp}
                                                    </p>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                            <div className="px-4 py-2 border-t border-gray-700 flex items-center justify-between text-[11px] text-gray-400">
                                <button
                                    type="button"
                                    className="hover:text-white transition-colors"
                                    onClick={() => {
                                        setIsNotificationsOpen(false);
                                        navigate('/dashboard/alerts');
                                    }}
                                >
                                    View active alerts
                                </button>
                                <button
                                    type="button"
                                    className="hover:text-white transition-colors"
                                    onClick={() => {
                                        setIsNotificationsOpen(false);
                                        navigate('/dashboard/reports');
                                    }}
                                >
                                    View all reports
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="text-right">
                    <p className="font-semibold text-white text-sm">{user?.fullName}</p>
                    <p className="text-xs text-gray-400 capitalize">{user?.role.replace('_', ' ')}</p>
                </div>
                <button 
                    onClick={handleLogout}
                    className="p-2 rounded-full hover:bg-[#3A3A3A] transition-colors"
                    title="Logout"
                >
                    <LogOut className="h-5 w-5 text-gray-300" />
                </button>
            </div>
        </header>
    );
};

export default Header;
