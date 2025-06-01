const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const auth = require('../middleware/auth');

router.post('/create-checkout-session', auth, async (req, res) => {
    const { cartItems } = req.body;

    try {
        // Convert cartItems to Stripe line items format
        const lineItems = cartItems.map(item => ({
            price_data: {
                currency: 'RandomCurrency', // Replace with your currency
                product_data: {
                    name: item.name,
                    images: [item.image],
                },
                unit_amount: Math.round(item.price * 100), // cents
            },
            quantity: 1,
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: lineItems,
            success_url: `${process.env.CLIENT_URL}/success`,
            cancel_url: `${process.env.CLIENT_URL}/cancel`,
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Stripe session error:', error.message);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});