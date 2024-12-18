require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const winston = require('winston');
const expressWinston = require('express-winston');
const rateLimit = require('express-rate-limit');

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
    
    this.initializeLogger();
    this.initializeMiddlewares();
    this.connectDatabase();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeLogger() {
    // Advanced logging with Winston
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      defaultMeta: { service: 'market-mate-api' },
      transports: [
        // Write all logs with importance level of `error` or less to `error.log`
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        // Write all logs with importance level of `info` or less to `combined.log`
        new winston.transports.File({ filename: 'combined.log' }),
        // Log to console if not in production
        ...(process.env.NODE_ENV !== 'production' 
          ? [new winston.transports.Console({
              format: winston.format.simple()
            })] 
          : [])
      ]
    });
  }

  initializeMiddlewares() {
    // Security middlewares
    this.app.use(helmet({
      // Disable X-Powered-By header for additional security
      hidePoweredBy: true,
      // More granular CSP if needed
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
    }));

    // Improved CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN 
        ? process.env.CORS_ORIGIN.split(',') 
        : '*', // Support multiple origins
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true, // Allow credentials if needed
      maxAge: 86400 // Preflight request caching
    }));

    // Advanced rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests, please try again later',
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      handler: (req, res) => {
        res.status(429).json({
          error: 'Too many requests, please try again later',
          status: 429
        });
      }
    });
    this.app.use(limiter);

    // Logging middleware
    this.app.use(expressWinston.logger({
      winstonInstance: this.logger,
      meta: true,
      colorize: false
    }));

    // Parsing middlewares with increased security
    this.app.use(express.json({ 
      limit: '10mb',
      strict: true // Only accept objects and arrays
    }));
    this.app.use(express.urlencoded({ 
      extended: false, // Use simpler parsing
      limit: '10mb'
    }));

    // Compression with threshold
    this.app.use(compression({
      level: 6, // Compression level
      threshold: 10 * 1024, // Only compress files larger than 10kb
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          // Don't compress responses with this header
          return false;
        }
        // Fallback to standard filter function
        return compression.filter(req, res);
      }
    }));

    // Health check middleware
    this.app.use((req, res, next) => {
      res.locals.startTime = Date.now();
      next();
    });
  }

  async connectDatabase() {
    try {
      // Use connection pooling and more robust connection options
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        maxPoolSize: 10, // Maintain up to 10 socket connections
        minPoolSize: 2,  // Keep at least 2 socket connections
      });
      this.logger.info('MongoDB connected successfully');
    } catch (error) {
      this.logger.error('MongoDB connection error:', error);
      process.exit(1);
    }
  }

  initializeRoutes() {
    // Performance monitoring endpoint
    this.app.get('/health', (req, res) => {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      res.json({
        status: 'healthy',
        uptime: `${Math.floor(uptime)} seconds`,
        memoryUsage: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external
        },
        timestamp: new Date().toISOString()
      });
    });

    // Base route
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Welcome to MarketMate E-commerce API',
        version: '1.0.0'
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/products', productRoutes);
    this.app.use('/api/orders', orderRoutes);
    this.app.use('/api/users', userRoutes);
  }

  initializeErrorHandling() {
    // Logging for unhandled rejections and exceptions
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
      // Graceful shutdown
      process.exit(1);
    });

    // 404 handler
    this.app.use((req, res, next) => {
      res.status(404).json({
        message: 'Endpoint not found',
        status: 404
      });
    });

    // Global error handler with response time logging
    this.app.use((err, req, res, next) => {
      // Log response time
      const responseTime = Date.now() - res.locals.startTime;
      this.logger.error(`Error occurred, response time: ${responseTime}ms`, {
        error: err,
        method: req.method,
        path: req.path
      });

      // Call the original error handler
      errorHandler(err, req, res, next);
    });
  }

  start() {
    const server = this.app.listen(this.port, () => {
      this.logger.info(`Server running on port ${this.port}`);
      this.logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Improved graceful shutdown
    const shutdown = (signal) => {
      this.logger.info(`${signal} received. Starting graceful shutdown`);
      
      server.close(() => {
        this.logger.info('HTTP server closed');
        
        // Close database connection
        mongoose.connection.close(false, () => {
          this.logger.info('MongoDB connection closed');
          process.exit(0);
        });
      });

      // Force close server after 10 seconds
      setTimeout(() => {
        this.logger.error('Could not close connections, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  }
}

module.exports = new Server();
