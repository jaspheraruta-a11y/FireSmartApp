
import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import PasskeyGate from './components/PasskeyGate';

// Lazy load pages for better performance
const DashboardLayout = lazy(() => import('./pages/DashboardLayout'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const LiveMap = lazy(() => import('./pages/dashboard/LiveMap'));
const Alerts = lazy(() => import('./pages/dashboard/Alerts'));
const Devices = lazy(() => import('./pages/dashboard/Devices'));
const Reports = lazy(() => import('./pages/dashboard/Reports'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));

const LoadingFallback: React.FC = () => (
    <div className="flex h-screen w-full items-center justify-center bg-[#0F0F0F]">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-dashed border-[#E53935]"></div>
    </div>
);

const App: React.FC = () => {
    return (
        <AuthProvider>
            <HashRouter>
                <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route 
                            path="/dashboard" 
                            element={
                                <ProtectedRoute>
                                    <DashboardLayout />
                                </ProtectedRoute>
                            }
                        >
                            <Route index element={<Navigate to="overview" replace />} />
                            <Route path="overview" element={<Dashboard />} />
                            <Route path="map" element={<LiveMap />} />
                            <Route path="alerts" element={<Alerts />} />
                            <Route path="devices" element={<Devices />} />
                            <Route
                                path="reports"
                                element={
                                    <PasskeyGate scope="reports" title="Incident Reports & Logs">
                                        <Reports />
                                    </PasskeyGate>
                                }
                            />
                            <Route
                                path="settings"
                                element={
                                    <PasskeyGate scope="settings" title="Settings">
                                        <Settings />
                                    </PasskeyGate>
                                }
                            />
                        </Route>
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </Suspense>
            </HashRouter>
        </AuthProvider>
    );
};

export default App;
