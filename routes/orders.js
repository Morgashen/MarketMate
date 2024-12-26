const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create new order
router.post('/', auth, async (req, res) => {
    try {
        const { items, shippingAddress } = req.body;

        // Validate and calculate total
        let total = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(400).json({
                    message: `Product not found in MarketMate catalog (ID: ${item.productId})`
                });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for ${product.name}`
                });
            }

            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: product.price
            });

            total += product.price * item.quantity;
        }

        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(total * 100), // Convert to cents
            currency: 'usd'
        });

        // Create order
        const order = new Order({
            user: req.user.userId,
            items: orderItems,
            total,
            shippingAddress,
            paymentInfo: {
                stripePaymentId: paymentIntent.id,
                status: 'pending'
            }
        });

        await order.save();

        // Update product stock
        for (const item of orderItems) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { stock: -item.quantity }
            });
        }

        res.status(201).json({
            order,
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user's order history
router.get('/history', auth, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.userId })
            .populate('items.product')
            .sort('-createdAt');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Webhook for Stripe payment status updates
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        await Order.findOneAndUpdate(
            { 'paymentInfo.stripePaymentId': paymentIntent.id },
            {
                'paymentInfo.status': 'completed',
                status: 'processing'
            }
        );
    }

    res.json({ received: true });
});

module.exports = router;