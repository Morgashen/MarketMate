const dotenv = require('dotenv');

class EnvironmentConfig {
  constructor() {
    dotenv.config();
    this.validateEnvironment();
  }

  validateEnvironment() {
    const requiredEnvs = [
      'PORT',
      'MONGODB_URI',
      'JWT_SECRET',
      'KAFKA_BROKERS',
      'REDIS_URL'
    ];

    requiredEnvs.forEach(env => {
      if (!process.env[env]) {
        throw new Error(`Missing environment variable: ${env}`);
      }
    });
  }

  get(key) {
    return process.env[key];
  }
}

module.exports = new EnvironmentConfig();
