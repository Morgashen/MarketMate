require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const winston = require('winston');
require('winston-daily-rotate-file');
const expressWinston = require('express-winston');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const domain = require('domain');

// Import route modules
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const userRoutes = require('./src/routes/userRoutes');

// Import error handling middleware
const { errorHandler } = require('./src/middlewares/errorHandler');

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;

    // Initialize core components in the correct order
    this.initializeLogger();
    this.initializeMiddlewares();
    this.initializeSecurity();
    this.connectDatabase();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeLogger() {
    // Create rotating file transport for error logs
    const errorFileRotateTransport = new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error'
    });

    // Create rotating file transport for combined logs
    const combinedFileRotateTransport = new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    });

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      defaultMeta: { service: 'market-mate-api' },
      transports: [
        errorFileRotateTransport,
        combinedFileRotateTransport,
        ...(process.env.NODE_ENV !== 'production'
          ? [new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          })]
          : [])
      ]
    });
  }

  initializeMiddlewares() {
    // Add request ID tracking
    this.app.use((req, res, next) => {
      req.id = uuidv4();
      res.setHeader('X-Request-ID', req.id);
      next();
    });

    // Parse JSON and URL-encoded bodies
    this.app.use(
      express.json({
        limit: '10mb',
        strict: true
      })
    );
    this.app.use(
      express.urlencoded({
        extended: false,
        limit: '10mb'
      })
    );

    // Add response time tracking
    this.app.use((req, res, next) => {
      res.locals.startTime = Date.now();
      next();
    });

    // Configure compression
    this.app.use(
      compression({
        level: 6,
        threshold: 10 * 1024,
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        }
      })
    );

    // Configure request logging
    this.app.use(
      expressWinston.logger({
        winstonInstance: this.logger,
        meta: true,
        colorize: false,
        requestWhitelist: ['headers', 'query', 'body'],
        responseWhitelist: ['body'],
        dynamicMeta: (req, res) => {
          return {
            requestId: req.id,
            responseTime: Date.now() - res.locals.startTime
          };
        }
      })
    );
  }

  initializeSecurity() {
    // Configure security headers
    this.app.use(
      helmet({
        hidePoweredBy: true,
        contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
        crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production'
      })
    );

    // Configure CORS
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN
          ? process.env.CORS_ORIGIN.split(',')
          : '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400
      })
    );

    // Configure rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: process.env.RATE_LIMIT_MAX || 100,
      message: 'Too many requests, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.logger.warn('Rate limit exceeded', {
          requestId: req.id,
          ip: req.ip
        });
        res.status(429).json({
          error: 'Too many requests, please try again later',
          status: 429
        });
      }
    });
    this.app.use(limiter);
  }

  async connectDatabase() {
    const uri = process.env.ATLAS_URI;

    if (!uri) {
      this.logger.error('MongoDB connection URI is not defined in environment variables.');
      process.exit(1);
    }

    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2
      });

      // Set up MongoDB connection error handlers
      mongoose.connection.on('error', (error) => {
        this.logger.error('MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        this.logger.warn('MongoDB disconnected');
      });

      this.logger.info('MongoDB connected successfully');
    } catch (error) {
      this.logger.error('MongoDB connection error:', error);
      process.exit(1);
    }
  }

  initializeRoutes() {
    // Health check endpoint with enhanced metrics
    this.app.get('/health', (req, res) => {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const healthCheck = {
        status: 'healthy',
        uptime: {
          seconds: Math.floor(uptime),
          formatted: this.formatUptime(uptime)
        },
        memoryUsage: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
          percentUsed: `${Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)}%`
        },
        database: {
          status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          hosts: mongoose.connection.hosts?.map(host => host.name) || []
        },
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      };
      res.json(healthCheck);
    });

    // Welcome endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Welcome to MarketMate E-commerce API',
        version: process.env.npm_package_version || '1.0.0',
        documentation: process.env.API_DOCS_URL || '/api-docs'
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/products', productRoutes);
    this.app.use('/api/orders', orderRoutes);
    this.app.use('/api/users', userRoutes);
  }

  initializeErrorHandling() {
    // Domain-level error handling
    this.app.use((req, res, next) => {
      const requestDomain = domain.create();
      requestDomain.add(req);
      requestDomain.add(res);

      requestDomain.on('error', (err) => {
        this.logger.error('Domain error caught', {
          error: err,
          requestId: req.id
        });

        try {
          // Failsafe shutdown in 30 seconds
          setTimeout(() => {
            process.exit(1);
          }, 30000);

          // Close server
          if (this.server) {
            this.server.close();
          }

          // Handle the error
          errorHandler(err, req, res, next);
        } catch (error) {
          this.logger.error('Unable to handle domain error', error);
          process.exit(1);
        }
      });

      requestDomain.run(next);
    });

    // Handle 404 errors
    this.app.use((req, res) => {
      res.status(404).json({
        message: 'Endpoint not found',
        status: 404,
        path: req.path
      });
    });

    // Global error handler
    this.app.use((err, req, res, next) => {
      const responseTime = Date.now() - res.locals.startTime;
      this.logger.error('Error occurred', {
        error: err,
        method: req.method,
        path: req.path,
        requestId: req.id,
        responseTime
      });

      errorHandler(err, req, res, next);
    });

    // Handle uncaught exceptions and rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection', {
        reason,
        promise
      });
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);

      if (this.server) {
        this.server.close(() => process.exit(1));
      } else {
        process.exit(1);
      }
    });
  }

  formatUptime(uptime) {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(' ');
  }

  start() {
    this.server = this.app.listen(this.port, () => {
      this.logger.info(`Server running on port ${this.port}`);
      this.logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    const shutdown = async (signal) => {
      this.logger.info(`${signal} received. Starting graceful shutdown`);

      try {
        // Close HTTP server
        await new Promise((resolve, reject) => {
          this.server.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        this.logger.info('HTTP server closed');

        // Close database connection
        await mongoose.connection.close(false);
        this.logger.info('MongoDB connection closed');

        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return this.server;
  }
}

module.exports = new Server();