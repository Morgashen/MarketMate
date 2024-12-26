const express = require('express');
const healthRoutes = require('./health');
// Import other route modules here

const setupRoutes = (app) => {
    // Mount health check routes
    app.use('/health', healthRoutes);

    // Mount other routes here
    // app.use('/api/users', userRoutes);
    // app.use('/api/products', productRoutes);
    // etc.

    // Root route for API information
    app.get('/', (req, res) => {
        res.json({
            name: app.locals.title,
            version: app.locals.version,
            environment: process.env.NODE_ENV || 'development',
            documentation: '/api-docs', // If you have API documentation
            health: '/health'
        });
    });
};

module.exports = setupRoutes;