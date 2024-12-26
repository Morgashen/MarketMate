const { logger } = require('../config/logging');

const setupErrorHandling = (app) => {
    // Handle 404 errors
    app.use((req, res, next) => {
        const error = new Error('Not Found');
        error.status = 404;
        next(error);
    });

    // Global error handler
    app.use((error, req, res, next) => {
        const status = error.status || 500;
        const message = error.message || 'Internal Server Error';

        // Log the error
        logger.error('Error occurred:', {
            error: {
                message: error.message,
                stack: error.stack,
                status: status
            },
            request: {
                method: req.method,
                url: req.url,
                body: req.body,
                params: req.params,
                query: req.query
            }
        });

        // Send error response
        res.status(status).json({
            error: {
                message: process.env.NODE_ENV === 'production' && status === 500
                    ? 'Internal Server Error'
                    : message
            }
        });
    });
};

module.exports = {
    setupErrorHandling
};