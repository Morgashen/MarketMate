const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create a payment intent
router.post('/create-payment-intent', auth, async (req, res) => {
    try {
        const { amount, currency = 'usd', paymentMethodType = 'card' } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to smallest currency unit
            currency,
            payment_method_types: [paymentMethodType],
            metadata: { userId: req.user.id }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Error creating payment intent:', error.message);
        res.status(500).json({ error: 'Error creating payment intent' });
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
        console.error('Error confirming payment:', error.message);
        res.status(500).json({ error: 'Error confirming payment' });
    }
});

// Process a refund
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
        console.error('Error processing refund:', error.message);
        res.status(500).json({ error: 'Error processing refund' });
    }
});

// Retrieve saved payment methods
router.get('/payment-methods', auth, async (req, res) => {
    try {
        const paymentMethods = await stripe.paymentMethods.list({
            customer: req.user.stripeCustomerId,
            type: 'card'
        });

        res.json({ paymentMethods: paymentMethods.data });
    } catch (error) {
        console.error('Error fetching payment methods:', error.message);
        res.status(500).json({ error: 'Error fetching payment methods' });
    }
});

// Add a payment method
router.post('/payment-methods', auth, async (req, res) => {
    try {
        const { paymentMethodId } = req.body;

        const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
            customer: req.user.stripeCustomerId
        });

        res.json({ paymentMethod });
    } catch (error) {
        console.error('Error adding payment method:', error.message);
        res.status(500).json({ error: 'Error adding payment method' });
    }
});

// Delete a payment method
router.delete('/payment-methods/:id', auth, async (req, res) => {
    try {
        const paymentMethod = await stripe.paymentMethods.detach(req.params.id);
        res.json({ paymentMethod });
    } catch (error) {
        console.error('Error removing payment method:', error.message);
        res.status(500).json({ error: 'Error removing payment method' });
    }
});

// Webhook for Stripe events
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
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(400).json({ error: 'Webhook processing error' });
    }
});

// Helper functions for webhook event handling
async function handlePaymentSuccess(paymentIntent) {
    console.log('Payment succeeded:', paymentIntent.id);
    // Add logic to update order status or notify user
}

async function handlePaymentFailure(paymentIntent) {
    console.log('Payment failed:', paymentIntent.id);
    // Add logic to notify the user about payment failure
}

async function handleRefund(charge) {
    console.log('Refund processed:', charge.payment_intent);
    // Add logic to update refund status in the database
}

module.exports = router;