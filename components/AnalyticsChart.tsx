
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Incident } from '../types';

export type AnalyticsRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsRange, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
};

const COLORS = {
    low: '#22C55E',
    medium: '#F97316',
    high: '#E53935',
} as const;

interface AnalyticsChartProps {
    incidents: Incident[];
    range: AnalyticsRange;
}

const getBarColor = (count: number, maxCount: number): string => {
    if (count === 0) return COLORS.low;
    if (maxCount <= 0) return COLORS.low;
    const ratio = count / maxCount;
    if (ratio <= 0.33) return COLORS.low;
    if (ratio <= 0.66) return COLORS.medium;
    return COLORS.high;
};

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ incidents, range }) => {
    const now = new Date();

    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
    const startOfWeek = (d: Date) => {
        const day = d.getDay();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    };

    const incidentDates = incidents.map(i => new Date(i.timestamp));

    const data = useMemo(() => {
        if (range === 'daily') {
            const today = startOfDay(now);
            return Array.from({ length: 7 }, (_, idx) => {
                const day = addDays(today, -6 + idx);
                const count = incidentDates.filter(
                    d => startOfDay(d).getTime() === day.getTime()
                ).length;
                const label = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                return { name: label, incidents: count };
            });
        }

        if (range === 'weekly') {
            const thisWeekStart = startOfWeek(now);
            return Array.from({ length: 8 }, (_, idx) => {
                const weekStart = addDays(thisWeekStart, -7 * (7 - idx));
                const weekEnd = addDays(weekStart, 6);
                const label =
                    weekStart.getMonth() === weekEnd.getMonth()
                        ? `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${weekEnd.getDate()}`
                        : `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                const count = incidentDates.filter(d => startOfWeek(d).getTime() === weekStart.getTime()).length;
                return { name: label, incidents: count };
            });
        }

        if (range === 'monthly') {
            const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            const months = Array.from({ length: 12 }, (_, i) =>
                new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1)
            );

            return months.map(m => {
                const key = monthKey(m);
                const label = m.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                const count = incidentDates.filter(d => monthKey(d) === key).length;
                return { name: label, incidents: count };
            });
        }

        const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 4 + i);
        return years.map(year => {
            const count = incidentDates.filter(d => d.getFullYear() === year).length;
            return { name: String(year), incidents: count };
        });
    }, [incidents, range, now]);

    const maxCount = Math.max(...data.map(d => d.incidents), 0);

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A4A4A" vertical={false} />
                    <XAxis dataKey="name" stroke="#CFCFCF" interval="preserveStartEnd" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#CFCFCF" allowDecimals={false} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#2A2A2A',
                            border: '1px solid #4A4A4A',
                        }}
                        cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                    />
                    <Bar
                        dataKey="incidents"
                        name="Incidents"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive
                        animationDuration={900}
                        animationEasing="ease-out"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getBarColor(entry.incidents, maxCount)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.low }} />
                    Low
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.medium }} />
                    Medium
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.high }} />
                    High
                </span>
            </div>
        </div>
    );
};

export default AnalyticsChart;
