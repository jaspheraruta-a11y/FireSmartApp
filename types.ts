
export enum UserRole {
    ADMIN = 'admin',
    BFP = 'bfp',
    RESIDENT = 'resident',
}

export interface UserProfile {
    id: string;
    email: string;
    role: UserRole;
    fullName: string;
}

export enum IncidentStatus {
    ACTIVE = 'active',
    RESPONDING = 'responding',
    RESOLVED = 'resolved',
}

/** How the alert was raised; drives alarm UI (yellow smoke vs red fire). */
export type IncidentAlertType = 'fire' | 'smoke';

export interface SensorData {
    temperature: number; // in Celsius
    smoke: number; // PPM
    gas: number; // PPM
}

export interface Incident {
    id: string;
    deviceId: string;
    timestamp: string;
    location: {
        lat: number;
        lng: number;
    };
    address: string;
    locationName: string;
    status: IncidentStatus;
    /** From `fire_alerts.alert_type`; defaults to `fire` when null or unknown. */
    alertType: IncidentAlertType;
    sensorData: SensorData;
    assignedUnit?: string;
    resolvedAt?: string;
}

export interface Device {
    id: string;
    name: string;
    location: {
        lat: number;
        lng: number;
    };
    status: 'online' | 'offline';
    lastSeen: string;
}
