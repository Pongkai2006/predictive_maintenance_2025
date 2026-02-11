/**
 * Mock Sensor Client
 * Simulates ESP32 sending sensor data to the backend
 * Usage: node mock_sensor.js
 */

const WebSocket = require('ws');

// Configuration
// const WS_URL = 'ws://localhost:8765/sensor'; // Local
const WS_URL = 'wss://predictive-maintenance-2025.onrender.com/sensor'; // Production
const SAMPLE_RATE_MS = 50; // 20Hz (same as ESP32)
const DEBUG = true;

// Simulation parameters
let sampleCount = 0;
let ws = null;
let isConnected = false;

/**
 * Generate realistic mock sensor data
 * Simulates different machine states (normal, warning, bad)
 */
function generateSensorData(time) {
    // Create different patterns to trigger ML model
    const pattern = Math.floor(time / 10000) % 3; // Change pattern every 10 seconds

    let x, y, z;

    switch (pattern) {
        case 0: // NORMAL state - low vibration
            x = (Math.random() - 0.5) * 0.5 + Math.sin(time / 1000) * 0.2;
            y = (Math.random() - 0.5) * 0.5 + Math.cos(time / 1000) * 0.2;
            z = (Math.random() - 0.5) * 0.3;
            break;

        case 1: // WARNING state - moderate vibration
            x = (Math.random() - 0.5) * 2.0 + Math.sin(time / 500) * 1.5;
            y = (Math.random() - 0.5) * 2.0 + Math.cos(time / 500) * 1.5;
            z = (Math.random() - 0.5) * 1.5;
            break;

        case 2: // BAD state - high vibration
            x = (Math.random() - 0.5) * 4.0 + Math.sin(time / 200) * 3.0;
            y = (Math.random() - 0.5) * 4.0 + Math.cos(time / 200) * 3.0;
            z = (Math.random() - 0.5) * 3.0;
            break;
    }

    return { X: x, Y: y, Z: z, timestamp: Date.now() };
}

/**
 * Send sensor data to backend
 */
function sendData() {
    if (!isConnected) return;

    const data = generateSensorData(Date.now());
    const payload = JSON.stringify(data);

    try {
        ws.send(payload);
        sampleCount++;

        // Print every 100th sample to avoid flooding console
        if (DEBUG && sampleCount % 100 === 0) {
            const state = Math.floor(Date.now() / 10000) % 3 === 0 ? 'NORMAL' :
                Math.floor(Date.now() / 10000) % 3 === 1 ? 'WARNING' : 'BAD';
            console.log(`[→] Sent sample #${sampleCount} (${state}): X=${data.X.toFixed(2)}, Y=${data.Y.toFixed(2)}, Z=${data.Z.toFixed(2)}`);
        }
    } catch (err) {
        console.error('[!] Failed to send data:', err.message);
    }
}

/**
 * Connect to WebSocket server
 */
function connect() {
    console.log(`\n[*] Connecting to: ${WS_URL}`);

    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        isConnected = true;
        console.log('[✓] Connected to backend!');
        console.log('[*] Starting data transmission...');
        console.log('[*] Pattern cycle: NORMAL (10s) → WARNING (10s) → BAD (10s) → repeat\n');

        // Start sending data
        setInterval(sendData, SAMPLE_RATE_MS);
    });

    ws.on('message', (data) => {
        if (DEBUG) {
            console.log(`[←] Received from backend: ${data}`);
        }
    });

    ws.on('close', () => {
        isConnected = false;
        console.log('[!] Disconnected from backend. Reconnecting in 3s...');
        setTimeout(connect, 3000);
    });

    ws.on('error', (err) => {
        console.error('[!] WebSocket error:', err.message);
    });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n[*] Shutting down mock sensor...');
    if (ws) {
        ws.close();
    }
    process.exit(0);
});

// Start
console.log('='.repeat(50));
console.log('Mock ESP32 Sensor Client');
console.log('='.repeat(50));
console.log(`Target: ${WS_URL}`);
console.log(`Sample Rate: ${SAMPLE_RATE_MS}ms (${1000 / SAMPLE_RATE_MS}Hz)`);
console.log('='.repeat(50));

connect();
