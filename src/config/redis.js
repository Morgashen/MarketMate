const Redis = require('redis');
const logger = require('../utils/logger');

class RedisConnection {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.connectionStats = {
      lastConnectedAt: null,
      disconnectionCount: 0,
      reconnectionAttempts: 0,
      operationCount: 0,
      errors: []
    };
    this.healthCheckInterval = null;
    this.subscriptions = new Map();
  }

  async connect() {
    try {
      const redisConfig = this._getRedisConfig();
      this.client = Redis.createClient(redisConfig);

      // Create separate clients for pub/sub to avoid blocking
      this.subscriber = this.client.duplicate();
      this.publisher = this.client.duplicate();

      await this._setupEventListeners();
      await this._connectClients();
      this._startHealthCheck();

      return this.client;
    } catch (error) {
      logger.error('Redis connection error:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  _getRedisConfig() {
    return {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 5000,
        keepAlive: 5000,
        reconnectStrategy: (retries) => this._handleReconnectStrategy(retries)
      },
      commandsQueueMaxLength: 100000,
      readonly: process.env.REDIS_READONLY === 'true',
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DATABASE, 10) || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 1000, 5000);
        return delay;
      }
    };
  }

  _handleReconnectStrategy(retries) {
    const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES, 10) || 5;
    if (retries > maxRetries) {
      logger.error('Unable to connect to Redis after multiple attempts');
      return new Error('Redis connection failed');
    }
    this.connectionStats.reconnectionAttempts = retries;
    return Math.min(retries * 1000, 5000); // Cap at 5 seconds
  }

  async _setupEventListeners() {
    const setupListeners = (client, name) => {
      client.on('connect', () => {
        logger.info(`Redis ${name} client connected`);
        this.connectionStats.lastConnectedAt = new Date();
      });

      client.on('error', (err) => {
        logger.error(`Redis ${name} Client Error:`, {
          error: err.message,
          stack: err.stack
        });
        this.connectionStats.errors.push({
          timestamp: new Date(),
          error: err.message
        });
        // Keep only last 10 errors
        if (this.connectionStats.errors.length > 10) {
          this.connectionStats.errors.shift();
        }
      });

      client.on('reconnecting', () => {
        logger.warn(`Redis ${name} client reconnecting`);
        this.connectionStats.disconnectionCount++;
      });

      client.on('end', () => {
        logger.info(`Redis ${name} client connection closed`);
      });
    };

    setupListeners(this.client, 'main');
    setupListeners(this.subscriber, 'subscriber');
    setupListeners(this.publisher, 'publisher');
  }

  async _connectClients() {
    await Promise.all([
      this.client.connect(),
      this.subscriber.connect(),
      this.publisher.connect()
    ]);
  }

  _startHealthCheck() {
    const interval = parseInt(process.env.REDIS_HEALTH_CHECK_INTERVAL, 10) || 30000;
    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth();
    }, interval);
  }

  async disconnect() {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      const disconnectPromises = [];

      if (this.client) {
        disconnectPromises.push(this.client.quit());
      }
      if (this.subscriber) {
        disconnectPromises.push(this.subscriber.quit());
      }
      if (this.publisher) {
        disconnectPromises.push(this.publisher.quit());
      }

      await Promise.all(disconnectPromises);
      logger.info('All Redis connections closed successfully');
    } catch (error) {
      logger.error('Error closing Redis connections:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async checkHealth() {
    try {
      const ping = await this.client.ping();
      const info = await this.client.info();

      const healthStatus = {
        ping,
        connectionStats: this.connectionStats,
        serverInfo: this._parseRedisInfo(info),
        timestamp: new Date()
      };

      logger.debug('Redis health check:', healthStatus);
      return healthStatus;
    } catch (error) {
      logger.error('Redis health check failed:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  _parseRedisInfo(info) {
    const sections = {};
    let currentSection = '';

    info.split('\n').forEach(line => {
      if (line.startsWith('#')) {
        currentSection = line.substring(2).trim();
        sections[currentSection] = {};
      } else if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (currentSection && key) {
          sections[currentSection][key.trim()] = value.trim();
        }
      }
    });

    return sections;
  }

  // Enhanced utility methods
  async set(key, value, options = {}) {
    try {
      this.connectionStats.operationCount++;
      const defaultOptions = {
        EX: parseInt(process.env.REDIS_DEFAULT_EXPIRY, 10) || 3600
      };
      const finalOptions = { ...defaultOptions, ...options };

      const serializedValue = this._serialize(value);
      return await this.client.set(key, serializedValue, finalOptions);
    } catch (error) {
      this._handleOperationError('set', error, { key });
      throw error;
    }
  }

  async get(key) {
    try {
      this.connectionStats.operationCount++;
      const value = await this.client.get(key);
      return this._deserialize(value);
    } catch (error) {
      this._handleOperationError('get', error, { key });
      throw error;
    }
  }

  async delete(key) {
    try {
      this.connectionStats.operationCount++;
      return await this.client.del(key);
    } catch (error) {
      this._handleOperationError('delete', error, { key });
      throw error;
    }
  }

  // Advanced utility methods
  async setWithRetry(key, value, options = {}, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.set(key, value, options);
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  async getMultiple(keys) {
    try {
      this.connectionStats.operationCount++;
      const values = await this.client.mGet(keys);
      return values.map(value => this._deserialize(value));
    } catch (error) {
      this._handleOperationError('getMultiple', error, { keys });
      throw error;
    }
  }

  async setHash(key, hash) {
    try {
      this.connectionStats.operationCount++;
      const serializedHash = {};
      for (const [field, value] of Object.entries(hash)) {
        serializedHash[field] = this._serialize(value);
      }
      return await this.client.hSet(key, serializedHash);
    } catch (error) {
      this._handleOperationError('setHash', error, { key });
      throw error;
    }
  }

  async getHash(key) {
    try {
      this.connectionStats.operationCount++;
      const hash = await this.client.hGetAll(key);
      const deserializedHash = {};
      for (const [field, value] of Object.entries(hash)) {
        deserializedHash[field] = this._deserialize(value);
      }
      return deserializedHash;
    } catch (error) {
      this._handleOperationError('getHash', error, { key });
      throw error;
    }
  }

  // Pub/Sub methods
  async publish(channel, message) {
    try {
      const serializedMessage = this._serialize(message);
      return await this.publisher.publish(channel, serializedMessage);
    } catch (error) {
      this._handleOperationError('publish', error, { channel });
      throw error;
    }
  }

  async subscribe(channel, callback) {
    try {
      if (!this.subscriptions.has(channel)) {
        await this.subscriber.subscribe(channel, (message) => {
          const deserializedMessage = this._deserialize(message);
          callback(deserializedMessage);
        });
        this.subscriptions.set(channel, callback);
      }
    } catch (error) {
      this._handleOperationError('subscribe', error, { channel });
      throw error;
    }
  }

  async unsubscribe(channel) {
    try {
      if (this.subscriptions.has(channel)) {
        await this.subscriber.unsubscribe(channel);
        this.subscriptions.delete(channel);
      }
    } catch (error) {
      this._handleOperationError('unsubscribe', error, { channel });
      throw error;
    }
  }

  // Helper methods
  _serialize(value) {
    if (value === undefined) {
      return null;
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  _deserialize(value) {
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  _handleOperationError(operation, error, context) {
    logger.error(`Redis ${operation} error:`, {
      error: error.message,
      stack: error.stack,
      context
    });
  }

  // Monitoring methods
  getStats() {
    return {
      ...this.connectionStats,
      subscriptions: Array.from(this.subscriptions.keys()),
      isConnected: this.client?.isOpen || false
    };
  }

  async flushAll() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FLUSHALL command is disabled in production');
    }
    return await this.client.flushAll();
  }
}

module.exports = new RedisConnection();