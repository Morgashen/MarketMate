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

/**
 * Server class that handles all aspects of the Express application
 * Including middleware setup, routing, database connection, and error handling
 */
class Server {
    /**
     * Initialize server instance with default configuration
     */
    constructor() {
        this.app = express();
        this.environment = process.env.NODE_ENV || 'development';
        this.port = process.env.PORT || 5000;
        this.server = null;
        this.startupTime = Date.now();
        this.mountedRoutes = new Set();
        this.dbConnected = false;

        // Database health monitoring properties
        this.dbHealthy = false;
        this.lastDbCheck = null;
        this.dbCheckInterval = 30000; // Check DB health every 30 seconds

        this.initialize();
    }

    /**
     * Configure initial server settings and setup all middleware
     */
    initialize() {
        this.app.set('case sensitive routing', false);
        this.app.set('strict routing', false);
        this.app.set('trust proxy', 1); // Required for rate limiting behind reverse proxy

        this.setupRequestHandling();
        this.setupSecurity();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Configure request processing middleware and JSON parsing
     */
    setupRequestHandling() {
        // Add unique request ID and timing information to each request
        this.app.use((req, res, next) => {
            req.id = crypto.randomUUID();
            req.startTime = Date.now();

            // Extend response.send to include timing headers
            const originalSend = res.send;
            res.send = function (...args) {
                if (!res.headersSent) {
                    res.setHeader('X-Request-ID', req.id);
                    res.setHeader('X-Response-Time', `${Date.now() - req.startTime}ms`);
                }
                return originalSend.apply(this, args);
            };
            next();
        });

        // Normalize URLs to lowercase and remove trailing slashes
        this.app.use((req, res, next) => {
            req.url = req.url.toLowerCase();
            if (req.url.endsWith('/') && req.url.length > 1) {
                req.url = req.url.slice(0, -1);
            }
            next();
        });

        // Connect to database except in test environment
        if (this.environment !== 'test') {
            this.connectDatabase();
            this.setupDatabaseHealthCheck();
        }

        // Configure JSON body parsing with size limits and validation
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

        this.setupLogging();
    }

    /**
     * Configure request logging with Morgan
     * Includes custom tokens for request ID and sanitized request body
     */
    setupLogging() {
        morgan.token('reqId', (req) => req.id);
        morgan.token('body', (req) => {
            const sanitizedBody = { ...req.body };
            // Remove sensitive information from logs
            ['password', 'token', 'apiKey', 'secret'].forEach(key => {
                if (sanitizedBody[key]) sanitizedBody[key] = '****';
            });
            return JSON.stringify(sanitizedBody);
        });

        // Use different log formats for development and production
        const logFormat = this.environment === 'development'
            ? ':reqId :method :url :status :response-time ms - :body'
            : ':reqId :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]';

        // Skip logging health check endpoints
        this.app.use(morgan(logFormat, {
            skip: (req) => req.url === '/health',
            stream: { write: (message) => console.log(message.trim()) }
        }));
    }

    /**
     * Configure security middleware including Helmet, rate limiting, and CORS
     */
    setupSecurity() {
        // Configure Helmet security headers
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
            // Additional security headers
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

        // Configure rate limiting for general API endpoints
        const standardLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                status: 'error',
                message: 'Too many requests, please try again later.'
            }
        });

        // Stricter rate limiting for authentication endpoints
        const authLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 5, // Limit each IP to 5 authentication attempts per windowMs
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                status: 'error',
                message: 'Too many authentication attempts, please try again later.'
            }
        });

        this.app.use('/api/', standardLimiter);
        this.app.use('/api/auth', authLimiter);

        // Configure CORS settings
        const corsOptions = {
            origin: this.environment === 'production'
                ? config.get('allowedOrigins')
                : '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
            exposedHeaders: [
                'X-Request-ID',
                'X-Response-Time',
                'X-RateLimit-Limit',
                'X-RateLimit-Remaining',
                'X-RateLimit-Reset'
            ],
            credentials: true,
            maxAge: 600 // Cache preflight requests for 10 minutes
        };

        this.app.use(cors(corsOptions));
    }

    /**
     * Set up API routes and documentation endpoints
     */
    setupRoutes() {
        const apiRouter = express.Router({ mergeParams: true });

        // Add request logging in development environment
        if (this.environment === 'development') {
            apiRouter.use((req, res, next) => {
                console.log('API Request:', {
                    method: req.method,
                    path: req.path,
                    originalUrl: req.originalUrl,
                    params: req.params,
                    query: req.query,
                    timestamp: new Date().toISOString()
                });
                next();
            });
        }

        // Define available route modules
        const routeModules = {
            auth: './routes/auth',
            products: './routes/products',
            cart: './routes/cart',
            orders: './routes/orders',
            shipments: './routes/shipments',
            payments: './routes/payments'
        };

        // Dynamically load and mount route modules
        Object.entries(routeModules).forEach(([name, path]) => {
            if (this.mountedRoutes.has(path)) return;

            try {
                const router = require(path);
                if (!router || typeof router !== 'function') {
                    throw new Error(`Invalid router exported from ${path}`);
                }
                apiRouter.use(`/${name}`, router);
                this.mountedRoutes.add(path);
            } catch (error) {
                console.error(`Failed to load ${name} routes:`, error);
                // Create placeholder router for failed modules
                const placeholderRouter = express.Router();
                placeholderRouter.all('*', (req, res) => {
                    res.status(503).json({
                        status: 'error',
                        message: `${name} service is temporarily unavailable`,
                        error: this.environment === 'development' ? error.message : undefined
                    });
                });
                apiRouter.use(`/${name}`, placeholderRouter);
            }
        });

        this.app.use('/api', apiRouter);

        // Serve API documentation at root
        this.app.get('/', (req, res) => {
            const apiInfo = getApiInfo(this.environment);
            const htmlContent = renderApiDocumentation(apiInfo);
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Cache-Control', 'no-store');
            res.send(htmlContent);
        });

        this.setupHealthChecks();

        // Handle 404 for unknown API endpoints
        apiRouter.use('*', (req, res) => {
            res.status(404).json({
                status: 'error',
                message: `API endpoint ${req.originalUrl} not found`,
                suggestedEndpoints: Object.keys(routeModules).map(route => `/api/${route}`)
            });
        });
    }

    /**
     * Set up health check endpoints for monitoring
     */
    setupHealthChecks() {
        // Detailed health check endpoint
        this.app.get('/health', async (req, res) => {
            try {
                const dbStatus = await this.checkDatabaseHealth();
                const uptime = Date.now() - this.startupTime;

                res.status(dbStatus ? 200 : 503).json({
                    status: dbStatus ? 'healthy' : 'degraded',
                    timestamp: new Date().toISOString(),
                    environment: this.environment,
                    uptime,
                    services: {
                        database: {
                            status: dbStatus ? 'connected' : 'disconnected',
                            lastCheck: this.lastDbCheck,
                            latency: await this.checkDbLatency()
                        }
                    }
                });
            } catch (error) {
                console.error('Health check failed:', error);
                res.status(500).json({
                    status: 'error',
                    message: 'Error checking system health',
                    error: this.environment === 'development' ? error.message : undefined
                });
            }
        });

        // Simple ping endpoint for basic availability checks
        this.app.get('/ping', (_, res) => res.status(200).send('pong'));
    }

    /**
     * Configure global error handling middleware
     */
    setupErrorHandling() {
        // Handle 404 errors for unknown routes
        this.app.use((req, res, next) => {
            const error = new Error(`Route ${req.url} not found`);
            error.status = 404;
            error.statusCode = 404;
            next(error);
        });

        // Use custom error handler middleware
        this.app.use(errorHandler);
    }

    /**
     * Establish database connection
     */
    async connectDatabase() {
        if (this.environment !== 'test') {
            try {
                await connectDB();
            } catch (error) {
                console.error('Database connection failed:', error);
                process.exit(1);
            }
        }
    }

    /**
     * Set up periodic database health checks
     */
    setupDatabaseHealthCheck() {
        setInterval(() => this.checkDatabaseHealth(), this.dbCheckInterval);
    }

    /**
     * Check database connection health
     * @returns {Promise<boolean>} Database health status
     */
    async checkDatabaseHealth() {
        try {
            if (mongoose.connection.readyState !== 1) {
                await this.connectDatabase();
            }

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

    /**
     * Measure database response time
     * @returns {Promise<number|null>} Response time in milliseconds or null if check fails
     */
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

    /**
     * Start the server
     * @returns {Promise<http.Server|Express>} Server instance
     */
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
                } else {
                    resolve(this.app);
                }
            } catch (error) {
                console.error('Failed to start server:', error);
                reject(error);
            }
        });
    }

} // End of Server class

/**
 * Factory function to create a new server instance
 * @returns {Object} Object containing server instance, app, and control methods
 */
const createServer = () => {
    try {
        // Create new server instance
        const server = new Server();

        // Return server instance and control methods
        return {
            app: server.app,
            start: () => server.start(),
            server
        };
    } catch (error) {
        console.error('Failed to create server instance:', error);
        process.exit(1);
    }
};

// Start the server automatically if not in test environment
if (process.env.NODE_ENV !== 'test') {
    // Get start method from server instance
    const { start } = createServer();

    // Start the server and handle any startup errors
    start().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

// Export server instance for use in other parts of the application
module.exports = createServer();