const mongoose = require('mongoose');

const gracefulShutdown = (server) => {
    process.on('SIGTERM', async () => {
        console.info('SIGTERM received. Shutting down gracefully...');
        try {
            await mongoose.connection.close(false);
            console.log('MongoDB connection closed.');
            await new Promise((resolve) => server.close(resolve));
            console.log('Server closed.');
            process.exit(0);
        } catch (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
    });
};

module.exports = gracefulShutdown;