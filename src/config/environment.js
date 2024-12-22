const dotenv = require('dotenv');
const path = require('path');
const logger = require('../utils/logger');

class EnvironmentConfig {
  constructor() {
    // We'll enhance the configuration storage
    this.config = {};
    this.schema = {};  // Store schema separately for better organization
    this.environmentName = process.env.NODE_ENV || 'development';
    this.configurationStatus = {
      loadedAt: null,
      validationErrors: [],
      lastValidationTime: null
    };

    // Initialize in the correct order
    this.defineConfigurationSchema();
    this.initializeEnvironment();
    this.validateAndLoadConfig();
  }

  defineConfigurationSchema() {
    // Enhanced schema with additional metadata and validation
    this.schema = {
      // Server Configuration Group
      PORT: {
        type: 'number',
        required: true,
        default: 3000,
        validate: (value) => value > 0 && value < 65536,
        description: 'Port number for the server to listen on',
        group: 'server',
        errorMessage: 'Port must be a number between 1 and 65535'
      },
      NODE_ENV: {
        type: 'string',
        required: true,
        default: 'development',
        validate: (value) => ['development', 'test', 'production'].includes(value),
        description: 'Application environment',
        group: 'server',
        errorMessage: 'Environment must be development, test, or production'
      },

      // Database Configuration Group
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
        errorMessage: 'Invalid MongoDB connection string format'
      },

      // Enhanced JWT Configuration
      JWT_SECRET: {
        type: 'string',
        required: true,
        sensitive: true,
        validate: (value) => {
          // Ensure strong secret key
          return value.length >= 32 &&
            /[A-Z]/.test(value) &&
            /[a-z]/.test(value) &&
            /[0-9]/.test(value) &&
            /[^A-Za-z0-9]/.test(value);
        },
        description: 'Secret key for JWT signing',
        group: 'security',
        errorMessage: 'JWT secret must be at least 32 characters and contain uppercase, lowercase, numbers, and special characters'
      },

      // Add more configuration entries...
    };
  }

  initializeEnvironment() {
    try {
      // Load environment files in the correct order, from least to most specific
      const envFiles = [
        '.env',                              // Base configuration
        `.env.${this.environmentName}`,      // Environment-specific
        `.env.${this.environmentName}.local` // Local overrides (git-ignored)
      ];

      for (const envFile of envFiles) {
        const envPath = path.resolve(process.cwd(), envFile);
        const result = dotenv.config({ path: envPath });

        if (result.error) {
          // Only log as warning if it's not the base .env file
          if (envFile !== '.env') {
            logger.warn(`Could not load environment file: ${envFile}`, {
              error: result.error.message
            });
          }
        } else {
          logger.info(`Loaded environment file: ${envFile}`);
        }
      }

      // Record configuration loading time
      this.configurationStatus.loadedAt = new Date();
    } catch (error) {
      logger.error('Failed to initialize environment', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  validateAndLoadConfig() {
    const errors = [];
    const validationStart = Date.now();

    // Group configuration values for validation
    const configGroups = {};

    // First pass: Basic validation and grouping
    for (const [key, schema] of Object.entries(this.schema)) {
      try {
        let value = process.env[key];
        const group = schema.group || 'miscellaneous';

        if (!configGroups[group]) {
          configGroups[group] = {};
        }

        // Handle required fields and defaults
        if (value === undefined) {
          if (schema.required && schema.default === undefined) {
            throw new Error(schema.errorMessage || `Missing required environment variable: ${key}`);
          }
          value = schema.default;
        }

        // Type conversion and validation
        value = this.convertAndValidateValue(key, value, schema);

        // Store the processed value
        configGroups[group][key] = value;
        this.config[key] = value;

      } catch (error) {
        errors.push(`${key}: ${error.message}`);
      }
    }

    // Second pass: Cross-field validation
    this.validateConfigurationGroups(configGroups, errors);

    // Update validation status
    this.configurationStatus.lastValidationTime = Date.now() - validationStart;
    this.configurationStatus.validationErrors = errors;

    if (errors.length > 0) {
      const errorMessage = `Environment validation failed:\n${errors.join('\n')}`;
      logger.error(errorMessage, {
        validationTime: this.configurationStatus.lastValidationTime,
        groups: Object.keys(configGroups)
      });
      throw new Error(errorMessage);
    }

    // Log success with metrics
    logger.info('Configuration validated successfully', {
      validationTime: this.configurationStatus.lastValidationTime,
      groups: Object.keys(configGroups),
      configurationAge: Date.now() - this.configurationStatus.loadedAt
    });
  }

  convertAndValidateValue(key, value, schema) {
    // Enhanced type conversion with detailed error messages
    try {
      let convertedValue = value;

      switch (schema.type) {
        case 'number':
          convertedValue = Number(value);
          if (isNaN(convertedValue)) {
            throw new Error(`Value must be a number`);
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
        // Add more type conversions as needed
      }

      // Apply custom transformation if defined
      if (schema.transform) {
        convertedValue = schema.transform(convertedValue);
      }

      // Validate the converted value
      if (schema.validate && !schema.validate(convertedValue)) {
        throw new Error(schema.errorMessage || 'Validation failed');
      }

      return convertedValue;
    } catch (error) {
      throw new Error(`${error.message} for ${key}`);
    }
  }

  validateConfigurationGroups(groups, errors) {
    // Example cross-field validations
    const { server, database, security } = groups;

    // Validate database configuration
    if (database?.MONGODB_URI && server?.NODE_ENV === 'production') {
      if (!database.MONGODB_URI.includes('replica')) {
        errors.push('Production environment requires a replica set MongoDB connection');
      }
    }

    // Add more cross-field validations as needed
  }
}

module.exports = new EnvironmentConfig();