const mongoose = require('mongoose');
const config = require('config');

class DatabaseConnectionManager {
    constructor() {
        this.maxRetries = 5;
        this.retryDelay = 5000;
        this.currentRetry = 0;
        this.isConnecting = false;
        this.lastError = null;
        this.connectionStartTime = null;

        this.setupEventListeners();
        this.initializeConnectionOptions();
    }

    initializeConnectionOptions() {
        // Options specifically tuned for MongoDB Atlas
        this.connectionOptions = {
            // Replica set options
            replicaSet: 'atlas-nmutqk-shard-0',
            directConnection: false,

            // Connection timeout settings
            serverSelectionTimeoutMS: 30000,  // Increased from 5000
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000,

            // Read preference and write concern
            readPreference: 'primary',
            w: 'majority',
            retryWrites: true,

            // Pool configuration
            maxPoolSize: 10,
            minPoolSize: 2,

            // Monitoring
            heartbeatFrequencyMS: 10000,

            // SSL requirements for Atlas
            ssl: true,
            tls: true,
            tlsInsecure: false,

            // Additional options
            authSource: 'admin',
            retryReads: true
        };
    }

    setupEventListeners() {
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected event received');
            this.isConnecting = false;
            if (!this.isConnecting && this.currentRetry < this.maxRetries) {
                setTimeout(() => this.handleDisconnect(), 5000);  // Wait 5s before reconnecting
            }
        });

        mongoose.connection.on('error', (error) => {
            const errorInfo = {
                message: error.message,
                code: error.code,
                time: new Date().toISOString(),
                topology: error.topology?.type
            };
            console.error('MongoDB connection error:', errorInfo);
            this.handleError(error);
        });

        mongoose.connection.on('connected', () => {
            console.log('MongoDB connected successfully');
            this.lastError = null;
            this.currentRetry = 0;
            this.isConnecting = false;
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected successfully');
            this.lastError = null;
            this.currentRetry = 0;
            this.isConnecting = false;
        });
    }

    async connect() {
        if (this.isConnecting) {
            console.log('Connection attempt already in progress');
            return;
        }

        this.isConnecting = true;
        this.connectionStartTime = Date.now();

        try {
            const uri = process.env.ATLAS_URI || config.get('mongodb+srv://mashudumorgan:<db_password>@marketmate.tnup4.mongodb.net/?retryWrites=true&w=majority&appName=MarketMate');

            if (!uri) {
                throw new Error('MongoDB URI not provided');
            }

            // Validate URI format
            if (!uri.includes('mongodb+srv://') && !uri.includes('mongodb://')) {
                throw new Error('Invalid MongoDB URI format');
            }

            console.log('Attempting MongoDB Atlas connection...');
            await mongoose.connect(uri, this.connectionOptions);

            const connectionTime = Date.now() - this.connectionStartTime;
            console.log(`MongoDB connected successfully (${connectionTime}ms)`);

            this.setupConnectionMonitoring();

        } catch (error) {
            this.lastError = error;

            // Log detailed error information
            console.error('MongoDB connection error:', {
                message: error.message,
                code: error.code,
                time: new Date().toISOString(),
                cause: error.cause?.message,
                topology: error.topology?.type
            });

            await this.handleConnectionFailure(error);
        }
    }

    handleError(error) {
        this.lastError = error;

        // Handle specific Atlas-related errors
        if (error.name === 'MongoServerSelectionError') {
            console.log('Server selection error, waiting before retry...');
            setTimeout(() => {
                if (!this.isConnecting) {
                    this.handleDisconnect();
                }
            }, 10000); // Wait 10s before retry for server selection issues
            return;
        }

        if (error.code === 'ECONNREFUSED' ||
            error.message.includes('topology') ||
            error.message.includes('disconnected')) {

            setTimeout(() => {
                if (!this.isConnecting) {
                    this.handleDisconnect();
                }
            }, 5000);
        }
    }

    async handleConnectionFailure(error) {
        this.isConnecting = false;

        if (this.currentRetry < this.maxRetries) {
            this.currentRetry++;
            const delay = this.calculateBackoff();

            console.log({
                message: 'Scheduling connection retry',
                attempt: this.currentRetry,
                maxRetries: this.maxRetries,
                delayMs: delay,
                error: error.message,
                topology: error.topology?.type
            });

            setTimeout(() => this.connect(), delay);
        } else {
            console.error({
                message: 'Max connection retries reached',
                totalAttempts: this.maxRetries,
                lastError: error.message,
                timeSinceFirstAttempt: Date.now() - this.connectionStartTime,
                topology: error.topology?.type
            });
        }
    }

    calculateBackoff() {
        const baseDelay = this.retryDelay;
        const maxDelay = 30000;
        const exponentialDelay = Math.min(
            baseDelay * Math.pow(2, this.currentRetry - 1),
            maxDelay
        );
        const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);
        return Math.floor(exponentialDelay + jitter);
    }

    setupConnectionMonitoring() {
        const MONITOR_INTERVAL = 30000;

        setInterval(async () => {
            try {
                const health = await this.checkHealth();

                if (health.status !== 'connected') {
                    console.warn('Unhealthy connection detected:', health);
                    if (!this.isConnecting) {
                        await this.handleConnectionFailure(
                            new Error(`Unhealthy connection: ${health.status}`)
                        );
                    }
                }

            } catch (error) {
                console.error('Health check failed:', error);
                if (!this.isConnecting) {
                    await this.handleConnectionFailure(error);
                }
            }
        }, MONITOR_INTERVAL);
    }

    async checkHealth() {
        const readyState = mongoose.connection.readyState;

        if (readyState !== 1) {
            return {
                status: 'disconnected',
                readyState,
                lastError: this.lastError?.message,
                retryAttempt: this.currentRetry,
                topology: mongoose.connection.client?.topology?.description?.type
            };
        }

        try {
            const startTime = Date.now();
            await mongoose.connection.db.admin().ping();
            const latency = Date.now() - startTime;

            return {
                status: 'connected',
                latency,
                readyState,
                topology: mongoose.connection.client?.topology?.description?.type,
                lastError: null
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                code: error.code,
                readyState,
                topology: mongoose.connection.client?.topology?.description?.type,
                lastError: error
            };
        }
    }

    async close() {
        try {
            await mongoose.connection.close();
            console.log('Database connection closed successfully');
        } catch (error) {
            console.error('Error closing database connection:', error);
            throw error;
        }
    }
}

module.exports = new DatabaseConnectionManager();