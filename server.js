require('dotenv').config();
const express = require('express');
const config = require('config');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const connectDB = require('./config/db');
const { getApiInfo, renderApiDocumentation } = require('./utils/documentation');
const { errorHandler } = require('./middleware/errorHandler');

class Server {
    constructor() {
        // Initialize core server properties
        this.app = express();
        this.environment = process.env.NODE_ENV || 'development';
        this.port = process.env.PORT || 5000;
        this.server = null;
        this.startupTime = Date.now();

        // Database health tracking
        this.dbHealthy = false;
        this.lastDbCheck = null;
        this.dbCheckInterval = 30000; // 30 seconds

        // Server metrics
        this.metrics = {
            requestsTotal: 0,
            requestsActive: 0,
            errors: 0,
            lastRestart: new Date().toISOString()
        };

        // Initialize server components
        this.initialize();
    }

    initialize() {
        // Configure basic Express settings
        this.app.set('case sensitive routing', false);
        this.app.set('strict routing', false);
        this.app.set('trust proxy', 1); // Important for rate limiting behind proxies

        // Setup core functionality in the correct order
        this.setupRequestHandling();
        this.setupSecurity();
        this.setupMetrics();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupRequestHandling() {
        // Handle request tracking and timing
        this.app.use((req, res, next) => {
            req.id = crypto.randomUUID();
            req.startTime = Date.now();

            // Wrap send method to ensure headers are set only once
            const originalSend = res.send;
            res.send = function (...args) {
                if (!res.headersSent) {
                    res.setHeader('X-Request-ID', req.id);
                    const duration = Date.now() - req.startTime;
                    res.setHeader('X-Response-Time', `${duration}ms`);
                }
                return originalSend.apply(this, args);
            };

            next();
        });

        // Normalize URLs
        this.app.use((req, res, next) => {
            req.url = req.url.toLowerCase();
            if (req.url.endsWith('/') && req.url.length > 1) {
                req.url = req.url.slice(0, -1);
            }
            next();
        });

        // Setup database connection
        if (this.environment !== 'test') {
            this.connectDatabase();
            this.setupDatabaseHealthCheck();
        }

        // Configure request parsing with enhanced error handling
        this.app.use(express.json({
            limit: '10mb',
            verify: (req, res, buf) => {
                try {
                    JSON.parse(buf);
                } catch (e) {
                    if (!res.headersSent) {
                        res.status(400).json({
                            status: 'error',
                            message: 'Invalid JSON in request body',
                            details: e.message
                        });
                    }
                    throw new Error('Invalid JSON');
                }
            }
        }));

        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Setup logging based on environment
        this.setupLogging();
    }

    setupLogging() {
        morgan.token('reqId', (req) => req.id);
        morgan.token('body', (req) => {
            const sanitizedBody = { ...req.body };
            // Remove sensitive data from logs
            ['password', 'token', 'apiKey', 'secret'].forEach(key => {
                if (sanitizedBody[key]) sanitizedBody[key] = '****';
            });
            return JSON.stringify(sanitizedBody);
        });

        const logFormat = this.environment === 'development'
            ? ':reqId :method :url :status :response-time ms - :body'
            : ':reqId :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]';

        this.app.use(morgan(logFormat, {
            skip: (req) => req.url === '/health' || req.url === '/metrics'
        }));
    }

    setupSecurity() {
        // Configure Helmet security middleware
        const helmetOptions = {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"]
                }
            },
            crossOriginEmbedderPolicy: true,
            crossOriginOpenerPolicy: true,
            crossOriginResourcePolicy: { policy: "same-site" },
            dnsPrefetchControl: true,
            frameguard: { action: 'deny' },
            hidePoweredBy: true,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            },
            ieNoOpen: true,
            noSniff: true,
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
            xssFilter: true
        };

        this.app.use(helmet(helmetOptions));

        // Configure rate limiting
        const standardLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                status: 'error',
                message: 'Too many requests, please try again later.'
            }
        });

        const authLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 5,
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                status: 'error',
                message: 'Too many authentication attempts, please try again later.'
            }
        });

        this.app.use('/api/', standardLimiter);
        this.app.use('/api/auth', authLimiter);

        // Configure CORS
        const corsOptions = {
            origin: this.environment === 'production'
                ? config.get('allowedOrigins')
                : '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
            exposedHeaders: [
                'X-Request-ID',
                'X-Response-Time',
                'X-RateLimit-Limit',
                'X-RateLimit-Remaining',
                'X-RateLimit-Reset',
                'x-total-count',
                'x-pagination'
            ],
            credentials: true,
            maxAge: 600 // 10 minutes
        };

        this.app.use(cors(corsOptions));
    }

    setupMetrics() {
        // Track request metrics
        this.app.use((req, res, next) => {
            this.metrics.requestsTotal++;
            this.metrics.requestsActive++;

            res.on('finish', () => {
                this.metrics.requestsActive--;
                if (res.statusCode >= 400) {
                    this.metrics.errors++;
                }
            });

            next();
        });

        // Metrics endpoint
        this.app.get('/metrics', (req, res) => {
            const metrics = {
                requests: {
                    total: this.metrics.requestsTotal,
                    active: this.metrics.requestsActive,
                    errors: this.metrics.errors
                },
                system: {
                    uptime: {
                        seconds: process.uptime(),
                        formatted: this.formatUptime(process.uptime() * 1000)
                    },
                    memory: this.formatMemoryUsage(),
                    node: process.version
                },
                server: {
                    environment: this.environment,
                    startTime: new Date(this.startupTime).toISOString(),
                    uptime: this.formatUptime(Date.now() - this.startupTime),
                    lastRestart: this.metrics.lastRestart
                }
            };

            res.json(metrics);
        });
    }

    setupRoutes() {
        const apiPrefix = '/api';

        // Core API routes
        this.app.use(`${apiPrefix}/auth`, require('./routes/auth'));
        this.app.use(`${apiPrefix}/products`, require('./routes/products'));
        this.app.use(`${apiPrefix}/cart`, require('./routes/cart'));
        this.app.use(`${apiPrefix}/orders`, require('./routes/orders'));
        this.app.use(`${apiPrefix}/shipments`, require('./routes/shipments'));
        this.app.use(`${apiPrefix}/payments`, require('./routes/payments'));

        // API documentation route
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
        this.app.get('/health', async (req, res) => {
            try {
                const dbStatus = await this.checkDatabaseHealth();
                const uptime = Date.now() - this.startupTime;

                const systemHealth = {
                    status: dbStatus ? 'healthy' : 'degraded',
                    timestamp: new Date().toISOString(),
                    environment: this.environment,
                    uptime: {
                        ms: uptime,
                        formatted: this.formatUptime(uptime)
                    },
                    services: {
                        database: {
                            status: dbStatus ? 'connected' : 'disconnected',
                            lastCheck: this.lastDbCheck,
                            latency: await this.checkDbLatency()
                        },
                        api: {
                            memory: this.formatMemoryUsage(),
                            uptime: process.uptime(),
                            pid: process.pid,
                            nodeVersion: process.version
                        }
                    }
                };

                res.status(dbStatus ? 200 : 503).json(systemHealth);
            } catch (error) {
                console.error('Health check failed:', error);
                res.status(500).json({
                    status: 'error',
                    message: 'Error checking system health',
                    error: this.environment === 'development' ? error.message : undefined
                });
            }
        });

        this.app.get('/ping', (_, res) => res.status(200).send('pong'));
    }

    setupErrorHandling() {
        // Handle 404 errors
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

    // Utility methods
    formatMemoryUsage() {
        const memory = process.memoryUsage();
        return {
            heapUsed: this.formatBytes(memory.heapUsed),
            heapTotal: this.formatBytes(memory.heapTotal),
            rss: this.formatBytes(memory.rss),
            external: this.formatBytes(memory.external)
        };
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
    }

    // Database methods
    connectDatabase() {
        connectDB().catch(error => {
            console.error('Database connection failed:', error);
            process.exit(1);
        });
    }

    async checkDatabaseHealth() {
        try {
            if (mongoose.connection.readyState !== 1) return false;
            await mongoose.connection.db.admin().ping();
            this.dbHealthy = true;
            this.lastDbCheck = new Date().toISOString();
            return true;
        } catch (error) {
            this.dbHealthy = false;
            console.error('Database health check failed:', error);
            return false;
        }
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

    setupDatabaseHealthCheck() {
        setInterval(() => this.checkDatabaseHealth(), this.dbCheckInterval);
    }

    // Server lifecycle methods
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
            // First, stop accepting new requests by closing the server
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(resolve);
                });
                console.log('Server closed successfully');
            }

            // Next, wait for any pending database operations to complete
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.close();
                console.log('Database connection closed successfully');
            }

            // Log final metrics before shutdown
            console.log('Final server metrics:', {
                totalRequests: this.metrics.requestsTotal,
                totalErrors: this.metrics.errors,
                uptime: this.formatUptime(Date.now() - this.startupTime)
            });

            console.log('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            console.error('Error during graceful shutdown:', error);
            process.exit(1);
        }
    }
}

// Create and export server instance with error handling
const createServer = () => {
    try {
        const server = new Server();

        // Export a clean interface for external use
        return {
            app: server.app,
            start: () => server.start(),
            stop: () => server.gracefulShutdown('MANUAL_STOP'),
            server
        };
    } catch (error) {
        console.error('Failed to create server instance:', error);
        process.exit(1);
    }
};

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
    const { start } = createServer();
    start().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = createServer();