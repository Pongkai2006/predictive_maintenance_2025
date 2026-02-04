"use client";

import { useState, useEffect, useRef } from 'react';
import { MachineStatusCard } from './components/MachineStatusCard';
import { VibrationChart } from './components/VibrationChart';
import { StatsCard } from './components/StatsCard';
import { Activity, Clock, AlertCircle } from 'lucide-react';

export interface VibrationData {
  timestamp: number;
  X: number;  // ESP32 uses capital letters
  Y: number;
  Z: number;
}

export interface MachineStatus {
  condition: 'GOOD' | 'BAD';
  confidence: number;
  lastUpdate: Date;
  timestamp?: number; // Sync key
}

type BufferItem =
  | { type: 'data'; val: VibrationData }
  | { type: 'status'; val: MachineStatus };

export default function App() {
  const [status, setStatus] = useState<MachineStatus | null>(null);

  const [vibrationData, setVibrationData] = useState<VibrationData[]>([]);
  const [avgVibration, setAvgVibration] = useState({ x: 0, y: 0, z: 0 });
  const [currentDataTimestamp, setCurrentDataTimestamp] = useState<number | null>(null);
  const [uptime, setUptime] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [hasData, setHasData] = useState(false);

  // Buffer for smoothing out burst data updates
  const incomingBuffer = useRef<VibrationData[]>([]);
  // Queue for timestamp-synced status updates
  const statusQueue = useRef<MachineStatus[]>([]);

  // Data and Status subscriptions
  useEffect(() => {
    let ws: WebSocket | null = null;

    const setupConnections = async () => {
      // 1. Firebase for Raw Data (Graph)
      const { subscribeToRawData, getLatestRawData, checkConnection } = await import('../lib/firebaseService');

      // Check Firebase connection
      const unsubConnection = checkConnection((connected) => {
        setIsConnected(connected);
        if (!connected) console.warn('Firebase disconnected');
      });

      // Subscribe to raw sensor data from /sensor/batchAcceleration
      const unsubRaw = subscribeToRawData((data) => {
        incomingBuffer.current.push(data);
      });

      // Load initial chart data
      getLatestRawData(30, (initialData) => {
        setVibrationData(initialData);
      });

      // 2. WebSocket for AI Status
      const connectWebSocket = () => {
        ws = new WebSocket('ws://localhost:8765');

        ws.onopen = () => {
          console.log('WebSocket Connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Push to queue for synchronized playback
            statusQueue.current.push({
              condition: data.state,
              confidence: data.prob_bad * 100,
              lastUpdate: new Date(data.updated_at),
              timestamp: data.data_timestamp
            });
            setHasData(true);
          } catch (e) {
            console.error('Failed to parse WS message:', e);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket Disconnected. Reconnecting in 3s...');
          setTimeout(connectWebSocket, 3000);
        };
      };

      connectWebSocket();

      // Cleanup
      return () => {
        unsubConnection();
        unsubRaw();
        ws?.close();
      };
    };

    const cleanup = setupConnections();

    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, []);

  // Uptime counter (independent of Firebase)
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setUptime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Adaptive animation loop to process buffered data
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const animate = () => {
      const bufferSize = incomingBuffer.current.length;
      let itemsToProcess = 1;
      let delay = 16; // Target ~60FPS refresh rate

      // Adaptive throughput: Process more items per frame if buffer is growing
      // To match 100Hz input at 60Hz refresh, we need ~1.7 items/frame.
      if (bufferSize > 200) itemsToProcess = 20;     // Emergency fast drain
      else if (bufferSize > 100) itemsToProcess = 10;// Fast catch up
      else if (bufferSize > 50) itemsToProcess = 5;  // Moderate catch up
      else if (bufferSize > 20) itemsToProcess = 2;  // Standard 100Hz maintenance (> 1.7)
      else if (bufferSize > 0) itemsToProcess = 1;   // Slow/Normal playback

      if (bufferSize > 0) {
        // Extract a chunk of items
        const chunk = incomingBuffer.current.splice(0, itemsToProcess);

        if (chunk.length > 0) {
          const lastPoint = chunk[chunk.length - 1]; // Use latest for average stats
          const currentTimestamp = lastPoint.timestamp;

          setVibrationData((prev) => {
            const updated = [...prev, ...chunk];
            return updated.slice(-300); // Keep last 300 points (3 seconds history)
          });

          setAvgVibration({
            x: parseFloat(lastPoint.X.toFixed(2)),
            y: parseFloat(lastPoint.Y.toFixed(2)),
            z: parseFloat(lastPoint.Z.toFixed(2)),
          });
          setCurrentDataTimestamp(lastPoint.timestamp);

          // Accurate Timestamp Synchronization
          // Apply any status updates that belong to this time window or earlier
          while (statusQueue.current.length > 0) {
            // Check if head of queue is 'due'
            // If status timestamp is undefined, apply immediately (fallback)
            // If status timestamp <= current data timestamp, apply it
            if (!statusQueue.current[0].timestamp || statusQueue.current[0].timestamp <= currentTimestamp) {
              const nextStatus = statusQueue.current.shift();
              if (nextStatus) setStatus(nextStatus);
            } else {
              // Queue head is for future data (not yet rendered)
              break;
            }
          }
        }
      } else {
        // If empty, wait a bit
        delay = 50;
      }

      timeoutId = setTimeout(animate, delay);
    };

    // Start the loop
    animate();

    return () => clearTimeout(timeoutId);
  }, []);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
            {/* Firebase Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Uptime */}
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Clock className="size-4" />
              <span className="text-sm">Uptime: {formatUptime(uptime)}</span>
            </div>
          </div>
        </div>

        {/* Main Status and Stats Grid */}
        {!hasData || !status ? (
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
                <li>• ESP32 sensor is writing to Firebase /sensor/raw</li>
                <li>• AI backend (realtime_backend.py) is running</li>
                <li>• Or run test_integration.py to generate test data</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
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
                  trend={status.condition === 'GOOD' ? 'stable' : 'warning'}
                  subtext={currentDataTimestamp ? new Date(currentDataTimestamp).toLocaleTimeString() : undefined}
                />
                <StatsCard
                  title="Y-Axis"
                  value={avgVibration.y.toFixed(2)}
                  unit="m/s²"
                  icon={Activity}
                  trend={status.condition === 'GOOD' ? 'stable' : 'warning'}
                  subtext={currentDataTimestamp ? new Date(currentDataTimestamp).toLocaleTimeString() : undefined}
                />
                <StatsCard
                  title="Z-Axis"
                  value={avgVibration.z.toFixed(2)}
                  unit="m/s²"
                  icon={Activity}
                  trend={status.condition === 'GOOD' ? 'stable' : 'warning'}
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
                {status.condition === 'BAD' && (
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
          <p>AI-Powered Predictive Maintenance System | Data refreshes every second</p>
        </div>
      </div>
    </div>
  );
}
