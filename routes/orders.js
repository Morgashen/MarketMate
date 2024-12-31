const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { AppError } = require('../middleware/errorHandler');

// Create new order
router.post('/', async (req, res, next) => {
    try {
        // Validate request body
        if (!req.body.shippingAddress) {
            throw new AppError('Shipping address is required', 400);
        }

        // Create the order
        const order = await Order.create({
            shippingAddress: {
                street: req.body.shippingAddress.street,
                city: req.body.shippingAddress.city,
                state: req.body.shippingAddress.state,
                zipCode: req.body.shippingAddress.zipCode,
                country: req.body.shippingAddress.country
            }
        });

        // Send success response
        res.status(201).json({
            status: 'success',
            data: {
                order
            }
        });
    } catch (error) {
        // Check if this is a MongoDB validation error
        if (error.name === 'ValidationError') {
            next(new AppError('Invalid order data: ' + error.message, 400));
            return;
        }

        // If it's already an AppError, pass it through
        if (error instanceof AppError) {
            next(error);
            return;
        }

        // Log unexpected errors
        console.error('Order creation error:', {
            error: error.message,
            stack: error.stack,
            requestId: req.id,
            body: req.body
        });

        // Pass to error handler
        next(new AppError('Failed to create order', 500));
    }
});

module.exports = router;