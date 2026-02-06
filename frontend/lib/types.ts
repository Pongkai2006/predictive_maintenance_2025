/**
 * Shared TypeScript types for the Predictive Maintenance Dashboard
 */

export interface VibrationData {
    timestamp: number;
    X: number;
    Y: number;
    Z: number;
}

export interface MachineStatus {
    condition: 'GOOD' | 'BAD' | 'READY';
    confidence: number;
    lastUpdate: Date;
    timestamp?: number; // Sync key for matching with data points
}

export interface WebSocketMessage {
    X: number;
    Y: number;
    Z: number;
    timestamp: number;
    state: 'GOOD' | 'BAD' | 'READY';
    prob_bad: number;
    updated_at: number;
}

export interface ConnectionStatus {
    isConnected: boolean;
    uptime: number;
    hasData: boolean;
}

export interface DataBufferConfig {
    maxSize: number;
    playbackRate: number;
}
