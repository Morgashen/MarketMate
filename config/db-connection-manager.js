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
        this.connectionOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            heartbeatFrequencyMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            keepAlive: true,
            connectTimeoutMS: 30000,
        };
    }

    setupEventListeners() {
        mongoose.connection.on('error', this.handleError.bind(this));
        mongoose.connection.on('disconnected', this.handleDisconnect.bind(this));
        mongoose.connection.on('connected', () => {
            console.log('MongoDB connected successfully');
            this.lastError = null;
            this.currentRetry = 0;
        });
        mongoose.connection.on('reconnected', () => {
            this.lastError = null;
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

            console.log('Attempting MongoDB connection...');
            await mongoose.connect(uri, this.connectionOptions);

            const connectionTime = Date.now() - this.connectionStartTime;
            console.log(`MongoDB connected successfully (${connectionTime}ms)`);

            this.currentRetry = 0;
            this.isConnecting = false;

            this.setupConnectionMonitoring();

        } catch (error) {
            this.lastError = error;
            console.error('MongoDB connection error:', {
                message: error.message,
                code: error.code,
                time: new Date().toISOString()
            });

            await this.handleConnectionFailure(error);
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
                error: error.message
            });

            setTimeout(() => this.connect(), delay);
        } else {
            console.error({
                message: 'Max connection retries reached',
                totalAttempts: this.maxRetries,
                lastError: error.message,
                timeSinceFirstAttempt: Date.now() - this.connectionStartTime
            });

            throw new Error('Failed to establish database connection');
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

    handleError(error) {
        this.lastError = error;

        const errorInfo = {
            message: error.message,
            code: error.code,
            time: new Date().toISOString(),
            connectionState: mongoose.connection.readyState
        };

        console.error('MongoDB error:', errorInfo);

        switch (error.code) {
            case 'ECONNRESET':
                console.log('Connection reset detected, initiating reconnection...');
                this.handleDisconnect();
                break;

            case 'ETIMEDOUT':
                console.log('Connection timed out, waiting before reconnecting...');
                setTimeout(() => this.handleDisconnect(), 5000);
                break;

            default:
                if (error.message.includes('topology')) {
                    console.log('Topology error detected, attempting to reconnect...');
                    this.handleDisconnect();
                }
        }
    }

    handleDisconnect() {
        if (!this.isConnecting) {
            console.log('MongoDB disconnected, initiating reconnection...');
            this.currentRetry = 0;
            this.connect();
        }
    }

    setupConnectionMonitoring() {
        const MONITOR_INTERVAL = 30000;

        setInterval(async () => {
            try {
                const health = await this.checkHealth();

                if (health.status !== 'connected') {
                    console.warn('Unhealthy connection detected:', health);
                    await this.handleConnectionFailure(
                        new Error(`Unhealthy connection: ${health.status}`)
                    );
                }

                // Get connection stats safely
                const client = mongoose.connection.client;
                if (client && client.topology) {
                    const stats = {
                        connections: client.topology.connections().length,
                        time: new Date().toISOString()
                    };
                    console.log('Connection stats:', stats);
                }

            } catch (error) {
                console.error('Health check failed:', error);
                await this.handleConnectionFailure(error);
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
                retryAttempt: this.currentRetry
            };
        }

        try {
            const startTime = Date.now();
            await mongoose.connection.db.admin().ping();
            const latency = Date.now() - startTime;

            // Get connection count safely
            let connectionCount = 0;
            const client = mongoose.connection.client;
            if (client && client.topology) {
                connectionCount = client.topology.connections().length;
            }

            return {
                status: 'connected',
                latency,
                connections: connectionCount,
                readyState,
                lastError: null
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                code: error.code,
                readyState,
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