/**
 * Custom hook for connection status monitoring
 * Tracks uptime and connection health
 */

import { useState, useEffect } from 'react';

interface UseConnectionStatusReturn {
    uptime: number;
    formattedUptime: string;
}

export function useConnectionStatus(): UseConnectionStatusReturn {
    const [uptime, setUptime] = useState(0);

    useEffect(() => {
        const startTime = Date.now();

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setUptime(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatUptime = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return {
        uptime,
        formattedUptime: formatUptime(uptime)
    };
}
