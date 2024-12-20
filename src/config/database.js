const mongoose = require('mongoose');
const logger = require('../utils/logger');

class DatabaseConnection {
  constructor() {
    this.connection = null;
    this.retryAttempts = 0;
    this.maxRetryAttempts = 5;
    this.retryInterval = 5000; // 5 seconds
    this.isConnecting = false;
    this.connectionStats = {
      lastConnectedAt: null,
      disconnectionCount: 0,
      reconnectionAttempts: 0,
      currentState: 'disconnected'
    };
  }

  async connect() {
    if (this.isConnecting) {
      logger.warn('Connection attempt already in progress');
      return;
    }

    this.isConnecting = true;

    try {
      if (!process.env.MONGODB_URI) {
        throw new Error('MongoDB URI is not defined in environment variables');
      }

      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) || 10,
        minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE, 10) || 2,
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
        }
      };

      this.connection = await mongoose.connect(process.env.MONGODB_URI, options);
      this.setupConnectionMonitoring();
      this.connectionStats.lastConnectedAt = new Date();
      this.connectionStats.currentState = 'connected';
      this.retryAttempts = 0;

      logger.info('Successfully connected to MongoDB');
      return this.connection;
    } catch (error) {
      this.handleConnectionError(error);
    } finally {
      this.isConnecting = false;
    }
  }

  setupConnectionMonitoring() {
    mongoose.connection.on('connected', () => {
      this.connectionStats.currentState = 'connected';
      this.connectionStats.lastConnectedAt = new Date();
      logger.info('Mongoose connected to database');
      this.emitConnectionStats();
    });

    mongoose.connection.on('error', (err) => {
      this.connectionStats.currentState = 'error';
      logger.error('Mongoose connection error:', { error: err.message, stack: err.stack });
      this.handleConnectionError(err);
    });

    mongoose.connection.on('disconnected', () => {
      this.connectionStats.currentState = 'disconnected';
      this.connectionStats.disconnectionCount++;
      logger.warn('Mongoose disconnected from database');
      this.handleDisconnection();
    });

    // Monitor for specific collection errors
    mongoose.connection.on('fullsetup', () => {
      logger.info('All replicas are connected');
    });

    // Monitor server heartbeat
    if (mongoose.connection.db) {
      setInterval(() => {
        this.checkDatabaseHealth();
      }, 30000); // Check every 30 seconds
    }
  }

  async handleConnectionError(error) {
    logger.error('Database connection error:', {
      message: error.message,
      stack: error.stack,
      retryAttempt: this.retryAttempts + 1,
      maxRetries: this.maxRetryAttempts
    });

    if (this.retryAttempts < this.maxRetryAttempts) {
      this.retryAttempts++;
      this.connectionStats.reconnectionAttempts++;

      logger.info(`Retrying connection attempt ${this.retryAttempts} of ${this.maxRetryAttempts} in ${this.retryInterval / 1000} seconds`);

      setTimeout(async () => {
        await this.connect();
      }, this.retryInterval);
    } else {
      logger.error('Max retry attempts reached. Please check your database configuration.');
      throw new Error('Failed to connect to database after maximum retry attempts');
    }
  }

  handleDisconnection() {
    if (this.connectionStats.currentState !== 'reconnecting') {
      this.connectionStats.currentState = 'reconnecting';
      this.connect().catch(error => {
        logger.error('Failed to reconnect:', error);
      });
    }
  }

  async checkDatabaseHealth() {
    try {
      if (this.connection && mongoose.connection.readyState === 1) {
        const adminDb = this.connection.connection.db.admin();
        const serverStatus = await adminDb.serverStatus();

        // Log important metrics
        logger.info('Database health check:', {
          connections: serverStatus.connections,
          activeConnections: serverStatus.globalLock?.activeClients?.total || 0,
          memory: serverStatus.mem,
          opCounters: serverStatus.opcounters
        });
      }
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.connection.close();
        this.connection = null;
        this.connectionStats.currentState = 'disconnected';
        logger.info('Database connection closed successfully');
      }
    } catch (error) {
      logger.error('Error closing database connection:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  getConnection() {
    return this.connection;
  }

  getConnectionStats() {
    return {
      ...this.connectionStats,
      readyState: mongoose.connection.readyState,
      collections: mongoose.connection.collections ? Object.keys(mongoose.connection.collections).length : 0,
      models: mongoose.connection.models ? Object.keys(mongoose.connection.models).length : 0
    };
  }

  emitConnectionStats() {
    const stats = this.getConnectionStats();
    logger.info('Connection stats:', stats);
    return stats;
  }

  // Utility method to check if connection is ready
  isConnected() {
    return mongoose.connection.readyState === 1;
  }
}

module.exports = new DatabaseConnection();