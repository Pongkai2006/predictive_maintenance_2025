import { Card, CardContent } from './ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';
import { MachineStatus } from '@/app/page';

interface MachineStatusCardProps {
  status: MachineStatus | null;
}

export function MachineStatusCard({ status }: MachineStatusCardProps) {
  if (!status) {
    return (
      <Card className="h-full border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <CardContent className="p-6 flex flex-col items-center justify-center h-full space-y-4">
          <div className="relative">
            <div className="size-20 md:size-24 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-blue-500 animate-spin" />
          </div>
          <div className="text-center space-y-2">
            <div className="inline-block px-6 py-2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              <span className="tracking-wider">STATUS PENDING</span>
            </div>
            <p className="text-sm text-slate-500">Waiting for AI Backend...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isGood = status.condition === 'GOOD';

  return (
    <Card className="h-full border-2 transition-colors duration-500"
      style={{
        borderColor: isGood ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        backgroundColor: isGood ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)'
      }}>
      <CardContent className="p-6 flex flex-col items-center justify-center h-full space-y-4">
        {/* Status Icon */}
        <div className="relative">
          {isGood ? (
            <CheckCircle2
              className="size-20 md:size-24 transition-all duration-500"
              style={{ color: 'rgb(34, 197, 94)' }}
              strokeWidth={2}
            />
          ) : (
            <XCircle
              className="size-20 md:size-24 transition-all duration-500 animate-pulse"
              style={{ color: 'rgb(239, 68, 68)' }}
              strokeWidth={2}
            />
          )}

          {/* Pulse effect for BAD status */}
          {!isGood && (
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ backgroundColor: 'rgb(239, 68, 68)' }}
            />
          )}
        </div>

        {/* Status Label */}
        <div className="text-center space-y-2">
          <div
            className="inline-block px-6 py-2 rounded-full transition-all duration-500"
            style={{
              backgroundColor: isGood ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
              color: 'white'
            }}
          >
            <span className="tracking-wider">
              MACHINE {status.condition}
            </span>
          </div>

          {/* Confidence Score */}
          <div className="space-y-1">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              AI Confidence Score
            </p>
            <div className="flex items-baseline justify-center gap-1">
              <span
                className="transition-all duration-500"
                style={{
                  color: isGood ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                  fontSize: '2rem',
                  fontWeight: 700
                }}
              >
                {status.confidence}
              </span>
              <span
                className="text-xl"
                style={{ color: isGood ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)' }}
              >
                %
              </span>
            </div>
          </div>

          {/* Last Update */}
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Server Time: {status.lastUpdate.toLocaleTimeString()}
          </p>
          {status.timestamp && (
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Sensor Time: {new Date(status.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Status Description */}
        <div className="w-full pt-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-center text-slate-600 dark:text-slate-400">
            {isGood
              ? 'All systems operating normally. No anomalies detected.'
              : 'Abnormal vibration detected. Inspection recommended.'}
          </p>
        </div>
      </CardContent>
    </Card >
  );
}
