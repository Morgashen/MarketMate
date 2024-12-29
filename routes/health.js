const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../config/logging'); // Ensure this path is correct

// Helper function to check MongoDB connection
const checkMongoConnection = () => {
    // Check the state of the MongoDB connection
    return mongoose.connection.readyState === 1;
};

router.get('/health', (req, res) => {
    if (checkMongoConnection()) {
        res.status(200).json({ status: 'UP' });
    } else {
        res.status(500).json({ status: 'DOWN' });
    }
});

module.exports = router;
