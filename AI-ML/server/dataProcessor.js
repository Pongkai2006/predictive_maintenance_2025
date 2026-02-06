/**
 * Data Processor
 * Handles buffering and feature extraction for ML predictions
 */

const config = require('./config');
const logger = require('./logger');

class DataProcessor {
    constructor() {
        this.buffer = [];
        this.maxBufferSize = config.DATA_BUFFER_SIZE;
    }

    /**
     * Add new data point to buffer
     * @param {number} x - X-axis acceleration
     * @param {number} y - Y-axis acceleration
     * @param {number} z - Z-axis acceleration
     * @returns {boolean} True if buffer is full and ready for prediction
     */
    addDataPoint(x, y, z) {
        this.buffer.push([
            parseFloat(x),
            parseFloat(y),
            parseFloat(z)
        ]);

        // Keep buffer at max size
        if (this.buffer.length > this.maxBufferSize) {
            this.buffer.shift();
        }

        // Return true if we have enough data for prediction
        return this.buffer.length >= config.WINDOW_SIZE;
    }

    /**
     * Get current window for ML prediction
     * @returns {Array<Array<number>>} Window data
     */
    getWindow() {
        return this.buffer.slice(-config.WINDOW_SIZE);
    }

    /**
     * Get buffer status
     * @returns {Object} Buffer statistics
     */
    getStatus() {
        return {
            size: this.buffer.length,
            capacity: this.maxBufferSize,
            ready: this.buffer.length >= config.WINDOW_SIZE,
            fillPercentage: (this.buffer.length / this.maxBufferSize * 100).toFixed(1)
        };
    }

    /**
     * Clear the buffer
     */
    clear() {
        this.buffer = [];
        logger.info('Data buffer cleared');
    }

    /**
     * Reset buffer size
     * @param {number} newSize - New buffer size
     */
    resize(newSize) {
        this.maxBufferSize = newSize;
        while (this.buffer.length > newSize) {
            this.buffer.shift();
        }
        logger.info(`Buffer resized to ${newSize}`);
    }
}

module.exports = new DataProcessor();
