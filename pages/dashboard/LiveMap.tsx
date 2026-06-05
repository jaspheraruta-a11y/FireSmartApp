import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import BfpLogo from '../../components/BfpLogo';
import LiveMapComponent from '../../components/LiveMapComponent';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { subscribeToIncidents, subscribeToTruckLocations, TruckLocation } from '../../services/supabase';
import { Incident, IncidentStatus } from '../../types';

const LiveMap: React.FC = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [truckLocations, setTruckLocations] = useState<TruckLocation[]>([]);
    const location = useLocation();
    const focusIncidentId = (location.state as { focusIncidentId?: string; fromTruckId?: string } | null)?.focusIncidentId ?? null;
    const fromTruckId = (location.state as { focusIncidentId?: string; fromTruckId?: string } | null)?.fromTruckId ?? null;

    useEffect(() => {
        const unsubscribe = subscribeToIncidents(setIncidents);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeToTruckLocations(setTruckLocations);
        return () => unsubscribe();
    }, []);

    const statusStr = (s: unknown) => String(s ?? '').toLowerCase();
    const activeIncidents = incidents.filter(i => statusStr(i?.status) === 'active');
    const respondingIncidents = incidents.filter(i => statusStr(i?.status) === 'responding');
    const resolvedIncidents = incidents.filter(i => statusStr(i?.status) === 'resolved');

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4">
                <BfpLogo size="lg" showText={false} />
                <h1 className="text-3xl font-bold text-white">Live Fire Map</h1>
            </div>
            <div className="flex space-x-6 mb-4 text-white">
                <div className="flex items-center space-x-2"><div className="w-4 h-4 rounded-full bg-red-500 pinpoint-blinker-red"></div><span>Active ({activeIncidents.length})</span></div>
                <div className="flex items-center space-x-2"><div className="w-4 h-4 rounded-full bg-yellow-500"></div><span>Responding ({respondingIncidents.length})</span></div>
                <div className="flex items-center space-x-2"><div className="w-4 h-4 rounded-full bg-green-500"></div><span>Resolved ({resolvedIncidents.length})</span></div>
                {truckLocations.length > 0 && (
                    <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-blue-400" style={{ boxShadow: '0 0 6px #60a5fa' }}></div>
                        <span>Trucks ({truckLocations.length})</span>
                    </div>
                )}
            </div>
            <div className="flex-grow rounded-lg overflow-hidden border border-gray-700 bg-white min-h-[500px]" style={{ minHeight: '500px', height: '60vh' }}>
                <ErrorBoundary>
                    <LiveMapComponent
                        incidents={incidents}
                        focusIncidentId={focusIncidentId}
                        truckLocations={truckLocations}
                        routeOriginTruckId={fromTruckId}
                    />
                </ErrorBoundary>
            </div>
        </div>
    );
};

export default LiveMap;
