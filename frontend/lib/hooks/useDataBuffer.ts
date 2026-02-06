/**
 * Custom hook for adaptive data buffering
 * Manages playback speed based on buffer size for smooth visualization
 */

import { useState, useEffect, useRef } from 'react';
import type { VibrationData } from '../types';

interface UseDataBufferReturn {
    vibrationData: VibrationData[];
    avgVibration: { x: number; y: number; z: number };
    currentDataTimestamp: number | null;
    addToBuffer: (data: VibrationData) => void;
}

const MAX_DISPLAY_POINTS = 300; // Keep last 3 seconds at 100Hz

export function useDataBuffer(): UseDataBufferReturn {
    const [vibrationData, setVibrationData] = useState<VibrationData[]>([]);
    const [avgVibration, setAvgVibration] = useState({ x: 0, y: 0, z: 0 });
    const [currentDataTimestamp, setCurrentDataTimestamp] = useState<number | null>(null);

    const incomingBuffer = useRef<VibrationData[]>([]);

    // Add data to buffer (called from WebSocket)
    const addToBuffer = (data: VibrationData) => {
        // Direct update for low-latency display
        setVibrationData((prev) => {
            const updated = [...prev, data];
            return updated.slice(-MAX_DISPLAY_POINTS);
        });

        setAvgVibration({
            x: Number(data.X.toFixed(2)),
            y: Number(data.Y.toFixed(2)),
            z: Number(data.Z.toFixed(2))
        });

        setCurrentDataTimestamp(data.timestamp);
    };

    return {
        vibrationData,
        avgVibration,
        currentDataTimestamp,
        addToBuffer
    };
}
