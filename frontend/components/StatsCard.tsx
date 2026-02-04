import { Card, CardContent } from './ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  trend: 'stable' | 'warning';
  subtext?: string;
}

export function StatsCard({ title, value, unit, icon: Icon, trend, subtext }: StatsCardProps) {
  const isWarning = trend === 'warning';

  return (
    <Card className="overflow-hidden relative">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              {title}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-slate-900 dark:text-slate-50" style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>
                {value}
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {unit}
              </span>
            </div>
            {subtext && (
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {subtext}
              </p>
            )}
          </div>

          <div
            className="p-2 rounded-lg"
            style={{
              backgroundColor: isWarning
                ? 'rgba(239, 68, 68, 0.1)'
                : 'rgba(59, 130, 246, 0.1)'
            }}
          >
            <Icon
              className="size-5"
              style={{
                color: isWarning ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)'
              }}
            />
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div
            className="size-2 rounded-full transition-all duration-500"
            style={{
              backgroundColor: isWarning ? 'rgb(239, 68, 68)' : 'rgb(34, 197, 94)',
              boxShadow: isWarning
                ? '0 0 8px rgba(239, 68, 68, 0.5)'
                : '0 0 8px rgba(34, 197, 94, 0.5)'
            }}
          />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {isWarning ? 'Elevated' : 'Normal'}
          </span>
        </div>

        {/* Background decoration */}
        <div
          className="absolute -bottom-2 -right-2 size-16 rounded-full opacity-5"
          style={{
            backgroundColor: isWarning ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)'
          }}
        />
      </CardContent>
    </Card>
  );
}
