/**
 * Connection Manager
 * Manages WebSocket client connections and broadcasting
 */

const logger = require('./logger');
const config = require('./config');

class ConnectionManager {
    constructor() {
        this.sensorClients = new Set();
        this.dashboardClients = new Set();
    }

    // Add sensor client
    addSensor(ws) {
        if (this.sensorClients.size >= config.MAX_SENSOR_CLIENTS) {
            logger.warn('Max sensor clients reached, rejecting new connection');
            return false;
        }
        this.sensorClients.add(ws);
        logger.connection('SENSOR', ws._socket.remoteAddress);
        return true;
    }

    // Add dashboard client
    addDashboard(ws) {
        if (this.dashboardClients.size >= config.MAX_DASHBOARD_CLIENTS) {
            logger.warn('Max dashboard clients reached, rejecting new connection');
            return false;
        }
        this.dashboardClients.add(ws);
        logger.connection('DASHBOARD', ws._socket.remoteAddress);
        return true;
    }

    // Remove sensor client
    removeSensor(ws) {
        this.sensorClients.delete(ws);
        logger.disconnection('Sensor');
    }

    // Remove dashboard client
    removeDashboard(ws) {
        this.dashboardClients.delete(ws);
        logger.disconnection('Dashboard');
    }

    // Broadcast to all dashboard clients
    async broadcastToDashboard(data) {
        if (this.dashboardClients.size === 0) {
            return;
        }

        const message = JSON.stringify(data);
        const toRemove = new Set();

        for (const client of this.dashboardClients) {
            if (client.readyState === 1) { // OPEN
                try {
                    await client.send(message);
                } catch (err) {
                    logger.error('Broadcast error:', err.message);
                    toRemove.add(client);
                }
            } else {
                toRemove.add(client);
            }
        }

        // Clean up closed connections
        for (const client of toRemove) {
            this.dashboardClients.delete(client);
        }

        if (toRemove.size > 0) {
            logger.debug(`Removed ${toRemove.size} closed dashboard connections`);
        }
    }

    // Get connection counts
    getCounts() {
        return {
            sensors: this.sensorClients.size,
            dashboards: this.dashboardClients.size,
            total: this.sensorClients.size + this.dashboardClients.size
        };
    }

    // Get server stats
    getStats() {
        return {
            connections: this.getCounts(),
            limits: {
                maxSensors: config.MAX_SENSOR_CLIENTS,
                maxDashboards: config.MAX_DASHBOARD_CLIENTS
            }
        };
    }
}

module.exports = new ConnectionManager();
