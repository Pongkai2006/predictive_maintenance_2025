/**
 * Main WebSocket Server
 * Entry point for the refactored predictive maintenance backend
 */

const { WebSocketServer } = require('ws');
const http = require('http');
const config = require('./config');
const logger = require('./logger');
const connectionManager = require('./connectionManager');
const mlService = require('./onnxMLService'); // Use ONNX ML Service (native Node.js)
const dataProcessor = require('./dataProcessor');

// Initialize HTTP server for health checks
const server = http.createServer((req, res) => {
    if (req.url === config.HEALTH_CHECK_PATH) {
        const stats = connectionManager.getStats();
        const bufferStatus = dataProcessor.getStatus();
        const latestInference = mlService.getLatest();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'OK',
            uptime: process.uptime(),
            connections: stats.connections,
            buffer: bufferStatus,
            latestInference: {
                state: latestInference.state,
                prob_bad: latestInference.prob_bad,
                age: Date.now() - latestInference.timestamp
            },
            config: {
                windowSize: config.WINDOW_SIZE,
                confidenceThreshold: config.CONFIDENCE_THRESHOLD
            }
        }, null, 2));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

logger.info('='.repeat(50));
logger.info('Predictive Maintenance WebSocket Server');
logger.info('='.repeat(50));
logger.info(`Environment: ${config.NODE_ENV}`);
logger.info(`Port: ${config.PORT}`);
logger.info(`ML Model: ${config.MODEL_PATH}`);
logger.info(`Window Size: ${config.WINDOW_SIZE}`);
logger.info(`Confidence Threshold: ${config.CONFIDENCE_THRESHOLD}`);
logger.info('='.repeat(50));

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
    const path = req.url;

    if (path === config.SENSOR_PATH) {
        handleSensorConnection(ws, req);
    } else {
        handleDashboardConnection(ws, req);
    }
});

/**
 * Handle sensor (ESP32) connections
 */
function handleSensorConnection(ws, req) {
    if (!connectionManager.addSensor(ws)) {
        ws.close(1008, 'Max sensor clients reached');
        return;
    }

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());

            // Support both single object and array
            const items = Array.isArray(message) ? message : [message];

            for (const item of items) {
                // Validate data
                if (typeof item.X !== 'number' || typeof item.Y !== 'number' || typeof item.Z !== 'number') {
                    logger.warn('Invalid sensor data format:', item);
                    continue;
                }

                // Add to buffer
                const isReady = dataProcessor.addDataPoint(item.X, item.Y, item.Z);

                // ONNX ML prediction (Native Node.js - no Python subprocess!)
                let currentInference = mlService.getLatest();

                if (isReady) {
                    const windowData = dataProcessor.getWindow();
                    try {
                        currentInference = await mlService.predict(windowData);
                    } catch (err) {
                        logger.error('ML prediction failed:', err.message);
                        // Continue with last known state
                    }
                }

                // Broadcast to dashboard immediately (zero latency)
                await connectionManager.broadcastToDashboard({
                    X: item.X,
                    Y: item.Y,
                    Z: item.Z,
                    timestamp: item.timestamp || Date.now(),
                    state: currentInference.state,
                    prob_bad: currentInference.prob_bad,
                    updated_at: Date.now()
                });
            }

        } catch (err) {
            logger.error('Error processing sensor data:', err.message);
        }
    });

    ws.on('close', () => {
        connectionManager.removeSensor(ws);
    });

    ws.on('error', (err) => {
        logger.error('Sensor WebSocket error:', err.message);
    });

    // Heartbeat: respond to ping with pong
    ws.on('ping', () => {
        ws.pong();
    });

    ws.on('pong', () => {
        // Keep connection alive
    });
}

/**
 * Handle dashboard connections
 */
function handleDashboardConnection(ws, req) {
    if (!connectionManager.addDashboard(ws)) {
        ws.close(1008, 'Max dashboard clients reached');
        return;
    }

    ws.on('close', () => {
        connectionManager.removeDashboard(ws);
    });

    ws.on('error', (err) => {
        logger.error('Dashboard WebSocket error:', err.message);
    });

    // Heartbeat: respond to ping with pong
    ws.on('ping', () => {
        ws.pong();
    });

    ws.on('pong', () => {
        // Keep connection alive
    });
}

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
    logger.info('\nShutting down gracefully...');

    wss.clients.forEach(client => {
        client.close(1000, 'Server shutting down');
    });

    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Forced shutdown');
        process.exit(1);
    }, 10000);
}

// Initialize ONNX model on startup
async function startup() {
    const modelLoaded = await mlService.initialize();

    if (!modelLoaded) {
        logger.error('ONNX model initialization failed. Server will start but predictions may not work.');
        logger.error(`Please ensure pdm_binary.onnx exists.`);
    }

    // Start server
    server.listen(config.PORT, config.HOST, () => {
        logger.info(`\n✓ Server running on ${config.HOST}:${config.PORT}`);
        logger.info(`  - Health check: http://localhost:${config.PORT}${config.HEALTH_CHECK_PATH}`);
        logger.info(`  - Sensor endpoint: ws://localhost:${config.PORT}${config.SENSOR_PATH}`);
        logger.info(`  - Dashboard endpoint: ws://localhost:${config.PORT}${config.DASHBOARD_PATH}\n`);
        logger.info('Waiting for connections...\n');
    });
}

// Start the server
startup();
