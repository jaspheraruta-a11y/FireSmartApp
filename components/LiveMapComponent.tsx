import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Incident, IncidentStatus } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const VALENCIA_CITY_CENTER: [number, number] = [7.9064, 125.0942];
const VALENCIA_DEFAULT_ZOOM = 13;
const BFP_OFFICE: [number, number] = [7.92183142380515, 125.096093416214];

// Solid glowing circles — rendered purely via CSS, no SVG needed.
// We define colours for each of the 3 circle tiers.
const CIRCLE_COLORS = ['#00ffff', '#3b82f6', '#a855f7'] as const;

// ─── Utilities ────────────────────────────────────────────────────────────────
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeStatus(status: IncidentStatus | string | undefined): IncidentStatus {
    const s = String(status ?? 'active').toLowerCase();
    if (s === 'resolved') return IncidentStatus.RESOLVED;
    if (s === 'responding') return IncidentStatus.RESPONDING;
    return IncidentStatus.ACTIVE;
}

/** Interpolate a position along a polyline at fraction t (0–1). */
function interpolateRoute(coords: [number, number][], t: number): [number, number] {
    if (coords.length === 0) return [0, 0];
    if (t <= 0) return coords[0];
    if (t >= 1) return coords[coords.length - 1];

    // Compute cumulative segment lengths
    const lengths: number[] = [0];
    for (let i = 1; i < coords.length; i++) {
        const d = distanceKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
        lengths.push(lengths[i - 1] + d);
    }
    const total = lengths[lengths.length - 1];
    const target = t * total;

    for (let i = 1; i < lengths.length; i++) {
        if (lengths[i] >= target) {
            const segFraction = (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1]);
            return [
                coords[i - 1][0] + segFraction * (coords[i][0] - coords[i - 1][0]),
                coords[i - 1][1] + segFraction * (coords[i][1] - coords[i - 1][1]),
            ];
        }
    }
    return coords[coords.length - 1];
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface LiveMapComponentProps {
    incidents: Incident[];
    focusIncidentId?: string | null;
}

type RouteResult = {
    coords: [number, number][];
    distanceKm: number;
    durationMin: number;
};

// ─── OSRM Fetcher ─────────────────────────────────────────────────────────────
async function fetchOsrmRoute(
    from: [number, number],
    to: [number, number]
): Promise<RouteResult | null> {
    try {
        const url =
            `https://router.project-osrm.org/route/v1/driving/` +
            `${from[1]},${from[0]};${to[1]},${to[0]}` +
            `?overview=full&geometries=geojson&steps=false`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data: any = await res.json();
        const route = data?.routes?.[0];
        if (!route) return null;
        const coords: [number, number][] = route.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        );
        return {
            coords,
            distanceKm: route.distance / 1000,
            durationMin: route.duration / 60,
        };
    } catch {
        return null;
    }
}

// ─── Marker Icons ─────────────────────────────────────────────────────────────
const createMarkerIcon = (status: IncidentStatus | string | undefined) => {
    const normalized = normalizeStatus(status);
    let bg: string;
    let glow: string;
    let iconSvg: string;
    let pulse: string;

    switch (normalized) {
        case IncidentStatus.ACTIVE:
            bg = 'linear-gradient(135deg,#ff6b35,#e53935,#c62828)';
            glow = 'rgba(229,57,53,0.8)';
            pulse = 'neon-pulse-red';
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><text y="20" font-size="20" font-family="Arial">🔥</text></svg>`;
            break;
        case IncidentStatus.RESPONDING:
            bg = 'linear-gradient(135deg,#fdd835,#fb8c00)';
            glow = 'rgba(253,216,53,0.8)';
            pulse = 'neon-pulse-yellow';
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><text y="20" font-size="18" font-family="Arial">🚒</text></svg>`;
            break;
        default:
            bg = 'linear-gradient(135deg,#43a047,#1b5e20)';
            glow = 'rgba(67,160,71,0.8)';
            pulse = '';
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="white" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
    }

    const html = `
    <div class="map-marker-wrapper ${pulse}">
      <div class="map-marker-ring" style="--glow:${glow};"></div>
      <div class="map-marker-body" style="background:${bg};box-shadow:0 0 16px ${glow},0 0 32px ${glow}44;">
        ${iconSvg}
      </div>
    </div>`;

    return new L.DivIcon({
        html,
        className: 'bg-transparent border-0',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
    });
};

const BFP_ICON = new L.DivIcon({
    html: `
    <div class="bfp-marker">
      <div class="bfp-marker-glow"></div>
      <div class="bfp-marker-inner">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ffff" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <div class="bfp-marker-label">BFP HQ</div>
    </div>`,
    className: 'bg-transparent border-0',
    iconSize: [80, 56],
    iconAnchor: [40, 28],
});

// ─── Map sub-components ───────────────────────────────────────────────────────
const isElectron = typeof navigator !== 'undefined' && /Electron|nativefier/i.test(navigator.userAgent);

function MapResizer() {
    const map = useMap();
    useEffect(() => {
        const run = () => map.invalidateSize();
        requestAnimationFrame(run);
        const timers = [50, 200, 500, 1000].map(t => setTimeout(run, t));
        if (isElectron) timers.push(setTimeout(run, 2000));
        window.addEventListener('resize', run);
        const ro = new ResizeObserver(run);
        const container = map.getContainer();
        if (container) ro.observe(container);
        return () => {
            timers.forEach(clearTimeout);
            window.removeEventListener('resize', run);
            if (container) ro.unobserve(container);
        };
    }, [map]);
    return null;
}

function MapFocusController({ focusIncidentId, incidents }: { focusIncidentId: string | null | undefined; incidents: Incident[] }) {
    const map = useMap();
    const lastFocusedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!focusIncidentId || !incidents.length) return;
        if (lastFocusedRef.current === focusIncidentId) return;
        const incident = incidents.find(i => i.id === focusIncidentId);
        if (incident?.location?.lat != null && incident?.location?.lng != null) {
            map.flyTo([incident.location.lat, incident.location.lng], 17, { duration: 1.4 });
            lastFocusedRef.current = focusIncidentId;
        }
    }, [focusIncidentId, incidents, map]);
    return null;
}

/**
 * 3 neon chevron arrows spaced evenly (0, 1/3, 2/3) along the route,
 * all flowing in sync in a continuous 18-second loop.
 */
const ARROW_OFFSETS = [0, 1 / 3, 2 / 3];

function AnimatedArrows({ coords }: { coords: [number, number][] }) {
    const map = useMap();
    const markersRef = useRef<L.Marker[]>([]);
    const animRef = useRef<number>(0);

    // Build one icon per circle — size and colour vary by position in the convoy
    const ARROW_ICONS = useMemo(() =>
        ARROW_OFFSETS.map((_, idx) => {
            const sz = [18, 14, 10][idx];          // leading = biggest
            const color = CIRCLE_COLORS[idx];
            const opacity = 1 - idx * 0.18;
            return new L.DivIcon({
                html: `<div class="glow-circle-dot" style="width:${sz}px;height:${sz}px;background:${color};box-shadow:0 0 ${sz}px ${color},0 0 ${sz * 2}px ${color}88,0 0 ${sz * 3}px ${color}44;opacity:${opacity};"></div>`,
                className: 'bg-transparent border-0',
                iconSize: [sz, sz],
                iconAnchor: [sz / 2, sz / 2],
            });
        }),
    []);

    useEffect(() => {
        if (coords.length < 2) return;

        // Create 3 markers
        const markers = ARROW_OFFSETS.map((offset, idx) => {
            const startPos = interpolateRoute(coords, offset);
            return L.marker(startPos, { icon: ARROW_ICONS[idx], zIndexOffset: 900 + idx }).addTo(map);
        });
        markersRef.current = markers;

        const DURATION = 18000; // ms for one full loop
        let startTime: number | null = null;

        function animate(ts: number) {
            if (!startTime) startTime = ts;
            const base = ((ts - startTime) % DURATION) / DURATION;
            ARROW_OFFSETS.forEach((offset, idx) => {
                // Each arrow is offset by 1/3; wrap with modulo so they loop cleanly
                const t = (base + offset) % 1;
                const pos = interpolateRoute(coords, t);
                markers[idx].setLatLng(pos);
            });
            animRef.current = requestAnimationFrame(animate);
        }

        animRef.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animRef.current);
            markers.forEach(m => m.remove());
        };
    }, [coords, map, ARROW_ICONS]);

    return null;
}

/** Animated drawing of route segments — reveals coords progressively. */
function AnimatedPolyline({ coords, incidentId }: { coords: [number, number][]; incidentId: string }) {
    const [visibleCount, setVisibleCount] = useState(2);
    const rafRef = useRef<number>(0);
    const startRef = useRef<number | null>(null);
    const DRAW_DURATION = 2200; // ms to draw full route

    useEffect(() => {
        if (coords.length < 2) return;
        setVisibleCount(2);
        startRef.current = null;

        function draw(ts: number) {
            if (!startRef.current) startRef.current = ts;
            const progress = Math.min((ts - startRef.current) / DRAW_DURATION, 1);
            const count = Math.max(2, Math.round(progress * coords.length));
            setVisibleCount(count);
            if (progress < 1) rafRef.current = requestAnimationFrame(draw);
        }
        rafRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rafRef.current);
    }, [coords, incidentId]);

    const visible = coords.slice(0, visibleCount);
    if (visible.length < 2) return null;

    return (
        <React.Fragment>
            {/* Outer glow / halo */}
            <Polyline
                positions={visible}
                pathOptions={{ color: '#7c3aed', weight: 14, opacity: 0.18 }}
            />
            {/* Mid glow */}
            <Polyline
                positions={visible}
                pathOptions={{ color: '#3b82f6', weight: 9, opacity: 0.35 }}
            />
            {/* Core neon blue line */}
            <Polyline
                positions={visible}
                pathOptions={{ color: '#00d4ff', weight: 4, opacity: 0.95 }}
            />
            {/* Animated dashes on top for futuristic look */}
            <Polyline
                positions={visible}
                pathOptions={{
                    color: '#a855f7',
                    weight: 2,
                    opacity: 0.7,
                    dashArray: '12 18',
                    dashOffset: '0',
                }}
            />
        </React.Fragment>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const LiveMapComponent: React.FC<LiveMapComponentProps> = ({
    incidents,
    focusIncidentId = null,
}) => {
    const [isMounted, setIsMounted] = useState(false);
    const [containerReady, setContainerReady] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
    const [routeMap, setRouteMap] = useState<Map<string, RouteResult>>(new Map());
    const fetchingRef = useRef<Set<string>>(new Set());
    const [mapZoom, setMapZoom] = useState(VALENCIA_DEFAULT_ZOOM);

    useEffect(() => { setIsMounted(true); }, []);

    const mapIncidents = useMemo(() =>
        incidents.filter(i => normalizeStatus(i?.status) !== IncidentStatus.RESOLVED),
        [incidents]
    );

    // Auto-fetch routes
    useEffect(() => {
        mapIncidents.forEach(incident => {
            const id = incident.id;
            if (!incident.location?.lat || !incident.location?.lng) return;
            if (routeMap.has(id) || fetchingRef.current.has(id)) return;
            fetchingRef.current.add(id);
            fetchOsrmRoute(BFP_OFFICE, [incident.location.lat, incident.location.lng])
                .then(result => {
                    if (result) setRouteMap(prev => new Map(prev).set(id, result));
                })
                .finally(() => { fetchingRef.current.delete(id); });
        });
        // Cleanup stale routes
        const activeIds = new Set(mapIncidents.map(i => i.id));
        setRouteMap(prev => {
            const next = new Map(prev);
            let changed = false;
            for (const k of next.keys()) {
                if (!activeIds.has(k)) { next.delete(k); changed = true; }
            }
            return changed ? next : prev;
        });
    }, [mapIncidents]);

    // Wait for container dimensions
    useEffect(() => {
        if (!isMounted || !containerRef.current) return;
        const el = containerRef.current;
        const check = () => {
            if (el.offsetHeight > 0 && el.offsetWidth > 0) { setContainerReady(true); return true; }
            return false;
        };
        if (check()) return;
        const ro = new ResizeObserver(() => { if (check()) ro.disconnect(); });
        ro.observe(el);
        const t = setTimeout(() => { check(); ro.disconnect(); }, isElectron ? 800 : 300);
        return () => { ro.disconnect(); clearTimeout(t); };
    }, [isMounted]);

    // ── Popup ──────────────────────────────────────────────────────────────────
    const closePopup = useCallback(() => setSelectedIncident(null), []);

    // First available route for the 3 animated arrows
    const firstRoute = useMemo(() => {
        for (const [, r] of routeMap) {
            if (r.coords.length > 1) return r.coords;
        }
        return null;
    }, [routeMap]);

    if (!isMounted) {
        return (
            <div className="w-full h-full min-h-[400px] flex items-center justify-center" style={{ background: '#080c14' }}>
                <div className="map-loading-spinner">
                    <div className="map-loading-ring" />
                    <span className="map-loading-text">Initializing Map…</span>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative h-full w-full" style={{ minHeight: '480px' }}>
            {!containerReady ? (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#080c14', borderRadius: '12px' }}>
                    <div className="map-loading-spinner">
                        <div className="map-loading-ring" />
                        <span className="map-loading-text">Initializing Map…</span>
                    </div>
                </div>
            ) : (
                <MapContainer
                    center={VALENCIA_CITY_CENTER}
                    zoom={VALENCIA_DEFAULT_ZOOM}
                    style={{ height: '100%', minHeight: '480px', width: '100%', zIndex: 0, borderRadius: '12px', background: '#0a0f1e' }}
                    zoomControl={false}
                >
                    {/* Dark neon map tiles */}
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />

                    <MapResizer />
                    <MapFocusController focusIncidentId={focusIncidentId} incidents={mapIncidents} />

                    {/* BFP Office */}
                    <Marker position={BFP_OFFICE} icon={BFP_ICON} />

                    {/* Animated route lines */}
                    {Array.from(routeMap.entries()).map(([id, route]) =>
                        route.coords.length > 1 ? (
                            <AnimatedPolyline key={id} coords={route.coords} incidentId={id} />
                        ) : null
                    )}

                    {/* 3 neon arrows flowing along first active route */}
                    {firstRoute && <AnimatedArrows coords={firstRoute} />}

                    {/* Incident markers */}
                    {mapIncidents
                        .filter(i => i?.location?.lat != null && i?.location?.lng != null)
                        .map(incident => (
                            <Marker
                                key={incident.id}
                                position={[incident.location.lat, incident.location.lng]}
                                icon={createMarkerIcon(incident.status)}
                                eventHandlers={{ click: () => setSelectedIncident(incident) }}
                            />
                        ))}
                </MapContainer>
            )}

            {/* ── Zoom Controls ── */}
            {containerReady && (
                <div className="map-zoom-controls">
                    <button
                        className="map-zoom-btn"
                        title="Zoom in"
                        onClick={() => {
                            const el = document.querySelector('.leaflet-container') as any;
                            if (el?._leaflet_map) el._leaflet_map.zoomIn(1, { animate: true });
                        }}
                    >+</button>
                    <div className="map-zoom-divider" />
                    <button
                        className="map-zoom-btn"
                        title="Zoom out"
                        onClick={() => {
                            const el = document.querySelector('.leaflet-container') as any;
                            if (el?._leaflet_map) el._leaflet_map.zoomOut(1, { animate: true });
                        }}
                    >−</button>
                </div>
            )}

            {/* ── BFP Route Info Panel ── */}
            {containerReady && mapIncidents.length > 0 && (
                <div className="map-route-panel">
                    <div className="map-route-panel-header">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        <span>Live Route Feed</span>
                        <span className="map-route-live-dot" />
                    </div>
                    <ul className="map-route-list">
                        {mapIncidents
                            .filter(i => i?.location?.lat != null && i?.location?.lng != null)
                            .map(incident => {
                                const route = routeMap.get(incident.id);
                                const statusNorm = normalizeStatus(incident.status);
                                const statusColor = statusNorm === IncidentStatus.ACTIVE ? '#ff4444' : '#fdd835';
                                return (
                                    <li
                                        key={incident.id}
                                        className="map-route-item"
                                        onClick={() => setSelectedIncident(incident)}
                                        title="Click for details"
                                    >
                                        <div className="map-route-item-status" style={{ background: statusColor }} />
                                        <div className="map-route-item-content">
                                            <div className="map-route-item-addr">{incident.address || `Incident ${incident.id.slice(0, 8)}`}</div>
                                            {route ? (
                                                <div className="map-route-item-stats">
                                                    <span className="map-stat blue">🛣 {route.distanceKm.toFixed(2)} km</span>
                                                    <span className="map-stat green">⏱ ~{Math.ceil(route.durationMin)} min</span>
                                                </div>
                                            ) : (
                                                <div className="map-route-calculating">
                                                    <span className="map-route-spinner" /> Calculating…
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                    </ul>
                </div>
            )}

            {/* ── Incident Detail Popup ── */}
            {selectedIncident && (
                <div
                    className="map-popup-overlay"
                    role="dialog"
                    aria-modal="true"
                    onClick={closePopup}
                >
                    <div
                        className="map-popup"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="map-popup-header">
                            <div>
                                <div className="map-popup-title">
                                    {normalizeStatus(selectedIncident.status) === IncidentStatus.ACTIVE ? '🔥' : '🚒'} Incident Details
                                </div>
                                <div className="map-popup-id">{selectedIncident.id}</div>
                            </div>
                            <button className="map-popup-close" onClick={closePopup}>✕</button>
                        </div>

                        {/* Grid Info */}
                        <div className="map-popup-body">
                            <div className="map-popup-grid-2">
                                <div className="map-popup-card">
                                    <div className="map-popup-card-label">Status</div>
                                    <div className={`map-popup-card-value ${normalizeStatus(selectedIncident.status) === IncidentStatus.ACTIVE ? 'text-red' : 'text-yellow'}`}>
                                        {String(selectedIncident.status ?? 'active').toUpperCase()}
                                    </div>
                                </div>
                                <div className="map-popup-card">
                                    <div className="map-popup-card-label">Detected</div>
                                    <div className="map-popup-card-value">
                                        {selectedIncident.timestamp ? new Date(selectedIncident.timestamp).toLocaleString() : '—'}
                                    </div>
                                </div>
                            </div>
                            <div className="map-popup-card">
                                <div className="map-popup-card-label">📍 Address</div>
                                <div className="map-popup-card-value">{selectedIncident.address ?? 'Unknown location'}</div>
                            </div>

                            {/* Route Info */}
                            {(() => {
                                const route = selectedIncident.location?.lat != null
                                    ? routeMap.get(selectedIncident.id)
                                    : undefined;
                                const straight = selectedIncident.location?.lat != null && selectedIncident.location?.lng != null
                                    ? distanceKm(selectedIncident.location.lat, selectedIncident.location.lng, BFP_OFFICE[0], BFP_OFFICE[1]).toFixed(2)
                                    : null;
                                return (
                                    <div className="map-popup-route-card">
                                        <div className="map-popup-route-title">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2.5"><path d="M3 3l18 18M3 21l7-7m5-5l7-7"/></svg>
                                            Route from BFP HQ
                                        </div>
                                        <div className="map-popup-grid-3">
                                            <div>
                                                <div className="map-popup-card-label">Straight-line</div>
                                                <div className="map-popup-card-value text-cyan">{straight ? `${straight} km` : '—'}</div>
                                            </div>
                                            {route ? (
                                                <>
                                                    <div>
                                                        <div className="map-popup-card-label">Road distance</div>
                                                        <div className="map-popup-card-value text-blue">{route.distanceKm.toFixed(2)} km</div>
                                                    </div>
                                                    <div>
                                                        <div className="map-popup-card-label">Est. travel time</div>
                                                        <div className="map-popup-card-value text-green">~{Math.ceil(route.durationMin)} min</div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="col-span-2 map-route-calculating">
                                                    <span className="map-route-spinner" /> Calculating route…
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Sensor Data */}
                            <div className="map-popup-sensor">
                                <div className="map-popup-card-label" style={{ marginBottom: '8px' }}>📡 Sensor Data</div>
                                <div className="map-popup-grid-3">
                                    {[
                                        { label: 'Temperature', value: `${Number(selectedIncident.sensorData?.temperature ?? 0).toFixed(1)}°C`, icon: '🌡️', color: '#ff6b6b' },
                                        { label: 'Smoke', value: `${selectedIncident.sensorData?.smoke ?? 0} PPM`, icon: '💨', color: '#a0aec0' },
                                        { label: 'Gas', value: `${selectedIncident.sensorData?.gas ?? 0} PPM`, icon: '⚗️', color: '#b794f4' },
                                    ].map(s => (
                                        <div key={s.label} className="map-sensor-card">
                                            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{s.icon}</div>
                                            <div className="map-popup-card-label">{s.label}</div>
                                            <div className="map-popup-card-value" style={{ color: s.color }}>{s.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="map-popup-card">
                                <div className="map-popup-card-label">🚒 Assigned Unit</div>
                                <div className="map-popup-card-value">{selectedIncident.assignedUnit || 'Not assigned'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Neon Legend ── */}
            {containerReady && (
                <div className="map-legend">
                    <div className="map-legend-item">
                        <div className="map-legend-dot" style={{ background: '#ff4444', boxShadow: '0 0 6px #ff4444' }} />
                        <span>Active</span>
                    </div>
                    <div className="map-legend-item">
                        <div className="map-legend-dot" style={{ background: '#fdd835', boxShadow: '0 0 6px #fdd835' }} />
                        <span>Responding</span>
                    </div>
                    <div className="map-legend-item">
                        <div className="map-legend-dot" style={{ background: '#00d4ff', boxShadow: '0 0 6px #00d4ff' }} />
                        <span>Route</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveMapComponent;
