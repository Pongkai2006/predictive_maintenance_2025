/**
 * Configuration Module
 * Centralized configuration management for the WebSocket server
 */

// Server Configuration
module.exports = {
    // Server Port (from environment or default)
    PORT: parseInt(process.env.PORT) || 8765,
    HOST: process.env.HOST || '0.0.0.0',

    // ML Model Configuration
    WINDOW_SIZE: parseInt(process.env.WINDOW_SIZE) || 10,
    CONFIDENCE_THRESHOLD: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.7,
    MODEL_PATH: process.env.MODEL_PATH || 'pdm_binary.pkl',
    ML_SCRIPT_PATH: process.env.ML_SCRIPT_PATH || 'ml_predict.py',

    // Connection Limits
    MAX_SENSOR_CLIENTS: parseInt(process.env.MAX_SENSOR_CLIENTS) || 10,
    MAX_DASHBOARD_CLIENTS: parseInt(process.env.MAX_DASHBOARD_CLIENTS) || 50,

    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'

    // Health Check
    HEALTH_CHECK_PATH: '/health',

    // WebSocket Paths
    SENSOR_PATH: '/sensor',
    DASHBOARD_PATH: '/',

    // Development Mode
    NODE_ENV: process.env.NODE_ENV || 'development',
    IS_PRODUCTION: process.env.NODE_ENV === 'production',

    // Buffer Configuration
    DATA_BUFFER_SIZE: parseInt(process.env.DATA_BUFFER_SIZE) || 10,

    // Rate Limiting (future feature)
    RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED === 'true',
    MAX_MESSAGES_PER_SECOND: parseInt(process.env.MAX_MESSAGES_PER_SECOND) || 100,
};
