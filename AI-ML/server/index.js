/**
 * Main WebSocket Server
 * Entry point for the refactored predictive maintenance backend
 */

const { WebSocketServer } = require('ws');
const http = require('http');
const config = require('./config');
const logger = require('./logger');
const connectionManager = require('./connectionManager');
const mlService = require('./mlService');
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
                dataProcessor.addDataPoint(item.X, item.Y, item.Z);

                // Mock AI prediction (no Python needed - instant, reliable)
                // Calculate vibration magnitude
                const magnitude = Math.sqrt(item.X * item.X + item.Y * item.Y + item.Z * item.Z);

                // Simple algorithm: higher vibration = higher probability of bad state
                // Typical good vibration: 9-11 m/s² (gravity dominated)
                // Bad vibration: >12 m/s² (excessive movement)
                const baseline = 10.0; // Normal gravity + small vibration
                const deviation = Math.abs(magnitude - baseline);

                // Calculate probability (0.0 to 1.0)
                // Low deviation (<1) -> 0-20% bad
                // Medium deviation (1-3) -> 20-60% bad  
                // High deviation (>3) -> 60-100% bad
                const prob_bad = Math.min(0.95, deviation / 5.0);
                const state = prob_bad > 0.6 ? 'BAD' : 'GOOD';

                const currentInference = {
                    state: state,
                    prob_bad: prob_bad,
                    timestamp: Date.now()
                };

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

// Validate ML model on startup
async function startup() {
    const modelValid = await mlService.validateModel();

    if (!modelValid) {
        logger.error('ML model validation failed. Server will start but predictions may not work.');
        logger.error(`Please ensure ${config.MODEL_PATH} exists and Python dependencies are installed.`);
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
