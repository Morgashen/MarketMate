require('dotenv').config(); // Load environment variables
const express = require('express');
const config = require('config');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');

// Import API documentation function
const getApiInfo = require('./config/apiDocs');
const { renderApiDocumentation } = require('./views/documentation');

// Initialize Express application
const app = express();

// Determine current environment (default to development)
const environment = process.env.NODE_ENV || 'development';
console.log(`Application environment: ${environment}`);

// Database Connection
// Only connect to database if not in test environment to allow for isolated testing
if (environment !== 'test') {
    connectDB();
}

// Security Middleware
// Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet());

// CORS (Cross-Origin Resource Sharing) Configuration
// Dynamically set based on environment to control API access
const corsOptions = {
    // In production, use configured allowed origins; in development, allow all
    origin: environment === 'production' ? config.get('allowedOrigins') : '*',

    // Supported HTTP methods
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],

    // Allowed headers for cross-origin requests
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
};
app.use(cors(corsOptions));

// Request Parsing Middleware
// Parse incoming JSON payloads with a size limit
app.use(express.json({ limit: '10mb' }));
// Parse incoming URL-encoded payloads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging Middleware
// Different logging formats for development and production
if (environment === 'development') {
    // Detailed logging for development environment
    app.use(morgan('dev'));
} else if (environment === 'production') {
    // More condensed logging for production
    app.use(morgan('combined'));
}

// API Routes
// Centralize route management for different API resources
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/payments', require('./routes/payments'));

// Root Route - Serve Dynamic HTML API Documentation
app.get('/', (req, res) => {
    // Generate API information based on current environment
    const apiInfo = getApiInfo(environment);

    // Render full HTML documentation
    const htmlContent = renderApiDocumentation(apiInfo);

    // Set content type to HTML and send the documentation page
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
});

// Health Check Endpoints
// Provides system status information
app.get('/health', (req, res) => {
    // Comprehensive health check with system metrics
    const systemHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuLoad: process.cpuUsage(),

        // Optional: Add more detailed system or application-specific health checks
        database: 'connected', // You might want to add actual database connection check
        cacheStatus: 'operational', // If using caching
        externalServices: {
            paymentGateway: 'operational',
            emailService: 'operational'
        }
    };

    res.status(200).json(systemHealth);
});

// Simple ping endpoint for quick availability check
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});


// Catches requests to undefined routes
app.use((req, res, next) => {
    if (req.url === '/favicon.ico') {
        return res.status(204).end(); // No content, but successful
    }

    // For other undefined routes, proceed with the original 404 handling
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});

// Global Error Handling Middleware
// Provides different error responses based on environment
app.use((err, req, res, next) => {
    // Determine appropriate status code
    const statusCode = err.statusCode || 500;

    // Detailed error info in development
    if (environment === 'development') {
        console.error(err.stack);
        res.status(statusCode).json({
            message: err.message,
            stack: err.stack,
            error: err
        });
    } else {
        // Minimal error info in production for security
        res.status(statusCode).json({
            message: statusCode === 500 ? 'Internal Server Error' : err.message
        });
    }
});

// Server Initialization
let server;
if (environment !== 'test') {
    // Select port from environment or use default
    const PORT = process.env.PORT || 5000;

    // Start the server
    server = app.listen(PORT, () => {
        console.log(`Server Running in ${environment} mode on port ${PORT}`);
        console.log(`MarketMate Api Available at http://localhost:${PORT}`);
    });

    // Handle Unhandled Promise Rejections
    // Prevents silent failures and ensures graceful shutdown
    process.on('unhandledRejection', (err) => {
        console.error('Unhandled Promise Rejection:', err);
        // Close server and exit process
        server.close(() => process.exit(1));
    });

    // Handle SIGTERM (termination signal)
    // Allows for graceful shutdown of the server
    process.on('SIGTERM', () => {
        console.log('SIGTERM received. Shutting down gracefully...');
        server.close(() => {
            console.log('Process terminated.');
            process.exit(0);
        });
    });
}

// Export app and server for potential testing or external use
module.exports = { app, server };