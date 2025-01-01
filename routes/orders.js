const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Order = require('../models/Order');
const { AppError } = require('../middleware/errorHandler');

// Joi schema for order validation
const orderSchema = Joi.object({
    shippingAddress: Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        zipCode: Joi.string().required(),
        country: Joi.string().required(),
    }).required(),
});

// POST: Create a new order
router.post('/', async (req, res, next) => {
    try {
        const { error } = orderSchema.validate(req.body);
        if (error) throw new AppError('Invalid order data: ' + error.message, 400);

        const { shippingAddress } = req.body;

        // Create the order
        const newOrder = await Order.create({ shippingAddress });

        res.status(201).json({
            status: 'success',
            message: 'Order created successfully',
            data: newOrder,
        });
    } catch (error) {
        if (error instanceof AppError) {
            next(error);
        } else {
            console.error('Error creating order:', error);
            next(new AppError('Internal server error', 500));
        }
    }
});

// GET: Retrieve all orders
router.get('/', async (req, res, next) => {
    try {
        const orders = await Order.find({});
        res.status(200).json({
            status: 'success',
            data: orders,
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        next(new AppError('Failed to fetch orders', 500));
    }
});

// GET: Retrieve a specific order by ID
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);

        if (!order) {
            throw new AppError('Order not found', 404);
        }

        res.status(200).json({
            status: 'success',
            data: order,
        });
    } catch (error) {
        if (error.name === 'CastError') {
            next(new AppError('Invalid order ID format', 400));
        } else if (error instanceof AppError) {
            next(error);
        } else {
            console.error('Error fetching order:', error);
            next(new AppError('Failed to fetch order', 500));
        }
    }
});

// DELETE: Delete a specific order by ID
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = await Order.findByIdAndDelete(id);

        if (!order) {
            throw new AppError('Order not found', 404);
        }

        res.status(200).json({
            status: 'success',
            message: 'Order deleted successfully',
            data: order,
        });
    } catch (error) {
        if (error.name === 'CastError') {
            next(new AppError('Invalid order ID format', 400));
        } else if (error instanceof AppError) {
            next(error);
        } else {
            console.error('Error deleting order:', error);
            next(new AppError('Failed to delete order', 500));
        }
    }
});

module.exports = router;