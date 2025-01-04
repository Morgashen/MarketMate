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
        this.app = express();
        this.environment = process.env.NODE_ENV || 'development';
        this.port = process.env.PORT || 5000;
        this.server = null;
        this.startupTime = Date.now();
        this.mountedRoutes = new Set();
        this.dbConnected = false;

        this.dbHealthy = false;
        this.lastDbCheck = null;
        this.dbCheckInterval = 30000;

        this.initialize();
    }
    initialize() {
        this.app.set('case sensitive routing', false);
        this.app.set('strict routing', false);
        this.app.set('trust proxy', 1);

        this.setupRequestHandling();
        this.setupSecurity();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupRequestHandling() {
        this.app.use((req, res, next) => {
            req.id = crypto.randomUUID();
            req.startTime = Date.now();

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

        this.app.use((req, res, next) => {
            req.url = req.url.toLowerCase();
            if (req.url.endsWith('/') && req.url.length > 1) {
                req.url = req.url.slice(0, -1);
            }
            next();
        });

        if (this.environment !== 'test') {
            this.connectDatabase();
            this.setupDatabaseHealthCheck();
        }

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

    setupLogging() {
        morgan.token('reqId', (req) => req.id);
        morgan.token('body', (req) => {
            const sanitizedBody = { ...req.body };
            ['password', 'token', 'apiKey', 'secret'].forEach(key => {
                if (sanitizedBody[key]) sanitizedBody[key] = '****';
            });
            return JSON.stringify(sanitizedBody);
        });

        const logFormat = this.environment === 'development'
            ? ':reqId :method :url :status :response-time ms - :body'
            : ':reqId :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]';

        this.app.use(morgan(logFormat, {
            skip: (req) => req.url === '/health',
            stream: { write: (message) => console.log(message.trim()) }
        }));
    }

    setupSecurity() {
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

        const standardLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
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
            maxAge: 600
        };

        this.app.use(cors(corsOptions));
    }

    setupRoutes() {
        const apiRouter = express.Router({ mergeParams: true });

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

        const routeModules = {
            auth: './routes/auth',
            products: './routes/products',
            cart: './routes/cart',
            orders: './routes/orders',
            shipments: './routes/shipments',
            payments: './routes/payments'
        };

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

        this.app.get('/', (req, res) => {
            const apiInfo = getApiInfo(this.environment);
            const htmlContent = renderApiDocumentation(apiInfo);
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Cache-Control', 'no-store');
            res.send(htmlContent);
        });

        this.setupHealthChecks();

        apiRouter.use('*', (req, res) => {
            res.status(404).json({
                status: 'error',
                message: `API endpoint ${req.originalUrl} not found`,
                suggestedEndpoints: Object.keys(routeModules).map(route => `/api/${route}`)
            });
        });
    }

    setupHealthChecks() {
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

        this.app.get('/ping', (_, res) => res.status(200).send('pong'));
    }

    setupErrorHandling() {
        this.app.use((req, res, next) => {
            const error = new Error(`Route ${req.url} not found`);
            error.status = 404;
            error.statusCode = 404;
            next(error);
        });

        this.app.use(errorHandler);
    }

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

    setupDatabaseHealthCheck() {
        setInterval(() => this.checkDatabaseHealth(), this.dbCheckInterval);
    }

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

    async gracefulShutdown(signal) {
        console.log(`\n${signal} received. Starting graceful shutdown...`);

        try {
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(resolve);
                });
                console.log('Server closed successfully');
            }

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

const createServer = () => {
    try {
        const server = new Server();
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

if (process.env.NODE_ENV !== 'test') {
    const { start } = createServer();
    start().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = createServer();