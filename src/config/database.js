const mongoose = require('mongoose');
const logger = require('../utils/logger');

class DatabaseConnection {
  constructor() {
    // Initialize with more detailed connection tracking
    this.connection = null;
    this.retryAttempts = 0;
    this.maxRetryAttempts = 5;
    this.baseRetryInterval = 5000; // Base retry interval for exponential backoff
    this.isConnecting = false;
    this.connectionStats = {
      lastConnectedAt: null,
      lastDisconnectedAt: null,  // New field to track disconnection time
      disconnectionCount: 0,
      reconnectionAttempts: 0,
      currentState: 'disconnected',
      lastError: null,  // Track the last error for better diagnostics
      performance: {    // New section for performance metrics
        averageResponseTime: 0,
        peakConnections: 0,
        queryCount: 0
      }
    };

    // Bind methods to preserve context
    this.handleConnectionError = this.handleConnectionError.bind(this);
    this.handleDisconnection = this.handleDisconnection.bind(this);
  }

  async connect() {
    if (this.isConnecting) {
      logger.warn('Connection attempt already in progress', {
        currentState: this.connectionStats.currentState,
        retryAttempt: this.retryAttempts
      });
      return;
    }

    this.isConnecting = true;

    try {
      // Validate environment configuration
      this.validateConfig();

      const options = this.getConnectionOptions();

      // Attempt connection with enhanced monitoring
      const startTime = Date.now();
      this.connection = await mongoose.connect(process.env.MONGODB_URI, options);
      const connectionTime = Date.now() - startTime;

      // Update performance metrics
      this.updatePerformanceMetrics('connectionTime', connectionTime);

      this.setupConnectionMonitoring();
      this.updateConnectionStats('connected');

      logger.info('Successfully connected to MongoDB', {
        connectionTime,
        host: mongoose.connection.host,
        database: mongoose.connection.name
      });

      return this.connection;
    } catch (error) {
      await this.handleConnectionError(error);
    } finally {
      this.isConnecting = false;
    }
  }

  validateConfig() {
    if (!process.env.MONGODB_URI) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }

    // Validate other critical configuration parameters
    const requiredEnvVars = ['NODE_ENV', 'MONGO_MAX_POOL_SIZE'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  getConnectionOptions() {
    // Enhanced connection options with better defaults and validation
    return {
      maxPoolSize: this.validatePoolSize(process.env.MONGO_MAX_POOL_SIZE, 10),
      minPoolSize: this.validatePoolSize(process.env.MONGO_MIN_POOL_SIZE, 2),
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      family: 4,
      autoIndex: process.env.NODE_ENV !== 'production',
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true
      },
      // Add connection monitoring plugins
      monitorCommands: true,
      maxIdleTimeMS: 30000  // Close idle connections after 30 seconds
    };
  }

  validatePoolSize(value, defaultValue) {
    const poolSize = parseInt(value, 10);
    if (isNaN(poolSize) || poolSize < 1) {
      logger.warn(`Invalid pool size: ${value}, using default: ${defaultValue}`);
      return defaultValue;
    }
    return poolSize;
  }

  async handleConnectionError(error) {
    // Calculate exponential backoff time
    const backoffTime = this.calculateBackoffTime();

    this.connectionStats.lastError = {
      message: error.message,
      code: error.code,
      timestamp: new Date()
    };

    logger.error('Database connection error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      retryAttempt: this.retryAttempts + 1,
      maxRetries: this.maxRetryAttempts,
      backoffTime
    });

    if (this.retryAttempts < this.maxRetryAttempts) {
      this.retryAttempts++;
      this.connectionStats.reconnectionAttempts++;

      logger.info(`Retrying connection in ${backoffTime / 1000} seconds`, {
        attempt: this.retryAttempts,
        maxAttempts: this.maxRetryAttempts
      });

      await new Promise(resolve => setTimeout(resolve, backoffTime));
      return this.connect();
    } else {
      const finalError = new Error('Failed to connect to database after maximum retry attempts');
      finalError.originalError = error;
      throw finalError;
    }
  }

  calculateBackoffTime() {
    // Implement exponential backoff with jitter
    const jitter = Math.random() * 1000;
    return Math.min(
      this.baseRetryInterval * Math.pow(2, this.retryAttempts) + jitter,
      30000 // Maximum backoff of 30 seconds
    );
  }

  async checkDatabaseHealth() {
    try {
      if (!this.isConnected()) {
        return;
      }

      const startTime = Date.now();
      const adminDb = this.connection.connection.db.admin();
      const [serverStatus, dbStats] = await Promise.all([
        adminDb.serverStatus(),
        this.connection.connection.db.stats()
      ]);

      const responseTime = Date.now() - startTime;

      // Update performance metrics
      this.updatePerformanceMetrics('responseTime', responseTime);

      const healthMetrics = {
        responseTime,
        connections: {
          current: serverStatus.connections.current,
          available: serverStatus.connections.available,
          totalCreated: serverStatus.connections.totalCreated
        },
        memory: {
          resident: serverStatus.mem.resident,
          virtual: serverStatus.mem.virtual,
          mapped: serverStatus.mem.mapped
        },
        storage: {
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes
        },
        operations: serverStatus.opcounters
      };

      logger.info('Database health metrics:', healthMetrics);
      return healthMetrics;
    } catch (error) {
      logger.error('Health check failed:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  updatePerformanceMetrics(metric, value) {
    // Exponential moving average for continuous metrics
    const alpha = 0.2; // Smoothing factor

    switch (metric) {
      case 'responseTime':
        this.connectionStats.performance.averageResponseTime =
          alpha * value + (1 - alpha) * this.connectionStats.performance.averageResponseTime;
        break;
      case 'connections':
        this.connectionStats.performance.peakConnections =
          Math.max(value, this.connectionStats.performance.peakConnections);
        break;
      case 'queryCount':
        this.connectionStats.performance.queryCount += value;
        break;
    }
  }
}

module.exports = new DatabaseConnection();