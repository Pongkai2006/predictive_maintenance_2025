
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string;
    unit: string;
    icon: LucideIcon;
    trend: 'stable' | 'warning';
}

export function StatsCard({ title, value, unit, icon: Icon, trend }: StatsCardProps) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</span>
                <Icon className="size-5 text-slate-400 dark:text-slate-500" />
            </div>

            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{unit}</span>
            </div>

            <div className="mt-4 flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${trend === 'stable' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} />
                <span className={`text-xs font-medium ${trend === 'stable'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                    {trend === 'stable' ? 'Normal Range' : 'Warning Level'}
                </span>
            </div>
        </div>
    );
}
