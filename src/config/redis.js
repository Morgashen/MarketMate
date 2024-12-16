const Redis = require('redis');
const logger = require('../utils/logger');

class RedisConnection {
  constructor() {
    this.client = null;
  }

  async connect() {
    try {
      const redisConfig = {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              logger.error('Unable to connect to Redis after multiple attempts');
              return new Error('Redis connection failed');
            }
            return retries * 1000; // Exponential backoff
          }
        }
      };

      this.client = Redis.createClient(redisConfig);

      // Event listeners
      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error', err);
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis client reconnecting');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error(`Redis connection error: ${error.message}`);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        logger.info('Redis client disconnected');
      }
    } catch (error) {
      logger.error(`Error closing Redis connection: ${error.message}`);
    }
  }

  // Utility methods
  async set(key, value, options = {}) {
    try {
      // Default expiration of 1 hour if not specified
      const defaultOptions = { EX: 3600 };
      const finalOptions = { ...defaultOptions, ...options };
      
      // Convert value to string if it's an object
      const serializedValue = typeof value === 'object' 
        ? JSON.stringify(value) 
        : value;

      return await this.client.set(key, serializedValue, finalOptions);
    } catch (error) {
      logger.error(`Redis set error: ${error.message}`);
      throw error;
    }
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      
      // Try to parse as JSON, return original if parsing fails
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error(`Redis get error: ${error.message}`);
      throw error;
    }
  }

  async delete(key) {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error(`Redis delete error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new RedisConnection();
