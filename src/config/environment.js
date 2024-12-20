const dotenv = require('dotenv');
const path = require('path');
const logger = require('../utils/logger'); // Assume logger exists

class EnvironmentConfig {
  constructor() {
    this.config = {};
    this.initializeEnvironment();
    this.validateAndLoadConfig();
  }

  initializeEnvironment() {
    // Load environment based on NODE_ENV
    const environment = process.env.NODE_ENV || 'development';
    const envPath = path.resolve(process.cwd(), `.env.${environment}`);

    // Load environment-specific .env file first, then fall back to default .env
    dotenv.config({ path: envPath });
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });

    logger.info(`Environment loaded: ${environment}`);
  }

  validateAndLoadConfig() {
    // Configuration schema with validation and defaults
    const configSchema = {
      // Server Configuration
      PORT: {
        type: 'number',
        required: true,
        default: 3000,
        validate: (value) => value > 0 && value < 65536
      },
      NODE_ENV: {
        type: 'string',
        required: true,
        default: 'development',
        validate: (value) => ['development', 'test', 'production'].includes(value)
      },

      // Database Configuration
      MONGODB_URI: {
        type: 'string',
        required: true,
        sensitive: true,
        validate: (value) => value.startsWith('mongodb')
      },
      MONGODB_MAX_POOL_SIZE: {
        type: 'number',
        default: 10,
        validate: (value) => value > 0 && value <= 100
      },

      // Authentication
      JWT_SECRET: {
        type: 'string',
        required: true,
        sensitive: true,
        validate: (value) => value.length >= 32
      },
      JWT_EXPIRATION: {
        type: 'string',
        default: '24h',
        validate: (value) => /^\d+[hdwmy]$/.test(value)
      },

      // External Services
      KAFKA_BROKERS: {
        type: 'array',
        required: true,
        transform: (value) => value.split(','),
        validate: (value) => value.length > 0
      },
      REDIS_URL: {
        type: 'string',
        required: true,
        sensitive: true,
        validate: (value) => value.startsWith('redis')
      },

      // Rate Limiting
      RATE_LIMIT_WINDOW: {
        type: 'number',
        default: 900000, // 15 minutes in milliseconds
        validate: (value) => value > 0
      },
      RATE_LIMIT_MAX_REQUESTS: {
        type: 'number',
        default: 100,
        validate: (value) => value > 0
      },

      // CORS Configuration
      CORS_ORIGIN: {
        type: 'array',
        default: ['*'],
        transform: (value) => value.split(','),
        validate: (value) => Array.isArray(value)
      }
    };

    const errors = [];

    // Validate and transform all configuration values
    for (const [key, schema] of Object.entries(configSchema)) {
      try {
        let value = process.env[key];

        // Check if required
        if (schema.required && value === undefined && schema.default === undefined) {
          throw new Error(`Missing required environment variable: ${key}`);
        }

        // Apply default if value is not provided
        if (value === undefined) {
          value = schema.default;
        }

        // Transform value if needed
        if (schema.transform && value) {
          value = schema.transform(value);
        }

        // Type conversion
        if (value !== undefined) {
          switch (schema.type) {
            case 'number':
              value = Number(value);
              if (isNaN(value)) {
                throw new Error(`Invalid number format for ${key}`);
              }
              break;
            case 'boolean':
              value = String(value).toLowerCase() === 'true';
              break;
            case 'array':
              if (!Array.isArray(value)) {
                value = [value];
              }
              break;
          }
        }

        // Validate value
        if (schema.validate && value !== undefined) {
          if (!schema.validate(value)) {
            throw new Error(`Invalid value for ${key}`);
          }
        }

        // Store configuration
        this.config[key] = value;

      } catch (error) {
        errors.push(error.message);
      }
    }

    // Check if any validation errors occurred
    if (errors.length > 0) {
      const errorMessage = `Environment validation failed:\n${errors.join('\n')}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Log non-sensitive configuration
    const loggableConfig = this.getLoggableConfig();
    logger.info('Environment configuration loaded:', loggableConfig);
  }

  get(key) {
    if (!(key in this.config)) {
      logger.warn(`Accessing undefined configuration key: ${key}`);
      return undefined;
    }
    return this.config[key];
  }

  getAll() {
    return { ...this.config };
  }

  getLoggableConfig() {
    // Return configuration without sensitive values
    const loggableConfig = {};
    for (const [key, value] of Object.entries(this.config)) {
      if (this.isSensitive(key)) {
        loggableConfig[key] = '[REDACTED]';
      } else {
        loggableConfig[key] = value;
      }
    }
    return loggableConfig;
  }

  isSensitive(key) {
    const sensitiveKeys = ['JWT_SECRET', 'MONGODB_URI', 'REDIS_URL'];
    return sensitiveKeys.includes(key) || key.includes('SECRET') || key.includes('PASSWORD');
  }

  isDevelopment() {
    return this.get('NODE_ENV') === 'development';
  }

  isProduction() {
    return this.get('NODE_ENV') === 'production';
  }

  isTest() {
    return this.get('NODE_ENV') === 'test';
  }
}

// Export singleton instance
module.exports = new EnvironmentConfig();