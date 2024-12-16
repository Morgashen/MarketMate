const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Database connection configuration
class DatabaseConnection {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      // Validate MongoDB URI
      if (!process.env.MONGODB_URI) {
        throw new Error('MongoDB URI is not defined in environment variables');
      }

      // Mongoose connection options
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10, // Connection pool size
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        family: 4 // Use IPv4, skip trying IPv6
      };

      // Establish connection
      this.connection = await mongoose.connect(process.env.MONGODB_URI, options);

      // Event listeners for connection states
      mongoose.connection.on('connected', () => {
        logger.info('Mongoose connected to database');
      });

      mongoose.connection.on('error', (err) => {
        logger.error(`Mongoose connection error: ${err}`);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('Mongoose disconnected from database');
      });

      return this.connection;
    } catch (error) {
      logger.error(`Database connection error: ${error.message}`);
      throw error;
    }
  }

  async disconnect() {
    try {
      await mongoose.connection.close();
      logger.info('Mongoose connection closed');
    } catch (error) {
      logger.error(`Error closing database connection: ${error.message}`);
    }
  }

  // Get current connection
  getConnection() {
    return this.connection;
  }
}

module.exports = new DatabaseConnection();
