/**
 * Keep-Alive Service
 * Pings the backend health endpoint every 10 minutes to prevent Render free tier from sleeping
 * Run with: node keep_alive.js
 */

const https = require('https');

const HEALTH_URL = 'https://predictive-maintenance-2025.onrender.com/health';
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes

let pingCount = 0;

function pingServer() {
    pingCount++;
    const startTime = Date.now();

    https.get(HEALTH_URL, (res) => {
        const duration = Date.now() - startTime;
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                const response = JSON.parse(data);
                console.log(`[${new Date().toLocaleTimeString()}] ✅ Ping #${pingCount} successful (${duration}ms)`);
                console.log(`   Server uptime: ${Math.floor(response.uptime)}s`);
                console.log(`   Connections: ${response.connections.total}`);
            } else {
                console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Ping #${pingCount} failed: HTTP ${res.statusCode}`);
            }
        });
    }).on('error', (err) => {
        console.error(`[${new Date().toLocaleTimeString()}] ❌ Ping #${pingCount} error: ${err.message}`);
    });
}

console.log('='.repeat(60));
console.log('Render Keep-Alive Service');
console.log('='.repeat(60));
console.log(`Target: ${HEALTH_URL}`);
console.log(`Interval: ${PING_INTERVAL / 1000}s (${PING_INTERVAL / 60000} minutes)`);
console.log('='.repeat(60));
console.log('\n🟢 Service started. Press Ctrl+C to stop.\n');

// Initial ping
pingServer();

// Schedule periodic pings
setInterval(pingServer, PING_INTERVAL);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping keep-alive service...');
    console.log(`Total pings sent: ${pingCount}`);
    process.exit(0);
});
