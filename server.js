require('dotenv').config();
const express = require('express');
const config = require('config');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { getApiInfo, renderApiDocumentation } = require('./utils/documentation');
const { errorHandler } = require('./middleware/errorHandler');

class Server {
    constructor() {
        this.app = express();
        this.app.set('case sensitive routing', false);
        this.app.set('strict routing', false);
        this.environment = process.env.NODE_ENV || 'development';
        this.port = process.env.PORT || 5000;
        this.server = null;

        // Initialize components
        this.initializeMiddleware();
        this.setupSecurity();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    initializeMiddleware() {
        this.app.use((req, res, next) => {
            req.url = req.url.toLowerCase();
            if (req.url.endsWith('/') && req.url.length > 1) {
                req.url = req.url.slice(0, -1);
            }
            next();
        });
        // Connect to database if not in test environment
        if (this.environment !== 'test') {
            this.connectDatabase();
        }

        // Basic middleware setup
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Logging setup based on environment
        if (this.environment === 'development') {
            this.app.use(morgan('dev'));
        } else if (this.environment === 'production') {
            this.app.use(morgan('combined'));
        }
    }

    setupSecurity() {
        // Security middleware
        this.app.use(helmet());

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        });
        this.app.use('/api/', limiter);

        // CORS configuration
        const corsOptions = {
            origin: this.environment === 'production'
                ? config.get('allowedOrigins')
                : '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            exposedHeaders: ['x-total-count', 'x-pagination'],
            credentials: true,
            maxAge: 600 // 10 minutes
        };
        this.app.use(cors(corsOptions));
    }

    setupRoutes() {
        // API version prefix
        const apiPrefix = '/api';

        // Core API routes
        this.app.use(`${apiPrefix}/auth`, require('./routes/auth'));
        this.app.use(`${apiPrefix}/products`, require('./routes/products'));
        this.app.use(`${apiPrefix}/cart`, require('./routes/cart'));
        this.app.use(`${apiPrefix}/orders`, require('./routes/orders'));
        this.app.use(`${apiPrefix}/shipments`, require('./routes/shipments'));
        this.app.use(`${apiPrefix}/payments`, require('./routes/payments'));

        // Documentation route
        this.app.get('/', (req, res) => {
            const apiInfo = getApiInfo(this.environment);
            const htmlContent = renderApiDocumentation(apiInfo);
            res.setHeader('Content-Type', 'text/html');
            res.send(htmlContent);
        });

        // Health check routes
        this.setupHealthChecks();
    }

    setupHealthChecks() {
        // Detailed health check
        this.app.get('/health', async (req, res) => {
            try {
                const dbStatus = mongoose.connection.readyState === 1;

                const systemHealth = {
                    status: dbStatus ? 'healthy' : 'degraded',
                    timestamp: new Date().toISOString(),
                    environment: this.environment,
                    services: {
                        database: {
                            status: dbStatus ? 'connected' : 'disconnected',
                            latency: await this.checkDbLatency()
                        },
                        api: {
                            uptime: process.uptime(),
                            memory: process.memoryUsage(),
                            cpu: process.cpuUsage()
                        }
                    }
                };

                const statusCode = dbStatus ? 200 : 503;
                res.status(statusCode).json(systemHealth);
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: 'Error checking system health',
                    error: this.environment === 'development' ? error.message : undefined
                });
            }
        });

        // Simple ping endpoint
        this.app.get('/ping', (_, res) => res.status(200).send('pong'));
    }

    async checkDbLatency() {
        if (mongoose.connection.readyState !== 1) return null;

        const start = Date.now();
        try {
            await mongoose.connection.db.admin().ping();
            return Date.now() - start;
        } catch (error) {
            console.error('Database ping failed:', error);
            return null;
        }
    }

    setupErrorHandling() {
        // Handle 404s
        this.app.use((req, res, next) => {
            if (req.url === '/favicon.ico') {
                return res.status(204).end();
            }
            const error = new Error(`Route ${req.url} not found`);
            error.status = 404;
            next(error);
        });

        // Global error handler
        this.app.use(errorHandler(this.environment));
    }

    connectDatabase() {
        connectDB().catch(error => {
            console.error('Database connection failed:', error);
            process.exit(1);
        });
    }

    async start() {
        return new Promise((resolve, reject) => {
            try {
                if (this.environment !== 'test') {
                    this.server = this.app.listen(this.port, () => {
                        console.log(`
🚀 Server Running:
   - Environment: ${this.environment}
   - Port: ${this.port}
   - URL: http://localhost:${this.port}
                        `);
                        resolve(this.server);
                    });

                    this.setupProcessHandlers();
                } else {
                    resolve(this.app);
                }
            } catch (error) {
                console.error('Failed to start server:', error);
                reject(error);
            }
        });
    }

    setupProcessHandlers() {
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (error) => {
            console.error('Unhandled Promise Rejection:', error);
            this.gracefulShutdown('UNHANDLED_REJECTION');
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            this.gracefulShutdown('UNCAUGHT_EXCEPTION');
        });

        // Handle termination signals
        ['SIGTERM', 'SIGINT'].forEach(signal => {
            process.on(signal, () => this.gracefulShutdown(signal));
        });
    }

    async gracefulShutdown(signal) {
        console.log(`\n${signal} received. Starting graceful shutdown...`);

        try {
            // Close server
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(resolve);
                });
                console.log('Server closed successfully');
            }

            // Close database connection
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.close();
                console.log('Database connection closed successfully');
            }

            console.log('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            console.error('Error during graceful shutdown:', error);
            process.exit(1);
        }
    }
}

// Create and export server instance
const server = new Server();

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
    server.start().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = {
    app: server.app,
    start: () => server.start(),
    stop: () => server.gracefulShutdown('MANUAL_STOP'),
    server
};