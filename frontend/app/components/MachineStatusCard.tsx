'use client';

import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';

interface MachineStatus {
    condition: 'GOOD' | 'BAD';
    confidence: number;
    lastUpdate: Date;
}

interface MachineStatusCardProps {
    status: MachineStatus;
}

export function MachineStatusCard({ status }: MachineStatusCardProps) {
    const isGood = status.condition === 'GOOD';
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Machine Status</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${isGood
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                    }`}>
                    {isGood ? 'Operational' : 'Attention Needed'}
                </span>
            </div>

            <div className="flex items-center gap-4 mb-6">
                <div className={`p-4 rounded-full ${isGood
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                    }`}>
                    {isGood ? <CheckCircle className="size-8" /> : <AlertTriangle className="size-8" />}
                </div>
                <div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                        {status.condition}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        Confidence check
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500 dark:text-slate-400">AI Confidence</span>
                        <span className="font-medium text-slate-900 dark:text-slate-50">{status.confidence.toFixed(2)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${isGood ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                            style={{ width: `${status.confidence}%` }}
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 text-center">
                    Last updated: {mounted ? status.lastUpdate.toLocaleTimeString() : '--:--:--'}
                </div>
            </div>
        </div>
    );
}
