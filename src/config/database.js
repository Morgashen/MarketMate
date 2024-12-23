const mongoose = require('mongoose');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class DatabaseConnection extends EventEmitter {
  constructor() {
    super(); // Initialize EventEmitter

    this.connection = null;
    this.retryAttempts = 0;
    this.maxRetryAttempts = 5;
    this.baseRetryInterval = 5000; // Base retry interval in milliseconds
    this.isConnecting = false;
    this.connectionStats = {
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      disconnectionCount: 0,
      reconnectionAttempts: 0,
      currentState: 'disconnected',
      lastError: null,
      performance: {
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

      // Attempt connection
      const startTime = Date.now();
      this.connection = await mongoose.connect(process.env.ATLAS_URI, options);
      const connectionTime = Date.now() - startTime;

      // Update performance metrics
      this.updatePerformanceMetrics('responseTime', connectionTime);

      this.setupConnectionMonitoring();
      this.updateConnectionStats('connected');

      logger.info('Successfully connected to MongoDB', {
        connectionTime,
        host: mongoose.connection.host,
        database: mongoose.connection.name
      });

      this.emit('connected'); // Emit connected event
    } catch (error) {
      await this.handleConnectionError(error);
    } finally {
      this.isConnecting = false;
    }
  }

  validateConfig() {
    if (!process.env.ATLAS_URI) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }

    const requiredEnvVars = ['NODE_ENV', 'MONGO_MAX_POOL_SIZE'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  getConnectionOptions() {
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
      monitorCommands: true,
      maxIdleTimeMS: 30000
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
      this.emit('error', finalError); // Emit error event
      throw finalError;
    }
  }

  calculateBackoffTime() {
    const jitter = Math.random() * 1000;
    return Math.min(
      this.baseRetryInterval * Math.pow(2, this.retryAttempts) + jitter,
      30000
    );
  }

  setupConnectionMonitoring() {
    mongoose.connection.on('disconnected', this.handleDisconnection);
    mongoose.connection.on('error', this.handleConnectionError);
  }

  handleDisconnection() {
    this.connectionStats.currentState = 'disconnected';
    this.connectionStats.lastDisconnectedAt = new Date();
    this.connectionStats.disconnectionCount++;
    this.emit('disconnected'); // Emit disconnected event

    logger.warn('MongoDB connection lost');
  }

  updateConnectionStats(state) {
    this.connectionStats.currentState = state;
    if (state === 'connected') {
      this.connectionStats.lastConnectedAt = new Date();
      this.retryAttempts = 0;
    }
  }

  async checkDatabaseHealth() {
    try {
      if (!this.isConnected()) {
        throw new Error('Not connected to the database');
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
        connections: serverStatus.connections,
        memory: serverStatus.mem,
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
      logger.error('Health check failed:', { message: error.message });
      throw error;
    }
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  updatePerformanceMetrics(metric, value) {
    const alpha = 0.2;

    switch (metric) {
      case 'responseTime':
        this.connectionStats.performance.averageResponseTime =
          alpha * value + (1 - alpha) * this.connectionStats.performance.averageResponseTime;
        break;
      case 'queryCount':
        this.connectionStats.performance.queryCount += value;
        break;
    }
  }
}

module.exports = new DatabaseConnection();