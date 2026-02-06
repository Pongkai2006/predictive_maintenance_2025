# Deprecated Firmware Files

These firmware files are kept for historical reference but are no longer actively maintained.

## Current Active Firmware

**Use:** `ESP32_Direct_WS/ESP32_Direct_WS.ino`

This is the current, unified firmware that supports:
- Direct WebSocket communication with the Node.js backend
- SSL support for production deployment (Render.com)
- WiFi connection monitoring and auto-reconnection
- MPU6050 sensor integration structure (currently using mock data)
- Configurable debug mode
- Proper error handling

## Deprecated Files

### v0.1_iot_upload.ino
- **Reason**: Firebase-only approach, superseded by WebSocket architecture
- **Date Deprecated**: 2026-02-06
- **Features**: Basic Firebase Realtime Database upload

### v0.2_iot_upload.ino
- **Reason**: Firebase-only approach with batching, superseded by WebSocket architecture
- **Date Deprecated**: 2026-02-06
- **Features**: Firebase upload with batch processing

### double_core.ino
- **Reason**: Early dual-core experiment, functionality integrated into ESP32_Direct_WS
- **Date Deprecated**: 2026-02-06
- **Features**: Dual-core processing (one core for sampling, one for transmission)

### double_buffer_core.ino
- **Reason**: Buffering experiment, functionality integrated into ESP32_Direct_WS
- **Date Deprecated**: 2026-02-06
- **Features**: Double buffering for sensor data

## Migration Guide

If you were using any of the deprecated firmware:

1. **Switch to ESP32_Direct_WS.ino**
2. **Update configuration** in the firmware:
   - Set your WiFi credentials
   - Set WebSocket host/port (local or production)
   - Configure debug mode
3. **Upload to ESP32**
4. **Monitor serial output** to verify connection

## Architecture Change

The system has migrated from:
- **Old**: ESP32 → Firebase Realtime Database ← Python Backend ← Frontend
- **New**: ESP32 → WebSocket Server (Node.js) → Frontend

This provides:
- Lower latency (< 100ms vs 1-2s)
- Higher throughput (20Hz real-time vs polling)
- Better reliability
- Simpler deployment
