const dotenv = require('dotenv');
const path = require('path');
const logger = require('../utils/logger');

class EnvironmentConfig {
  constructor() {
    this.config = {};
    this.schema = {};
    this.environmentName = process.env.NODE_ENV || 'development';
    this.configurationStatus = {
      loadedAt: null,
      validationErrors: [],
      lastValidationTime: null,
    };

    this.defineConfigurationSchema();
    this.initializeEnvironment();
    this.validateAndLoadConfig();
  }

  defineConfigurationSchema() {
    this.schema = {
      PORT: {
        type: 'number',
        required: true,
        default: 3000,
        validate: (value) => value > 0 && value < 65536,
        description: 'Port number for the server to listen on',
        group: 'server',
        errorMessage: 'Port must be a number between 1 and 65535',
      },
      NODE_ENV: {
        type: 'string',
        required: true,
        default: 'development',
        validate: (value) => ['development', 'test', 'production'].includes(value),
        description: 'Application environment',
        group: 'server',
        errorMessage: 'Environment must be development, test, or production',
      },
      MONGODB_URI: {
        type: 'string',
        required: true,
        sensitive: true,
        validate: (value) => {
          try {
            const url = new URL(value);
            return url.protocol === 'mongodb:' || url.protocol === 'mongodb+srv:';
          } catch {
            return false;
          }
        },
        description: 'MongoDB connection string',
        group: 'database',
        errorMessage: 'Invalid MongoDB connection string format',
      },
      JWT_SECRET: {
        type: 'string',
        required: true,
        sensitive: true,
        validate: (value) => value.length >= 32 &&
          /[A-Z]/.test(value) &&
          /[a-z]/.test(value) &&
          /[0-9]/.test(value) &&
          /[^A-Za-z0-9]/.test(value),
        description: 'Secret key for JWT signing',
        group: 'security',
        errorMessage: 'JWT secret must be at least 32 characters and contain uppercase, lowercase, numbers, and special characters',
      },
    };
  }

  initializeEnvironment() {
    const envFiles = [
      '.env',
      `.env.${this.environmentName}`,
      `.env.${this.environmentName}.local`,
    ];

    for (const envFile of envFiles) {
      const envPath = path.resolve(process.cwd(), envFile);
      const result = dotenv.config({ path: envPath });

      if (result.error && envFile !== '.env') {
        logger.warn(`Could not load environment file: ${envFile}`, {
          error: result.error.message,
        });
      } else {
        logger.info(`Loaded environment file: ${envFile}`);
      }
    }

    this.configurationStatus.loadedAt = new Date();
  }

  validateAndLoadConfig() {
    const errors = [];
    const validationStart = Date.now();

    const configGroups = {};

    for (const [key, schema] of Object.entries(this.schema)) {
      try {
        let value = process.env[key];
        const group = schema.group || 'miscellaneous';

        if (!configGroups[group]) {
          configGroups[group] = {};
        }

        if (value === undefined) {
          if (schema.required && schema.default === undefined) {
            throw new Error(schema.errorMessage || `Missing required environment variable: ${key}`);
          }
          value = schema.default;
        }

        value = this.convertAndValidateValue(key, value, schema);

        configGroups[group][key] = value;
        this.config[key] = value;

      } catch (error) {
        errors.push(`${key}: ${error.message}`);
      }
    }

    this.validateConfigurationGroups(configGroups, errors);

    this.configurationStatus.lastValidationTime = Date.now() - validationStart;
    this.configurationStatus.validationErrors = errors;

    if (errors.length > 0) {
      logger.error(`Environment validation failed:\n${errors.join('\n')}`, {
        validationTime: this.configurationStatus.lastValidationTime,
        groups: Object.keys(configGroups),
      });
      throw new Error('Validation failed.');
    }

    logger.info('Configuration validated successfully', {
      validationTime: this.configurationStatus.lastValidationTime,
      groups: Object.keys(configGroups),
    });
  }

  convertAndValidateValue(key, value, schema) {
    try {
      let convertedValue = value;

      switch (schema.type) {
        case 'number':
          convertedValue = Number(value);
          if (isNaN(convertedValue)) {
            throw new Error('Value must be a number');
          }
          break;
        case 'boolean':
          if (typeof value === 'string') {
            convertedValue = value.toLowerCase() === 'true';
          }
          break;
        case 'array':
          if (typeof value === 'string') {
            convertedValue = value.split(',').map(item => item.trim());
          }
          break;
      }

      if (schema.transform) {
        convertedValue = schema.transform(convertedValue);
      }

      if (schema.validate && !schema.validate(convertedValue)) {
        throw new Error(schema.errorMessage || 'Validation failed');
      }

      return convertedValue;
    } catch (error) {
      throw new Error(`${error.message} for ${key}`);
    }
  }

  validateConfigurationGroups(groups, errors) {
    const { server, database } = groups;

    if (database?.MONGODB_URI && server?.NODE_ENV === 'production') {
      if (!database.MONGODB_URI.includes('replica')) {
        errors.push('Production environment requires a replica set MongoDB connection');
      }
    }
  }
}

module.exports = new EnvironmentConfig();