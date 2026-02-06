/**
 * Logging Service
 * Structured logging with different levels
 */

const config = require('./config');

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const COLORS = {
    debug: '\x1b[36m',   // Cyan
    info: '\x1b[32m',    // Green  
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'
};

const currentLevel = LOG_LEVELS[config.LOG_LEVEL] || LOG_LEVELS.info;

function log(level, message, data = null) {
    if (LOG_LEVELS[level] < currentLevel) {
        return;
    }

    const timestamp = new Date().toISOString();
    const color = COLORS[level] || '';
    const reset = COLORS.reset;
    const prefix = `${color}[${timestamp}] [${level.toUpperCase()}]${reset}`;

    if (data) {
        console.log(`${prefix} ${message}`, data);
    } else {
        console.log(`${prefix} ${message}`);
    }
}

module.exports = {
    debug: (message, data) => log('debug', message, data),
    info: (message, data) => log('info', message, data),
    warn: (message, data) => log('warn', message, data),
    error: (message, data) => log('error', message, data),

    // Special logging for connections
    connection: (type, address) => {
        log('info', `${type} connected: ${address}`);
    },

    disconnection: (type) => {
        log('info', `${type} disconnected`);
    },

    // Special logging for data flow
    dataReceived: (count) => {
        log('debug', `Received ${count} data points`);
    },

    dataBroadcast: (count) => {
        log('debug', `Broadcast to ${count} clients`);
    },

    // ML prediction logging
    mlPrediction: (state, prob_bad) => {
        const emoji = state === 'BAD' ? '⚠️' : '✓';
        log('info', `${emoji} ML Prediction: ${state} (confidence: ${(prob_bad * 100).toFixed(1)}%)`);
    }
};
