# Deprecated Frontend Files

Files moved here are no longer used in the current application architecture.

## firebaseService.ts
- **Reason**: Application migrated to direct WebSocket communication
- **Date Deprecated**: 2026-02-06
- **Replaced by**: `lib/hooks/useWebSocketData.ts`
- **Note**: Firebase Realtime Database integration removed in favor of WebSocket for lower latency

## Migration Notes

The application architecture evolved from:
- **Old**: Frontend → Firebase Realtime Database ← Python Backend
- **New**: Frontend → WebSocket → Node.js Backend → ML Service

This change provides:
- Lower latency (< 100ms vs 1-2s)
- Direct real-time communication
- Simpler data flow
- Better scalability
