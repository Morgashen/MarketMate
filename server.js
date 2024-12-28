// server.js
require('dotenv').config(); // Load environment variables
const express = require('express');
const config = require('config');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Import API documentation function
const getApiInfo = require('./config/apiDocs');
const { renderApiDocumentation } = require('./views/documentation');

class Server {
    constructor() {
        this.app = express();
        this.environment = process.env.NODE_ENV || 'development';
        this.port = process.env.PORT || 5000;
        this.server = null;

        console.log(`Application environment: ${this.environment}`);

        this.initializeMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    initializeMiddleware() {
        // Database Connection
        if (this.environment !== 'test') {
            this.connectDatabase();
        }

        // Security Middleware
        this.app.use(helmet());

        // CORS Configuration
        const corsOptions = {
            origin: this.environment === 'production' ? config.get('allowedOrigins') : '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
        };
        this.app.use(cors(corsOptions));

        // Request Parsing Middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Logging Middleware
        if (this.environment === 'development') {
            this.app.use(morgan('dev'));
        } else if (this.environment === 'production') {
            this.app.use(morgan('combined'));
        }
    }

    setupRoutes() {
        // API Routes
        this.app.use('/api/auth', require('./routes/auth'));
        this.app.use('/api/products', require('./routes/products'));
        this.app.use('/api/cart', require('./routes/cart'));
        this.app.use('/api/orders', require('./routes/orders'));
        this.app.use('/api/shipments', require('./routes/shipments'));
        this.app.use('/api/payments', require('./routes/payments'));

        // Root Route - Serve Dynamic HTML API Documentation
        this.app.get('/', (req, res) => {
            const apiInfo = getApiInfo(this.environment);
            const htmlContent = renderApiDocumentation(apiInfo);
            res.setHeader('Content-Type', 'text/html');
            res.send(htmlContent);
        });

        // Health Check Endpoints
        this.app.get('/health', (req, res) => {
            const systemHealth = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                environment: this.environment,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                cpuLoad: process.cpuUsage(),
                database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                cacheStatus: 'operational',
                externalServices: {
                    paymentGateway: 'operational',
                    emailService: 'operational'
                }
            };

            res.status(200).json(systemHealth);
        });

        // Simple ping endpoint
        this.app.get('/ping', (req, res) => {
            res.status(200).send('pong');
        });
    }

    setupErrorHandling() {
        // Favicon handler
        this.app.use((req, res, next) => {
            if (req.url === '/favicon.ico') {
                return res.status(204).end();
            }
            next();
        });

        // 404 Handler
        this.app.use((req, res, next) => {
            const error = new Error('Not Found');
            error.status = 404;
            next(error);
        });

        // Global Error Handler
        this.app.use((err, req, res, next) => {
            const statusCode = err.statusCode || 500;

            if (this.environment === 'development') {
                console.error(err.stack);
                res.status(statusCode).json({
                    message: err.message,
                    stack: err.stack,
                    error: err
                });
            } else {
                res.status(statusCode).json({
                    message: statusCode === 500 ? 'Internal Server Error' : err.message
                });
            }
        });
    }

    connectDatabase() {
        connectDB();
    }

    async start() {
        return new Promise((resolve, reject) => {
            if (this.environment !== 'test') {
                this.server = this.app.listen(this.port, () => {
                    console.log(`Server Running in ${this.environment} mode on port ${this.port}`);
                    console.log(`MarketMate Api Available at http://localhost:${this.port}`);
                    resolve(this.server);
                }).on('error', reject);

                // Handle Unhandled Promise Rejections
                process.on('unhandledRejection', (err) => {
                    console.error('Unhandled Promise Rejection:', err);
                    this.server.close(() => process.exit(1));
                });

                // Handle SIGTERM
                process.on('SIGTERM', () => {
                    console.log('SIGTERM received. Shutting down gracefully...');
                    this.server.close(() => {
                        console.log('Process terminated.');
                        process.exit(0);
                    });
                });
            } else {
                resolve(this.app);
            }
        });
    }

    async stop() {
        return new Promise((resolve, reject) => {
            if (this.server) {
                this.server.close((err) => {
                    if (err) {
                        console.error('Error closing server:', err);
                        reject(err);
                    } else {
                        console.log('Server closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }

            // Close mongoose connection if open
            if (mongoose.connection.readyState === 1) {
                mongoose.connection.close()
                    .then(() => console.log('Database connection closed'))
                    .catch(console.error);
            }
        });
    }
}

// Create server instance
const server = new Server();

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
    server.start();
}

// Export for testing
module.exports = {
    app: server.app,
    start: () => server.start(),
    stop: () => server.stop(),
    server
};