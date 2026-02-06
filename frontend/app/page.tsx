"use client";

import { useState } from 'react';
import { MachineStatusCard } from '@/components/MachineStatusCard';
import { VibrationChart } from '@/components/VibrationChart';
import { StatsCard } from '@/components/StatsCard';
import { Activity, Clock, AlertCircle } from 'lucide-react';
import { useWebSocketData } from '@/lib/hooks/useWebSocketData';
import { useConnectionStatus } from '@/lib/hooks/useConnectionStatus';
import { useDataBuffer } from '@/lib/hooks/useDataBuffer';
import type { MachineStatus, WebSocketMessage } from '@/lib/types';

export default function App() {
  const [status, setStatus] = useState<MachineStatus | null>(null);

  // Custom hooks for data management  
  const { vibrationData, avgVibration, currentDataTimestamp, addToBuffer } = useDataBuffer();
  const { formattedUptime } = useConnectionStatus();

  // WebSocket connection with message handler
  const { isConnected, hasData } = useWebSocketData((message: WebSocketMessage) => {
    // Add data point to visualization
    addToBuffer({
      X: message.X,
      Y: message.Y,
      Z: message.Z,
      timestamp: message.timestamp
    });

    // Update machine status
    setStatus({
      condition: message.state,
      confidence: message.prob_bad * 100,
      lastUpdate: new Date(message.updated_at),
      timestamp: message.timestamp
    });
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 dark:text-slate-50 mb-2">
              Predictive Maintenance Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Real-time Industrial Machine Monitoring
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Uptime */}
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Clock className="size-4" />
              <span className="text-sm">Uptime: {formattedUptime}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {!hasData ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="animate-pulse">
              <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Activity className="size-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-50">
                Waiting for Data
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                No sensor data received yet. Please ensure:
              </p>
              <ul className="text-sm text-slate-500 dark:text-slate-400 text-left space-y-1 max-w-md">
                <li>• ESP32 sensor is powered on and connected</li>
                <li>• Backend server is running (npm start)</li>
                <li>• ESP32 firmware is configured with correct WebSocket URL</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {/* Status and Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              <div className="lg:col-span-1">
                <MachineStatusCard status={status} />
              </div>

              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatsCard
                  title="X-Axis"
                  value={avgVibration.x.toFixed(2)}
                  unit="m/s²"
                  icon={Activity}
                  trend={(!status || status.condition === 'GOOD') ? 'stable' : 'warning'}
                  subtext={currentDataTimestamp ? new Date(currentDataTimestamp).toLocaleTimeString() : undefined}
                />
                <StatsCard
                  title="Y-Axis"
                  value={avgVibration.y.toFixed(2)}
                  unit="m/s²"
                  icon={Activity}
                  trend={(!status || status.condition === 'GOOD') ? 'stable' : 'warning'}
                  subtext={currentDataTimestamp ? new Date(currentDataTimestamp).toLocaleTimeString() : undefined}
                />
                <StatsCard
                  title="Z-Axis"
                  value={avgVibration.z.toFixed(2)}
                  unit="m/s²"
                  icon={Activity}
                  trend={(!status || status.condition === 'GOOD') ? 'stable' : 'warning'}
                  subtext={currentDataTimestamp ? new Date(currentDataTimestamp).toLocaleTimeString() : undefined}
                />
              </div>
            </div>

            {/* Vibration Charts */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-900 dark:text-slate-50">
                  Real-Time Vibration Signals
                </h2>
                {status && status.condition === 'BAD' && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-lg">
                    <AlertCircle className="size-4" />
                    <span className="text-sm">Anomaly Detected</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
                <VibrationChart
                  data={vibrationData}
                  axis="x"
                  color="#3b82f6"
                  title="X-Axis Vibration"
                />
                <VibrationChart
                  data={vibrationData}
                  axis="y"
                  color="#8b5cf6"
                  title="Y-Axis Vibration"
                />
                <VibrationChart
                  data={vibrationData}
                  axis="z"
                  color="#ec4899"
                  title="Z-Axis Vibration"
                />
              </div>
            </div>
          </>
        )}

        {/* Footer Info */}
        <div className="text-center text-sm text-slate-500 dark:text-slate-500 pt-4">
          <p>AI-Powered Predictive Maintenance System | Real-time monitoring at 20Hz</p>
        </div>
      </div>
    </div>
  );
}
