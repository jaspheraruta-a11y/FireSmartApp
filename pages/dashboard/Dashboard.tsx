
import React, { useState, useEffect } from 'react';
import { Flame, ShieldAlert, Clock, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../../components/StatCard';
import BfpLogo from '../../components/BfpLogo';
import AnalyticsChart, { ANALYTICS_RANGE_LABELS, AnalyticsRange } from '../../components/AnalyticsChart';
import { subscribeToIncidents } from '../../services/supabase';
import { Incident, IncidentStatus } from '../../types';

const Dashboard: React.FC = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('daily');
    const navigate = useNavigate();
    
    useEffect(() => {
        const unsubscribe = subscribeToIncidents(setIncidents);
        return () => unsubscribe();
    }, []);

    const totalIncidentsToday = incidents.filter(i => new Date(i.timestamp).toDateString() === new Date().toDateString()).length;
    const activeFireAlerts = incidents.filter(i => i.status === IncidentStatus.ACTIVE).length;
    
    // Mock response time
    const avgResponseTime = 15.3;

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <BfpLogo size="lg" showText={false} />
                <h1 className="text-3xl font-bold text-white">Dashboard Overview</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Incidents (Today)" 
                    value={totalIncidentsToday.toString()} 
                    icon={<Flame className="h-8 w-8 text-[#FB8C00]" />}
                    color="orange"
                    onClick={() => navigate('/dashboard/reports')}
                />
                <StatCard 
                    title="Active Fire Alerts" 
                    value={activeFireAlerts.toString()} 
                    icon={<ShieldAlert className="h-8 w-8 text-[#E53935]" />}
                    color="red"
                    onClick={() => navigate('/dashboard/alerts')}
                />
                <StatCard 
                    title="Average Response Time" 
                    value={`${avgResponseTime} min`} 
                    icon={<Clock className="h-8 w-8 text-[#FDD835]" />}
                    color="yellow"
                />
                <StatCard 
                    title="Monthly Trend" 
                    value="+5.2%" 
                    icon={<TrendingUp className="h-8 w-8 text-[#43A047]" />}
                    color="green"
                />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#2A2A2A] p-6 rounded-lg border border-gray-700">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                        <h2 className="text-xl font-semibold text-white">
                            Incident Analytics
                            <span className="text-sm font-normal text-gray-400 ml-2">
                                ({ANALYTICS_RANGE_LABELS[analyticsRange]})
                            </span>
                        </h2>
                        <div className="inline-flex rounded-lg border border-gray-700 overflow-hidden bg-[#1F1F1F]">
                            {(
                                Object.entries(ANALYTICS_RANGE_LABELS) as [AnalyticsRange, string][]
                            ).map(([id, label]) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setAnalyticsRange(id)}
                                    className={
                                        'px-3 py-1.5 text-sm font-semibold transition-colors ' +
                                        (analyticsRange === id
                                            ? 'bg-[#E53935] text-white'
                                            : 'text-gray-300 hover:bg-[#2A2A2A]')
                                    }
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <AnalyticsChart incidents={incidents} range={analyticsRange} />
                </div>
                <div className="bg-[#2A2A2A] p-6 rounded-lg border border-gray-700">
                     <h2 className="text-xl font-semibold text-white mb-4">Fire-Prone Area Heatmap</h2>
                     <div className="w-full h-80 bg-[#0F0F0F] rounded-md flex items-center justify-center text-gray-500">
                        Heatmap Placeholder
                     </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
