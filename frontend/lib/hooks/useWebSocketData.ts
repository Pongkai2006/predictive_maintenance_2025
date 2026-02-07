/**
 * Custom hook for WebSocket data connection
 * Manages WebSocket lifecycle and provides data stream
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WebSocketMessage } from '../types';

interface UseWebSocketDataReturn {
    isConnected: boolean;
    hasData: boolean;
    lastMessage: WebSocketMessage | null;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://predictive-maintenance-2025.onrender.com';
// const WS_URL = 'ws://localhost:8765'; // For local development

export function useWebSocketData(
    onMessage: (message: WebSocketMessage) => void
): UseWebSocketDataReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [hasData, setHasData] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
    const retryCountRef = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const connect = useCallback(() => {
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('[WebSocket] Connected');
            setIsConnected(true);
            retryCountRef.current = 0; // Reset retry count on successful connection
        };

        ws.onmessage = (event) => {
            try {
                const data: WebSocketMessage = JSON.parse(event.data);

                setLastMessage(data);
                setHasData(true);
                onMessage(data);

            } catch (e) {
                console.error('[WebSocket] Failed to parse message:', e);
            }
        };

        ws.onclose = () => {
            setIsConnected(false);

            // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
            retryCountRef.current++;
            const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 30000);

            console.log(`[WebSocket] Disconnected. Reconnecting in ${delay / 1000}s... (attempt ${retryCountRef.current})`);

            reconnectTimeoutRef.current = setTimeout(connect, delay);
        };

        ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
        };

        return ws;
    }, [onMessage]);

    useEffect(() => {
        const ws = connect();
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            ws?.close();
        };
    }, [connect]);

    return {
        isConnected,
        hasData,
        lastMessage
    };
}
