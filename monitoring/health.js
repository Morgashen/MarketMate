const os = require('os');
const mongoose = require('mongoose');
const logger = require('../config/logger');

class ServerMonitor {
    constructor() {
        this.startTime = Date.now();
        this.metrics = {
            requests: 0,
            errors: 0,
            activeUsers: 0
        };
    }

    // Get basic server health metrics
    getHealthMetrics() {
        const uptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60);

        return {
            status: 'healthy',
            uptime: uptimeHours.toFixed(2) + ' hours',
            timestamp: new Date().toISOString(),
            memory: {
                total: Math.round(os.totalmem() / (1024 * 1024)) + 'MB',
                free: Math.round(os.freemem() / (1024 * 1024)) + 'MB',
                usage: Math.round((1 - os.freemem() / os.totalmem()) * 100) + '%'
            },
            cpu: {
                cores: os.cpus().length,
                loadAvg: os.loadavg()
            },
            database: {
                connected: mongoose.connection.readyState === 1,
                collections: Object.keys(mongoose.connection.collections).length
            },
            traffic: {
                totalRequests: this.metrics.requests,
                errorCount: this.metrics.errors,
                activeUsers: this.metrics.activeUsers,
                errorRate: (this.metrics.errors / this.metrics.requests * 100 || 0).toFixed(2) + '%'
            }
        };
    }

    // Middleware to track requests
    requestTracker() {
        return (req, res, next) => {
            this.metrics.requests++;

            // Track response status
            const originalSend = res.send;
            res.send = function (data) {
                if (res.statusCode >= 400) {
                    this.metrics.errors++;
                }
                originalSend.apply(res, arguments);
            }.bind(this);

            // Log request details
            logger.request(`${req.method} ${req.url} - IP: ${req.ip}`);

            next();
        };
    }

    // Monitor system resources
    startResourceMonitoring(interval = 5 * 60 * 1000) { // Default: 5 minutes
        setInterval(() => {
            const metrics = this.getHealthMetrics();

            // Log warnings if resources are strained
            if (parseInt(metrics.memory.usage) > 90) {
                logger.warn('High memory usage detected:', metrics.memory.usage);
            }

            if (metrics.cpu.loadAvg[0] > os.cpus().length) {
                logger.warn('High CPU load detected:', metrics.cpu.loadAvg[0]);
            }

            // Log general health status
            logger.info('Server health check:', metrics);
        }, interval);
    }

    // Database monitoring
    monitorDatabase() {
        mongoose.connection.on('error', (err) => {
            logger.error('Database error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('Database disconnected');
        });

        // Monitor for slow queries (adjust threshold as needed)
        mongoose.set('debug', (collectionName, method, query, doc) => {
            const start = Date.now();
            return () => {
                const timeTaken = Date.now() - start;
                if (timeTaken > 1000) { // Log queries taking more than 1 second
                    logger.warn('Slow query detected:', {
                        collection: collectionName,
                        method,
                        query,
                        timeTaken: timeTaken + 'ms'
                    });
                }
            };
        });
    }
}

// Create and export monitor instance
const monitor = new ServerMonitor();
module.exports = monitor;