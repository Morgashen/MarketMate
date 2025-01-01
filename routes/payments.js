const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const auth = require('../middleware/auth');
const Payment = require('../models/Payment');

router.get('/history', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const payments = await Payment.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Payment.countDocuments({ userId: req.user.id });

        res.json({
            status: 'success',
            data: {
                payments,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    hasMore: skip + payments.length < total
                }
            }
        });
    } catch (error) {
        console.error('Failed to fetch payment history:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch payment history',
            details: error.message
        });
    }
});

router.post('/create-intent', auth, async (req, res) => {
    try {
        const { amount, currency = 'usd' } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid amount'
            });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency,
            metadata: {
                userId: req.user.id
            },
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never'
            }
        });

        await Payment.create({
            userId: req.user.id,
            amount: amount,
            currency: currency,
            paymentIntentId: paymentIntent.id,
            status: 'pending'
        });

        res.json({
            status: 'success',
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Payment intent creation failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create payment intent',
            details: error.message
        });
    }
});

router.post('/confirm-payment', auth, async (req, res) => {
    try {
        const { paymentMethodId, paymentIntentId } = req.body;

        if (!paymentMethodId || !paymentIntentId) {
            return res.status(400).json({
                status: 'error',
                message: 'Payment method and payment intent are required'
            });
        }

        const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
            payment_method: paymentMethodId,
            return_url: process.env.PAYMENT_RETURN_URL || 'http://localhost:3000/payment-complete'
        });

        await Payment.findOneAndUpdate(
            { paymentIntentId: paymentIntentId },
            {
                status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'failed',
                metadata: paymentIntent.metadata,
                errorMessage: paymentIntent.last_payment_error?.message
            },
            { new: true }
        );

        res.json({
            status: 'success',
            payment: {
                id: paymentIntent.id,
                status: paymentIntent.status,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency
            }
        });
    } catch (error) {
        console.error('Payment confirmation failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to confirm payment',
            details: error.message
        });
    }
});

module.exports = router;