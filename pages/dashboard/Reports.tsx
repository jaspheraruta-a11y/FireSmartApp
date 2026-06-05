
import React, { useCallback, useEffect, useRef, useState } from 'react';
import BfpLogo from '../../components/BfpLogo';
import ReportsTable from '../../components/ReportsTable';
import { subscribeToIncidents } from '../../services/supabase';
import { Incident } from '../../types';
import { CheckCircle2, FileDown, Loader2 } from 'lucide-react';
import { exportIncidentsToCsv, exportIncidentsToPdf } from '../../utils/export';

type ExportFormat = 'csv' | 'pdf';

const EXPORT_LABELS: Record<ExportFormat, string> = {
    csv: 'CSV',
    pdf: 'PDF',
};

const MIN_EXPORT_MS = 650;
const SUCCESS_VISIBLE_MS = 2800;

const Reports: React.FC = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [exporting, setExporting] = useState<ExportFormat | null>(null);
    const [successFormat, setSuccessFormat] = useState<ExportFormat | null>(null);
    const [toastExiting, setToastExiting] = useState(false);
    const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeToIncidents(setIncidents);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        return () => {
            if (successTimerRef.current) clearTimeout(successTimerRef.current);
            if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        };
    }, []);

    const clearSuccessTimers = useCallback(() => {
        if (successTimerRef.current) {
            clearTimeout(successTimerRef.current);
            successTimerRef.current = null;
        }
        if (exitTimerRef.current) {
            clearTimeout(exitTimerRef.current);
            exitTimerRef.current = null;
        }
    }, []);

    const showSuccess = useCallback(
        (format: ExportFormat) => {
            clearSuccessTimers();
            setToastExiting(false);
            setSuccessFormat(format);

            successTimerRef.current = setTimeout(() => {
                setToastExiting(true);
                exitTimerRef.current = setTimeout(() => {
                    setSuccessFormat(null);
                    setToastExiting(false);
                }, 350);
            }, SUCCESS_VISIBLE_MS);
        },
        [clearSuccessTimers],
    );

    const runExport = useCallback(
        async (format: ExportFormat, data: Incident[]) => {
            if (exporting) return;

            setExporting(format);
            const started = Date.now();

            try {
                if (format === 'csv') {
                    exportIncidentsToCsv(data);
                } else {
                    exportIncidentsToPdf(data);
                }
                const elapsed = Date.now() - started;
                if (elapsed < MIN_EXPORT_MS) {
                    await new Promise((r) => setTimeout(r, MIN_EXPORT_MS - elapsed));
                }
                showSuccess(format);
            } finally {
                setExporting(null);
            }
        },
        [exporting, showSuccess],
    );

    const sortedIncidents = [...incidents].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const renderExportButton = (format: ExportFormat, variant: 'secondary' | 'primary') => {
        const isLoading = exporting === format;
        const baseClass =
            variant === 'primary'
                ? 'bg-[#E53935] hover:bg-red-700 text-white'
                : 'bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white';

        return (
            <button
                type="button"
                disabled={exporting !== null}
                onClick={() => runExport(format, sortedIncidents)}
                className={
                    `${baseClass} font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2 ` +
                    (isLoading ? 'export-btn-loading' : 'disabled:opacity-50')
                }
            >
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <FileDown className="h-4 w-4" />
                )}
                <span>{isLoading ? `Exporting ${EXPORT_LABELS[format]}…` : `Export ${EXPORT_LABELS[format]}`}</span>
            </button>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <BfpLogo size="lg" showText={false} />
                    <h1 className="text-3xl font-bold text-white">Incident Reports & Logs</h1>
                </div>
                <div className="flex space-x-2">
                    {renderExportButton('csv', 'secondary')}
                    {renderExportButton('pdf', 'primary')}
                </div>
            </div>

            <div className="bg-[#2A2A2A] rounded-lg border border-gray-700 overflow-hidden">
                <ReportsTable incidents={sortedIncidents} />
            </div>

            {successFormat && (
                <div
                    role="status"
                    aria-live="polite"
                    className={
                        'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-[#43A047]/40 ' +
                        'bg-[#1F2E1F] px-5 py-4 shadow-lg shadow-black/40 export-success-toast ' +
                        (toastExiting ? 'export-success-toast-exit' : '')
                    }
                >
                    <CheckCircle2
                        className="h-8 w-8 text-[#43A047] shrink-0 export-success-icon"
                        strokeWidth={2.5}
                    />
                    <div>
                        <p className="text-white font-semibold">Export complete</p>
                        <p className="text-sm text-gray-400">
                            {EXPORT_LABELS[successFormat]} downloaded successfully
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
