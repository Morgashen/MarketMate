const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup function to run before all tests
exports.setupTestDB = async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
};

// Cleanup function to run after all tests
exports.teardownTestDB = async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
};

// Clear all collections between tests
exports.clearDatabase = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany();
    }
};