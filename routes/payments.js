const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create a payment intent
router.post('/create-payment-intent', auth, async (req, res) => {
    try {
        const { amount, currency = 'usd', paymentMethodType = 'card' } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency,
            payment_method_types: [paymentMethodType],
            metadata: {
                userId: req.user.id
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Payment intent creation error:', error);
        res.status(500).json({ message: 'Error creating payment intent' });
    }
});

// Confirm payment
router.post('/confirm-payment', auth, async (req, res) => {
    try {
        const { paymentIntentId, paymentMethodId } = req.body;

        const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
            payment_method: paymentMethodId
        });

        res.json({ paymentIntent });
    } catch (error) {
        console.error('Payment confirmation error:', error);
        res.status(500).json({ message: 'Error confirming payment' });
    }
});

// Process refund
router.post('/refund', auth, async (req, res) => {
    try {
        const { paymentIntentId, amount, reason } = req.body;

        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: amount ? Math.round(amount * 100) : undefined,
            reason: reason || 'requested_by_customer'
        });

        res.json({ refund });
    } catch (error) {
        console.error('Refund processing error:', error);
        res.status(500).json({ message: 'Error processing refund' });
    }
});

// Retrieve payment method
router.get('/payment-methods', auth, async (req, res) => {
    try {
        const paymentMethods = await stripe.paymentMethods.list({
            customer: req.user.stripeCustomerId,
            type: 'card'
        });

        res.json({ paymentMethods: paymentMethods.data });
    } catch (error) {
        console.error('Payment methods fetch error:', error);
        res.status(500).json({ message: 'Error fetching payment methods' });
    }
});

// Add payment method
router.post('/payment-methods', auth, async (req, res) => {
    try {
        const { paymentMethodId } = req.body;

        const paymentMethod = await stripe.paymentMethods.attach(
            paymentMethodId,
            { customer: req.user.stripeCustomerId }
        );

        res.json({ paymentMethod });
    } catch (error) {
        console.error('Payment method addition error:', error);
        res.status(500).json({ message: 'Error adding payment method' });
    }
});

// Delete payment method
router.delete('/payment-methods/:id', auth, async (req, res) => {
    try {
        const paymentMethod = await stripe.paymentMethods.detach(req.params.id);
        res.json({ paymentMethod });
    } catch (error) {
        console.error('Payment method deletion error:', error);
        res.status(500).json({ message: 'Error removing payment method' });
    }
});

// Webhook handler for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    try {
        const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentSuccess(event.data.object);
                break;
            case 'payment_intent.payment_failed':
                await handlePaymentFailure(event.data.object);
                break;
            case 'charge.refunded':
                await handleRefund(event.data.object);
                break;
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).json({ message: error.message });
    }
});

async function handlePaymentSuccess(paymentIntent) {
    // Implement payment success logic
    console.log('Payment succeeded:', paymentIntent.id);
}

async function handlePaymentFailure(paymentIntent) {
    // Implement payment failure logic
    console.log('Payment failed:', paymentIntent.id);
}

async function handleRefund(charge) {
    // Implement refund logic
    console.log('Payment refunded:', charge.payment_intent);
}

module.exports = router;