const mongoose = require('mongoose');
const config = require('config');

class DatabaseService {
    constructor() {
        this.isConnected = false;
        this.connection = null;
    }

    async connect() {
        if (this.isConnected) return;

        try {
            const options = {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            };

            await mongoose.connect(process.env.ATLAS_URI || config.get('mongoURI'), options);

            this.connection = mongoose.connection;
            this.isConnected = true;

            console.log('MongoDB Connected Successfully');

            // Handle connection events
            this.connection.on('error', this.handleError);
            this.connection.on('disconnected', this.handleDisconnect);
            this.connection.on('reconnected', this.handleReconnect);

            // Graceful shutdown
            process.on('SIGINT', this.handleGracefulShutdown);
            process.on('SIGTERM', this.handleGracefulShutdown);

        } catch (error) {
            console.error('Database Connection Error:', error);
            throw error;
        }
    }

    handleError(error) {
        console.error('MongoDB connection error:', error);
    }

    handleDisconnect() {
        console.log('MongoDB disconnected. Attempting to reconnect...');
    }

    handleReconnect() {
        console.log('MongoDB reconnected');
    }

    async handleGracefulShutdown() {
        try {
            await mongoose.connection.close();
            console.log('MongoDB connection closed through app termination');
            process.exit(0);
        } catch (error) {
            console.error('Error during database disconnection:', error);
            process.exit(1);
        }
    }

    // Generic CRUD operations
    async create(model, data) {
        try {
            const document = new model(data);
            return await document.save();
        } catch (error) {
            console.error(`Error creating ${model.modelName}:`, error);
            throw error;
        }
    }

    async findById(model, id, populate = '') {
        try {
            return await model.findById(id).populate(populate);
        } catch (error) {
            console.error(`Error finding ${model.modelName} by id:`, error);
            throw error;
        }
    }

    async findOne(model, conditions, populate = '') {
        try {
            return await model.findOne(conditions).populate(populate);
        } catch (error) {
            console.error(`Error finding ${model.modelName}:`, error);
            throw error;
        }
    }

    async find(model, conditions = {}, options = {}) {
        try {
            const {
                populate = '',
                sort = { createdAt: -1 },
                limit = 0,
                skip = 0,
                select = ''
            } = options;

            return await model.find(conditions)
                .populate(populate)
                .sort(sort)
                .limit(limit)
                .skip(skip)
                .select(select);
        } catch (error) {
            console.error(`Error finding ${model.modelName}s:`, error);
            throw error;
        }
    }

    async update(model, id, data, options = { new: true }) {
        try {
            return await model.findByIdAndUpdate(id, data, options);
        } catch (error) {
            console.error(`Error updating ${model.modelName}:`, error);
            throw error;
        }
    }

    async delete(model, id) {
        try {
            return await model.findByIdAndDelete(id);
        } catch (error) {
            console.error(`Error deleting ${model.modelName}:`, error);
            throw error;
        }
    }

    // Pagination helper
    async paginate(model, conditions = {}, options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                populate = '',
                sort = { createdAt: -1 },
                select = ''
            } = options;

            const skip = (page - 1) * limit;

            const [data, total] = await Promise.all([
                model.find(conditions)
                    .populate(populate)
                    .sort(sort)
                    .limit(limit)
                    .skip(skip)
                    .select(select),
                model.countDocuments(conditions)
            ]);

            return {
                data,
                metadata: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error(`Error paginating ${model.modelName}:`, error);
            throw error;
        }
    }

    // Transaction helper
    async withTransaction(operations) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const result = await operations(session);
            await session.commitTransaction();
            return result;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Aggregation helper
    async aggregate(model, pipeline) {
        try {
            return await model.aggregate(pipeline);
        } catch (error) {
            console.error(`Error in ${model.modelName} aggregation:`, error);
            throw error;
        }
    }
}

module.exports = new DatabaseService();