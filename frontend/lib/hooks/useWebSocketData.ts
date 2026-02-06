/**
 * Custom hook for WebSocket data connection
 * Manages WebSocket lifecycle and provides data stream
 */

import { useState, useEffect, useCallback } from 'react';
import type { WebSocketMessage } from '../types';

interface UseWebSocketDataReturn {
    isConnected: boolean;
    hasData: boolean;
    lastMessage: WebSocketMessage | null;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://pbl-backend-okmj.onrender.com';
// const WS_URL = 'ws://localhost:8765'; // For local development

export function useWebSocketData(
    onMessage: (message: WebSocketMessage) => void
): UseWebSocketDataReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [hasData, setHasData] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

    const connect = useCallback(() => {
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('[WebSocket] Connected');
            setIsConnected(true);
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
            console.log('[WebSocket] Disconnected. Reconnecting in 3s...');
            setIsConnected(false);
            setTimeout(connect, 3000);
        };

        ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
        };

        return ws;
    }, [onMessage]);

    useEffect(() => {
        const ws = connect();
        return () => {
            ws?.close();
        };
    }, [connect]);

    return {
        isConnected,
        hasData,
        lastMessage
    };
}
