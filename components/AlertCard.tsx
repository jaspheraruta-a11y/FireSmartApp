
import { Flame, Map, MapPin, Thermometer } from 'lucide-react';
import React from 'react';
import { Incident, IncidentStatus } from '../types';

interface AlertCardProps {
    incident: Incident;
    onResolve?: (incidentId: string) => void;
    onDispatch?: (incidentId: string) => void;
    onViewOnMap?: (incident: Incident) => void;
    isResolving?: boolean;
}

const statusStyles = {
    [IncidentStatus.ACTIVE]: {
        borderColor: 'border-red-500',
        glowClass: 'glow-red',
        bgColor: 'bg-red-900/30'
    },
    [IncidentStatus.RESPONDING]: {
        borderColor: 'border-orange-500',
        glowClass: 'glow-orange',
        bgColor: 'bg-orange-900/30'
    },
    [IncidentStatus.RESOLVED]: {
        borderColor: 'border-green-500',
        glowClass: '',
        bgColor: 'bg-green-900/30'
    }
};

const AlertCard: React.FC<AlertCardProps> = ({ incident, onResolve, onDispatch, onViewOnMap, isResolving }) => {
    const styles = statusStyles[incident.status];
    const isSmokeActive =
        incident.status === IncidentStatus.ACTIVE && incident.alertType === 'smoke';
    const cardBorder = isSmokeActive ? 'border-amber-500' : styles.borderColor;
    const cardBg = isSmokeActive ? 'bg-amber-950/35' : styles.bgColor;
    const cardGlow = isSmokeActive ? 'glow-yellow' : styles.glowClass;

    return (
        <div
            className={`rounded-xl border ${cardBorder} ${cardBg} ${cardGlow} overflow-hidden shadow-lg transition-shadow duration-300 hover:shadow-2xl`}
        >
             <div className={`p-4 border-b ${cardBorder}`}>
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">{incident.locationName}</h3>
                    <span
                         className={`px-3 py-1 text-sm font-semibold rounded-full ${cardBg} border ${cardBorder} capitalize`}
                     >
                        {incident.alertType === 'fire' && (
                            <Flame className="inline-block h-3.5 w-3.5 text-[#ff6600] mr-1.5 align-[-2px]" />
                        )}
                        {incident.status}
                        {isSmokeActive && (
                            <span className="ml-2 text-amber-200 font-normal normal-case">(smoke)</span>
                        )}
                    </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{new Date(incident.timestamp).toLocaleString()}</p>
             </div>
             <div className="p-4 space-y-4">
                <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 mt-1 text-gray-400 flex-shrink-0" />
                    <p className="text-gray-200">{incident.address}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 text-center">
                    <SensorReading
                        icon={<Thermometer className="h-5 w-5 mx-auto text-red-400" />}
                        label="Temperature"
                        value={`${incident.sensorData.temperature.toFixed(0)}°C`}
                    />
                </div>
             </div>
             <div className={`p-4 bg-black/20 flex flex-wrap gap-2`}>
                <button
                    className="flex-1 min-w-[100px] bg-[#E53935] text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center justify-center gap-1"
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDispatch?.(incident.id);
                    }}
                >
                    Dispatch Unit
                </button>
                <button
                    className="flex-1 min-w-[100px] bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-green-900/60 disabled:cursor-not-allowed transition-colors text-sm"
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onResolve?.(incident.id);
                    }}
                    disabled={isResolving}
                >
                    {isResolving ? 'Resolving...' : 'Resolved'}
                </button>
                <button
                    className="w-full bg-[#2A2A2A] text-white font-semibold py-2 px-4 rounded-lg hover:bg-[#3A3A3A] border border-gray-600 transition-colors text-sm flex items-center justify-center gap-2"
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewOnMap?.(incident);
                    }}
                >
                    <Map className="h-4 w-4" />
                    View on Map
                </button>
             </div>
        </div>
    );
};

interface SensorReadingProps {
    icon: React.ReactNode;
    label: string;
    value: string;
}

const SensorReading: React.FC<SensorReadingProps> = ({ icon, label, value }) => (
    <div className="bg-black/30 p-2 rounded-md">
        {icon}
        <p className="text-xs text-gray-400 mt-1">{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
    </div>
);

export default AlertCard;
