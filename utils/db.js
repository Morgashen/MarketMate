const { MongoClient } = require('mongodb');
const logger = require('./logger'); // Ensure this path is correct

class DBClient {
    constructor() {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 27017;
        const database = process.env.DB_DATABASE || 'marketmate';
        const user = process.env.DB_USER || '';
        const password = process.env.DB_PASSWORD || '';

        const uri = user && password ? `mongodb://${user}:${password}@${host}:${port}/${database}` : `mongodb://${host}:${port}/${database}`;

        this.client = new MongoClient(uri);
        this.dbName = database;

        this.client.connect(err => {
            if (err) {
                logger.error('Error connecting to MongoDB', err);
                this.connected = false;
            } else {
                logger.info('Connected to MongoDB');
                this.connected = true;
            }
        });
    }

    isAlive() {
        return this.connected;
    }

    async nbUsers() {
        const db = this.client.db(this.dbName);
        const usersCollection = db.collection('users');
        const count = await usersCollection.countDocuments();
        return count;
    }

    async nbFiles() {
        const db = this.client.db(this.dbName);
        const filesCollection = db.collection('files');
        const count = await filesCollection.countDocuments();
        return count;
    }
}

// Create and export an instance of DBClient
const dbClient = new DBClient();
module.exports = dbClient;