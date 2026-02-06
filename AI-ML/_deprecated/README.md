# Deprecated Backend Files

These files are kept for historical reference but are no longer actively used.

## Current Active Backend

**Use:** `server/index.js` (modular Node.js WebSocket server)

Run with: `npm start` or `npm run dev`

## Deprecated Files

### realtime_backend.py
- **Reason**: Python WebSocket implementation replaced by Node.js for better ESP32 compatibility
- **Date Deprecated**: 2026-02-06
- **Issues**: 
  - Incompatibility with Render's SSL proxy
  - Connection issues with ESP32 clients
  - Higher latency than Node.js implementation

### websocket_server.js
- **Reason**: Monolithic architecture refactored into modular services
- **Date Deprecated**: 2026-02-06
- **Note**: Can still run with `npm run legacy` if needed
- **Replaced by**: `server/` directory with separate modules

## Architecture Evolution

### Old (Python)
```
ESP32 → Firebase → Python Backend → Firebase → Frontend
```
- High latency (1-2s)
- Firebase bottleneck
- Complex deployment

### Intermediate (Monolithic Node.js)
```
ESP32 → WebSocket Server → Frontend
       ↓
    ML (Python subprocess)
```
- Better latency (~100ms)
- Single file became hard to maintain

### Current (Modular Node.js)
```
ESP32 → WebSocket Server (modular) → Frontend
       ↓
    ML Service (Python subprocess)
```

**Modules:**
- `config.js` - Configuration management
- `logger.js` - Structured logging
- `connectionManager.js` - Client management
- `mlService.js` - ML predictions
- `dataProcessor.js` - Data buffering
- `index.js` - Main entry point

## Migration Guide

If you were using `realtime_backend.py` or `websocket_server.js`:

1. **Install dependencies**: `npm install`
2. **Run new server**: `npm start`
3. **Environment variables** (optional):
   ```bash
   PORT=8765
   LOG_LEVEL=info
   CONFIDENCE_THRESHOLD=0.7
   ```
4. **Health check**: `http://localhost:8765/health`

## Benefits of New Architecture

- ✅ **Modular** - Each concern in its own module
- ✅ **Testable** - Easy to unit test individual modules
- ✅ **Maintainable** - Clear separation of responsibilities
- ✅ **Configurable** - Environment variable support
- ✅ **Observable** - Structured logging and health checks
- ✅ **Reliable** - Proper error handling and graceful shutdown
