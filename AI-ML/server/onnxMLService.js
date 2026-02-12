/**
 * ONNX ML Service
 * Native Node.js ML inference using ONNX Runtime
 * No Python subprocess needed!
 */

const ort = require('onnxruntime-node');
const path = require('path');
const logger = require('./logger');

class ONNXMLService {
    constructor() {
        this.session = null;
        this.latestInference = {
            state: 'READY',
            prob_bad: 0.0,
            timestamp: Date.now()
        };
    }

    /**
     * Initialize ONNX model
     */
    async initialize() {
        try {
            const modelPath = path.join(__dirname, '..', 'pdm_binary.onnx');
            this.session = await ort.InferenceSession.create(modelPath);
            logger.info(`✓ ONNX model loaded: pdm_binary.onnx`);
            return true;
        } catch (err) {
            logger.error('Failed to load ONNX model:', err.message);
            return false;
        }
    }

    /**
     * Extract features from window data (same as Python version)
     * @param {Array<Array<number>>} windowData - Array of [x, y, z] arrays
     * @returns {Array<number>} 13 features
     */
    extractFeatures(windowData) {
        const x = windowData.map(p => p[0]);
        const y = windowData.map(p => p[1]);
        const z = windowData.map(p => p[2]);

        // Calculate magnitude
        const mag = windowData.map(p => Math.sqrt(p[0] ** 2 + p[1] ** 2 + p[2] ** 2));

        // Helper functions
        const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        const std = arr => {
            const m = mean(arr);
            return Math.sqrt(arr.reduce((sum, val) => sum + (val - m) ** 2, 0) / arr.length);
        };
        const rms = arr => Math.sqrt(arr.reduce((sum, val) => sum + val ** 2, 0) / arr.length);
        const max = arr => Math.max(...arr);
        const min = arr => Math.min(...arr);
        const ptp = arr => max(arr) - min(arr);

        // 13 features matching training
        return [
            mean(x), mean(y), mean(z),     // Mean values
            std(x), std(y), std(z),         // Standard deviation
            rms(x), rms(y), rms(z),         // RMS
            mean(mag),                      // Magnitude mean
            max(mag),                       // Magnitude max
            min(mag),                       // Magnitude min
            ptp(mag)                        // Peak-to-peak
        ];
    }

    /**
     * Run ML prediction on window data
     * @param {Array<Array<number>>} windowData - Array of [x, y, z] arrays
     * @returns {Promise<Object>} Prediction result
     */
    async predict(windowData) {
        if (!this.session) {
            logger.warn('ONNX model not initialized');
            return this.latestInference;
        }

        try {
            // Extract features
            const features = this.extractFeatures(windowData);

            // Prepare input tensor (1 x 13 features, FLOAT32)
            const inputTensor = new ort.Tensor('float32', Float32Array.from(features), [1, 13]);

            // Run inference
            const feeds = { float_input: inputTensor };
            const results = await this.session.run(feeds);

            // Get probability output
            // RandomForest classifier outputs probabilities for each class
            const probabilities = results.probabilities.data; // [prob_good, prob_bad]
            const prob_bad = probabilities[1];

            // Update inference state
            this.latestInference = {
                state: prob_bad > 0.7 ? 'BAD' : 'GOOD', // 0.7 threshold from training
                prob_bad: prob_bad,
                prob_good: probabilities[0],
                timestamp: Date.now()
            };

            logger.mlPrediction(this.latestInference.state, this.latestInference.prob_bad);
            return this.latestInference;

        } catch (err) {
            logger.error('ONNX prediction error:', err.message);
            return this.latestInference; // Return last known state
        }
    }

    /**
     * Get the latest inference result without running prediction
     * @returns {Object} Latest inference
     */
    getLatest() {
        return this.latestInference;
    }

    /**
     * Reset inference to initial state
     */
    reset() {
        this.latestInference = {
            state: 'READY',
            prob_bad: 0.0,
            timestamp: Date.now()
        };
        logger.info('ML inference state reset');
    }
}

module.exports = new ONNXMLService();
