const mongoose = require('mongoose');
const logger = require('../config/logger');

const connectDB = async () => {
    try {
        // Enhanced connection options for better reliability
        const connectionOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // Increase timeouts
            connectTimeoutMS: 60000, // 60 seconds
            socketTimeoutMS: 45000,  // 45 seconds
            // Connection pool settings
            maxPoolSize: 10,
            minPoolSize: 2,
            // Retry settings
            retryWrites: true,
            retryReads: true,
            // Keep trying to connect
            serverSelectionTimeoutMS: 60000, // 60 seconds
            heartbeatFrequencyMS: 2000,      // Check server status every 2 seconds
        };

        // Add debug logging for connection attempts
        mongoose.set('debug', process.env.NODE_ENV !== 'production');

        // Connection event handlers
        mongoose.connection.on('connecting', () => {
            logger.info('Attempting to connect to MongoDB...');
        });

        mongoose.connection.on('connected', () => {
            logger.info('Successfully connected to MongoDB');
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('Lost MongoDB connection. Attempting to reconnect...');
        });

        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error:', err);
        });

        // Attempt connection with retry logic
        const maxRetries = 5;
        let retryCount = 0;
        let connected = false;

        while (!connected && retryCount < maxRetries) {
            try {
                await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
                connected = true;
                logger.info(`Connected to MongoDB after ${retryCount + 1} attempt(s)`);
            } catch (error) {
                retryCount++;
                logger.warn(`Connection attempt ${retryCount} failed. ${maxRetries - retryCount} attempts remaining.`);

                if (retryCount < maxRetries) {
                    // Wait before retrying (exponential backoff)
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    logger.error('Failed to connect to MongoDB after maximum retry attempts');
                    throw error;
                }
            }
        }

        return mongoose.connection;
    } catch (error) {
        logger.error('Fatal MongoDB connection error:', error);
        process.exit(1);
    }
};

module.exports = connectDB;