
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Incident } from '../types';

interface AnalyticsChartProps {
    incidents: Incident[];
    range: 'weekly' | 'monthly' | 'yearly';
}

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ incidents, range }) => {
    const now = new Date();

    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

    const incidentDates = incidents.map(i => new Date(i.timestamp));

    const data = (() => {
        if (range === 'weekly') {
            // Last 7 days (daily)
            const start = startOfDay(addDays(now, -6));
            return Array.from({ length: 7 }).map((_, idx) => {
                const date = addDays(start, idx);
                const label = date.toLocaleDateString('en-US', { weekday: 'short' });
                const count = incidentDates.filter(d => startOfDay(d).getTime() === date.getTime()).length;
                return { name: label, incidents: count };
            });
        }

        if (range === 'monthly') {
            // Last 30 days (daily)
            const start = startOfDay(addDays(now, -29));
            return Array.from({ length: 30 }).map((_, idx) => {
                const date = addDays(start, idx);
                const label = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
                const count = incidentDates.filter(d => startOfDay(d).getTime() === date.getTime()).length;
                return { name: label, incidents: count };
            });
        }

        // Yearly: last 12 months (monthly buckets)
        const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const months = Array.from({ length: 12 }).map((_, i) => new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1));

        return months.map(m => {
            const key = monthKey(m);
            const label = m.toLocaleDateString('en-US', { month: 'short' });
            const count = incidentDates.filter(d => monthKey(d) === key).length;
            return { name: label, incidents: count };
        });
    })();

    return (
        <div style={{ width: '100%', height: 300 }}>
             <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A4A4A" />
                    <XAxis dataKey="name" stroke="#CFCFCF" />
                    <YAxis stroke="#CFCFCF" />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: '#2A2A2A', 
                            border: '1px solid #4A4A4A'
                        }} 
                    />
                    <Legend />
                    <Line type="monotone" dataKey="incidents" stroke="#E53935" strokeWidth={2} activeDot={{ r: 8 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default AnalyticsChart;
