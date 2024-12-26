const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const winston = require('winston');

// Create a dedicated logger for our test environment
// This helps us track what's happening during our tests
const testLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            // Format log messages to be easily readable during test runs
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// We keep track of our database server instance
let mongoServer;

// This runs once before any tests start
beforeAll(async () => {
    try {
        // Create an in-memory MongoDB server for testing
        // This ensures our tests don't affect any real database
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();

        // Set up our test environment variables
        process.env.NODE_ENV = 'test';
        process.env.MONGODB_URI = mongoUri;

        // Connect to our test database
        await mongoose.connect(mongoUri);

        testLogger.info(`Test database initialized at ${mongoUri}`);
    } catch (error) {
        testLogger.error('Test setup failed:', error);
        throw error;
    }
});

// Clean up after each test to ensure test isolation
afterEach(async () => {
    try {
        // Clear all collections after each test
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany();
        }
        testLogger.info('Test data cleared');
    } catch (error) {
        testLogger.error('Test cleanup failed:', error);
    }
});

// Final cleanup after all tests complete
afterAll(async () => {
    try {
        await mongoose.disconnect();
        await mongoServer.stop();
        testLogger.info('Test environment cleaned up');
    } catch (error) {
        testLogger.error('Test teardown failed:', error);
    }
});

module.exports = { testLogger };