const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const User = require('../models/User');

class PaymentController {
  // @desc    Create payment intent
  // @route   POST /api/payments/create-intent
  static async createPaymentIntent(req, res) {
    try {
      const { amount, currency = 'usd' } = req.body;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        metadata: {
          userId: req.user.id
        }
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (err) {
      console.error('Payment intent creation error:', err);
      res.status(500).json({ message: 'Error creating payment intent' });
    }
  }

  // @desc    Confirm payment
  // @route   POST /api/payments/confirm
  static async confirmPayment(req, res) {
    try {
      const { paymentIntentId, paymentMethodId } = req.body;

      const paymentIntent = await stripe.paymentIntents.confirm(
        paymentIntentId,
        { payment_method: paymentMethodId }
      );

      res.json({ paymentIntent });
    } catch (err) {
      console.error('Payment confirmation error:', err);
      res.status(500).json({ message: 'Error confirming payment' });
    }
  }

  // @desc    Process refund
  // @route   POST /api/payments/refund
  static async processRefund(req, res) {
    try {
      const { orderId, amount, reason } = req.body;

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const refund = await stripe.refunds.create({
        payment_intent: order.paymentIntent,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: reason || 'requested_by_customer'
      });

      // Update order with refund information
      order.refund = {
        refundId: refund.id,
        amount: amount || order.total,
        reason,
        date: new Date()
      };
      order.status = 'refunded';
      await order.save();

      res.json({ refund, order });
    } catch (err) {
      console.error('Refund processing error:', err);
      res.status(500).json({ message: 'Error processing refund' });
    }
  }

  // @desc    Get payment methods for user
  // @route   GET /api/payments/methods
  static async getPaymentMethods(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user.stripeCustomerId) {
        return res.json({ paymentMethods: [] });
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card'
      });

      res.json({ paymentMethods: paymentMethods.data });
    } catch (err) {
      console.error('Payment methods fetch error:', err);
      res.status(500).json({ message: 'Error fetching payment methods' });
    }
  }

  // @desc    Add payment method
  // @route   POST /api/payments/methods
  static async addPaymentMethod(req, res) {
    try {
      const { paymentMethodId } = req.body;

      // Get or create Stripe customer
      let user = await User.findById(req.user.id);
      if (!user.stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id
          }
        });
        user.stripeCustomerId = customer.id;
        await user.save();
      }

      // Attach payment method to customer
      const paymentMethod = await stripe.paymentMethods.attach(
        paymentMethodId,
        { customer: user.stripeCustomerId }
      );

      res.json({ paymentMethod });
    } catch (err) {
      console.error('Payment method addition error:', err);
      res.status(500).json({ message: 'Error adding payment method' });
    }
  }

  // @desc    Delete payment method
  // @route   DELETE /api/payments/methods/:methodId
  static async deletePaymentMethod(req, res) {
    try {
      const paymentMethod = await stripe.paymentMethods.detach(
        req.params.methodId
      );

      res.json({
        message: 'Payment method removed successfully',
        paymentMethod
      });
    } catch (err) {
      console.error('Payment method deletion error:', err);
      res.status(500).json({ message: 'Error removing payment method' });
    }
  }

  // @desc    Handle Stripe webhook
  // @route   POST /api/payments/webhook
  static async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await PaymentController.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await PaymentController.handlePaymentFailure(event.data.object);
          break;
        case 'charge.refunded':
          await PaymentController.handleRefund(event.data.object);
          break;
      }

      res.json({ received: true });
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(400).json({ message: err.message });
    }
  }

  static async handlePaymentSuccess(paymentIntent) {
    try {
      const order = await Order.findOne({
        paymentIntent: paymentIntent.id
      });

      if (order) {
        order.paymentStatus = 'paid';
        await order.save();
      }
    } catch (err) {
      console.error('Payment success handling error:', err);
    }
  }

  static async handlePaymentFailure(paymentIntent) {
    try {
      const order = await Order.findOne({
        paymentIntent: paymentIntent.id
      });

      if (order) {
        order.paymentStatus = 'failed';
        order.status = 'cancelled';
        await order.save();
      }
    } catch (err) {
      console.error('Payment failure handling error:', err);
    }
  }

  static async handleRefund(charge) {
    try {
      const order = await Order.findOne({
        paymentIntent: charge.payment_intent
      });

      if (order) {
        order.status = 'refunded';
        order.refund = {
          refundId: charge.refunds.data[0].id,
          amount: charge.amount_refunded / 100,
          date: new Date()
        };
        await order.save();
      }
    } catch (err) {
      console.error('Refund handling error:', err);
    }
  }
}

module.exports = PaymentController;