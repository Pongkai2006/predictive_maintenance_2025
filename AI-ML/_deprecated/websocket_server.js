/**
 * Node.js WebSocket Server for ESP32 + Dashboard
 * Replaces Python websockets for better ESP32 compatibility with Render proxy
 */

const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 8765;
const WINDOW_SIZE = 10;
const CONFIDENCE_THRESHOLD = 0.7;

// Client tracking
const sensorClients = new Set();
const dashboardClients = new Set();

// Data buffer for ML processing
const dataBuffer = [];

// Latest ML inference result
let latestInference = {
    state: "READY",
    prob_bad: 0.0
};

// Create WebSocket server
const wss = new WebSocketServer({
    port: PORT,
    // Important: No origin checking for ESP32 compatibility
    verifyClient: () => true
});

console.log(`[*] Starting Node.js WebSocket server on port ${PORT}...`);
console.log(`    - /sensor    : Input for ESP32`);
console.log(`    - /          : Output for Dashboard`);

wss.on('connection', (ws, req) => {
    const path = req.url;

    if (path === '/sensor') {
        handleSensorConnection(ws, req);
    } else {
        handleDashboardConnection(ws, req);
    }
});

function handleSensorConnection(ws, req) {
    console.log(`[+] SENSOR CONNECTED: ${req.socket.remoteAddress}`);
    sensorClients.add(ws);

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());

            // Support both single object and array
            const items = Array.isArray(message) ? message : [message];

            items.forEach(item => {
                // Add to buffer
                dataBuffer.push([
                    parseFloat(item.X),
                    parseFloat(item.Y),
                    parseFloat(item.Z)
                ]);

                // Keep buffer size
                if (dataBuffer.length > WINDOW_SIZE) {
                    dataBuffer.shift();
                }

                // Run ML prediction if buffer is full
                if (dataBuffer.length >= WINDOW_SIZE) {
                    runMLPrediction(dataBuffer.slice(-WINDOW_SIZE));
                }

                // Broadcast to dashboard immediately
                broadcastToDashboard({
                    X: item.X,
                    Y: item.Y,
                    Z: item.Z,
                    timestamp: item.timestamp || Date.now(),
                    state: latestInference.state,
                    prob_bad: latestInference.prob_bad,
                    updated_at: Date.now()
                });
            });

        } catch (err) {
            console.error('[!] Error processing sensor data:', err.message);
        }
    });

    ws.on('close', () => {
        sensorClients.delete(ws);
        console.log('[-] Sensor disconnected');
    });

    ws.on('error', (err) => {
        console.error('[!] Sensor WebSocket error:', err.message);
    });
}

function handleDashboardConnection(ws, req) {
    console.log(`[+] Dashboard connected: ${req.socket.remoteAddress}`);
    dashboardClients.add(ws);

    ws.on('close', () => {
        dashboardClients.delete(ws);
        console.log('[-] Dashboard disconnected');
    });

    ws.on('error', (err) => {
        console.error('[!] Dashboard WebSocket error:', err.message);
    });
}

function broadcastToDashboard(data) {
    const message = JSON.stringify(data);

    dashboardClients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            try {
                client.send(message);
            } catch (err) {
                console.error('[!] Broadcast error:', err.message);
            }
        }
    });
}

function runMLPrediction(windowData) {
    // Call Python ML script
    const python = spawn('python', [
        'ml_predict.py',
        JSON.stringify(windowData)
    ]);

    let result = '';

    python.stdout.on('data', (data) => {
        result += data.toString();
    });

    python.on('close', (code) => {
        if (code === 0) {
            try {
                const prediction = JSON.parse(result);
                latestInference = {
                    state: prediction.prob_bad > CONFIDENCE_THRESHOLD ? 'BAD' : 'GOOD',
                    prob_bad: prediction.prob_bad
                };
            } catch (err) {
                console.error('[!] ML prediction parse error:', err.message);
            }
        }
    });

    python.stderr.on('data', (data) => {
        console.error(`[!] Python error: ${data}`);
    });
}

console.log('[+] Server Running. Waiting for connections...\n');
