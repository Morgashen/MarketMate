const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// This will create the in-memory database and establish a connection
async function initializeMongoServer() {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri);
}

// This will close the connection and stop the in-memory server
async function closeMongoServer() {
    await mongoose.disconnect();
    await mongoServer.stop();
}

// This will clear all collections
async function clearDatabase() {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany();
    }
}

module.exports = {
    initializeMongoServer,
    closeMongoServer,
    clearDatabase,
};