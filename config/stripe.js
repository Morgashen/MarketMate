const dotenv = require('dotenv')
const Stripe = require('stripe');

dotenv.config()

/**
 * Setup Stripe payment
 */
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = stripe;