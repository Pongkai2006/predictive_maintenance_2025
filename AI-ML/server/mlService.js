/**
 * ML Service
 * Interface for machine learning predictions
 */

const { spawn } = require('child_process');
const config = require('./config');
const logger = require('./logger');

class MLService {
    constructor() {
        this.latestInference = {
            state: 'READY',
            prob_bad: 0.0,
            timestamp: Date.now()
        };
    }

    /**
     * Run ML prediction on window data
     * @param {Array<Array<number>>} windowData - Array of [x, y, z] arrays
     * @returns {Promise<Object>} Prediction result
     */
    predict(windowData) {
        return new Promise((resolve, reject) => {
            // Validate input
            if (!Array.isArray(windowData) || windowData.length < config.WINDOW_SIZE) {
                logger.warn(`Invalid window data: got ${windowData?.length || 0} samples, need ${config.WINDOW_SIZE}`);
                resolve(this.latestInference);
                return;
            }

            // CRITICAL: Add timeout to prevent hanging
            const TIMEOUT_MS = 5000; // 5 second timeout
            let timeoutId;
            let pythonProcess;

            // Call Python ML script
            try {
                pythonProcess = spawn('python', [
                    config.ML_SCRIPT_PATH,
                    JSON.stringify(windowData)
                ], {
                    timeout: TIMEOUT_MS,
                    killSignal: 'SIGTERM'
                });
            } catch (err) {
                logger.error('Failed to spawn Python process:', err.message);
                resolve(this.latestInference);
                return;
            }

            let result = '';
            let errorOutput = '';
            let processCompleted = false;

            // Timeout handler
            timeoutId = setTimeout(() => {
                if (!processCompleted && pythonProcess) {
                    logger.error('ML prediction timeout - killing process');
                    pythonProcess.kill('SIGKILL');
                    processCompleted = true;
                    resolve(this.latestInference);
                }
            }, TIMEOUT_MS);

            pythonProcess.stdout.on('data', (data) => {
                result += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (processCompleted) return; // Already handled by timeout
                processCompleted = true;
                clearTimeout(timeoutId);

                if (code === 0) {
                    try {
                        const prediction = JSON.parse(result);

                        // Update inference state
                        this.latestInference = {
                            state: prediction.prob_bad > config.CONFIDENCE_THRESHOLD ? 'BAD' : 'GOOD',
                            prob_bad: prediction.prob_bad,
                            prob_good: prediction.prob_good,
                            timestamp: Date.now()
                        };

                        logger.mlPrediction(this.latestInference.state, this.latestInference.prob_bad);
                        resolve(this.latestInference);

                    } catch (err) {
                        logger.error('ML prediction parse error:', err.message);
                        logger.debug('Raw output:', result);
                        resolve(this.latestInference); // Return last known state
                    }
                } else {
                    logger.error(`Python ML script failed with code ${code}`);
                    if (errorOutput) {
                        logger.error('Python error:', errorOutput);
                    }
                    resolve(this.latestInference); // Return last known state
                }
            });

            pythonProcess.on('error', (err) => {
                if (processCompleted) return;
                processCompleted = true;
                clearTimeout(timeoutId);
                logger.error('Python process error:', err.message);
                resolve(this.latestInference);
            });
        });
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

    /**
     * Validate model availability
     * @returns {Promise<boolean>} True if model is available
     */
    async validateModel() {
        return new Promise((resolve) => {
            const python = spawn('python', ['-c', `import joblib; joblib.load('${config.MODEL_PATH}'); print('OK')`]);

            let output = '';
            python.stdout.on('data', (data) => { output += data.toString(); });

            python.on('close', (code) => {
                if (code === 0 && output.includes('OK')) {
                    logger.info(`✓ ML model validated: ${config.MODEL_PATH}`);
                    resolve(true);
                } else {
                    logger.error(`✗ ML model validation failed: ${config.MODEL_PATH}`);
                    resolve(false);
                }
            });

            python.on('error', () => {
                logger.error('Failed to validate ML model: Python not available');
                resolve(false);
            });
        });
    }
}

module.exports = new MLService();
