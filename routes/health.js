const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { logger } = require('../config/logging');

// Helper function to check MongoDB connection
const checkMongoConnection = () => {
    const state = mongoose.connection.readyState;
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };
    return states[state] || 'unknown';
};

// Basic health check endpoint
router.get('/', (req, res) => {
    const healthStatus = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'MarketMate API',
        version: process.env.npm_package_version || '1.0.0',
        mongodb: checkMongoConnection()
    };

    // Check if all critical services are running
    if (healthStatus.mongodb !== 'connected') {
        healthStatus.status = 'degraded';
        logger.warn('Health check indicated degraded service', healthStatus);
        return res.status(503).json(healthStatus);
    }

    logger.info('Health check passed', healthStatus);
    res.json(healthStatus);
});

// Detailed health check for internal monitoring
router.get('/detailed', (req, res) => {
    const detailedStatus = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        system: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version,
            platform: process.platform
        },
        services: {
            mongodb: {
                status: checkMongoConnection(),
                host: mongoose.connection.host
            }
        },
        environment: process.env.NODE_ENV
    };

    // Add Redis status if you're using Redis
    if (process.env.REDIS_HOST) {
        detailedStatus.services.redis = {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT
        };
    }

    // Check all services and set overall status
    if (detailedStatus.services.mongodb.status !== 'connected') {
        detailedStatus.status = 'degraded';
        logger.warn('Detailed health check indicated degraded service', detailedStatus);
        return res.status(503).json(detailedStatus);
    }

    logger.info('Detailed health check passed', detailedStatus);
    res.json(detailedStatus);
});

module.exports = router;