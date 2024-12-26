const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const StripeService = require('./StripeService');

class OrderService {
    static async createOrder(userId, paymentMethodId, shippingAddress) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const cart = await Cart.findOne({ user: userId })
                .populate('items.product')
                .session(session);

            if (!cart || cart.items.length === 0) {
                throw new Error('Cart is empty');
            }

            const { orderItems, total } = await this.validateAndPrepareOrderItems(cart, session);

            // Process payment through Stripe
            const paymentIntent = await StripeService.createAndConfirmPayment(
                total,
                paymentMethodId,
                userId
            );

            const order = await this.saveOrder(
                userId,
                orderItems,
                total,
                shippingAddress,
                paymentIntent.id,
                session
            );

            // Clear cart after successful order creation
            await this.clearCart(cart, session);

            await session.commitTransaction();
            return order;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    static async validateAndPrepareOrderItems(cart, session) {
        const orderItems = [];
        let total = 0;

        for (const item of cart.items) {
            const product = await Product.findById(item.product._id).session(session);

            if (!product) {
                throw new Error(`Product not found: ${item.product._id}`);
            }

            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for product: ${product.name}`);
            }

            // Update product stock
            product.stock -= item.quantity;
            await product.save({ session });

            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: product.price
            });

            total += product.price * item.quantity;
        }

        return { orderItems, total };
    }

    static async saveOrder(userId, items, total, shippingAddress, paymentIntentId, session) {
        const order = new Order({
            user: userId,
            items,
            total,
            shippingAddress,
            paymentIntent: paymentIntentId,
            status: 'processing',
            orderNumber: await this.generateOrderNumber()
        });

        await order.save({ session });
        return order;
    }

    static async clearCart(cart, session) {
        cart.items = [];
        await cart.save({ session });
    }

    static async generateOrderNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().substr(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const count = await Order.countDocuments() + 1;
        return `ORD-${year}${month}-${count.toString().padStart(4, '0')}`;
    }

    static async getUserOrders(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const orders = await Order.find({ user: userId })
            .populate('items.product', 'name price image')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Order.countDocuments({ user: userId });

        return {
            orders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalOrders: total
            }
        };
    }

    static async getOrderDetails(orderId, userId) {
        const order = await Order.findById(orderId)
            .populate('items.product')
            .populate('user', 'name email');

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.user._id.toString() !== userId) {
            throw new Error('Unauthorized access to order');
        }

        return order;
    }

    static async updateOrderStatus(orderId, status, userId) {
        const order = await Order.findById(orderId);

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.user.toString() !== userId) {
            throw new Error('Unauthorized access to order');
        }

        const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new Error('Invalid order status');
        }

        if (order.status === 'delivered') {
            throw new Error('Cannot update delivered order');
        }

        if (status === 'cancelled') {
            await this.handleOrderCancellation(order);
        }

        order.status = status;
        await order.save();

        return order;
    }

    static async handleOrderCancellation(order) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Refund payment through Stripe
            await StripeService.refundPayment(order.paymentIntent);

            // Restore product stock
            for (const item of order.items) {
                await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { stock: item.quantity } },
                    { session }
                );
            }

            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
}

// services/StripeService.js
const stripe = require('stripe')(require('config').get('stripeSecretKey'));

class StripeService {
    static async createAndConfirmPayment(amount, paymentMethodId, userId) {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency: 'usd',
            payment_method: paymentMethodId,
            confirmation_method: 'manual',
            confirm: true,
            metadata: { userId }
        });

        return paymentIntent;
    }

    static async refundPayment(paymentIntentId) {
        return await stripe.refunds.create({
            payment_intent: paymentIntentId
        });
    }
}

// routes/orders.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const OrderService = require('../services/OrderService');
const { validateOrderCreation } = require('../middleware/validation');

router.post('/', [auth, validateOrderCreation], async (req, res) => {
    try {
        const { paymentMethodId, shippingAddress } = req.body;
        const order = await OrderService.createOrder(
            req.user.id,
            paymentMethodId,
            shippingAddress
        );
        res.status(201).json({ order });
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(400).json({ message: error.message });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const { page, limit } = req.query;
        const orderData = await OrderService.getUserOrders(
            req.user.id,
            parseInt(page),
            parseInt(limit)
        );
        res.json(orderData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', auth, async (req, res) => {
    try {
        const order = await OrderService.getOrderDetails(req.params.id, req.user.id);
        res.json({ order });
    } catch (error) {
        if (error.message.includes('Unauthorized')) {
            res.status(403);
        } else if (error.message.includes('not found')) {
            res.status(404);
        } else {
            res.status(500);
        }
        res.json({ message: error.message });
    }
});

router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await OrderService.updateOrderStatus(
            req.params.id,
            status,
            req.user.id
        );
        res.json({ order });
    } catch (error) {
        if (error.message.includes('Unauthorized')) {
            res.status(403);
        } else if (error.message.includes('not found')) {
            res.status(404);
        } else {
            res.status(400);
        }
        res.json({ message: error.message });
    }
});

module.exports = router;

// middleware/validation.js
const { check } = require('express-validator');

exports.validateOrderCreation = [
    check('paymentMethodId')
        .notEmpty()
        .withMessage('Payment method is required'),
    check('shippingAddress')
        .isObject()
        .withMessage('Shipping address is required')
        .custom(address => {
            const required = ['street', 'city', 'state', 'zipCode', 'country'];
            return required.every(field => address[field]);
        })
        .withMessage('Invalid shipping address format')
];