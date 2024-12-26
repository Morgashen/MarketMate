const config = require('config');
const stripe = require('stripe')(config.get('stripe.secretKey'));

class StripeService {
    static async createPaymentIntent(amount, currency = 'usd') {
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100),
                currency
            });
            return paymentIntent;
        } catch (error) {
            console.error('Stripe payment intent creation error:', error);
            throw new Error('Payment processing failed');
        }
    }

    static async confirmPayment(paymentIntentId, paymentMethodId) {
        try {
            return await stripe.paymentIntents.confirm(paymentIntentId, {
                payment_method: paymentMethodId
            });
        } catch (error) {
            console.error('Stripe payment confirmation error:', error);
            throw new Error('Payment confirmation failed');
        }
    }

    static async createRefund(paymentIntentId, amount = null) {
        try {
            const refundParams = {
                payment_intent: paymentIntentId
            };

            if (amount) {
                refundParams.amount = Math.round(amount * 100);
            }

            return await stripe.refunds.create(refundParams);
        } catch (error) {
            console.error('Stripe refund creation error:', error);
            throw new Error('Refund processing failed');
        }
    }
}

module.exports = StripeService;