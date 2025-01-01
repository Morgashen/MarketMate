const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const StripeService = require('../services/StripeService');

const VALID_STATUSES = ['processing', 'shipped', 'delivered', 'cancelled'];

const handleError = (res, statusCode, message) => res.status(statusCode).json({ message });

class OrderController {
  static async createOrder(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { paymentMethodId, shippingAddress } = req.body;

      // Fetch user's cart
      const cart = await Cart.findOne({ user: req.user.id })
        .populate('items.product')
        .session(session);

      if (!cart || cart.items.length === 0) {
        await session.abortTransaction();
        return handleError(res, 400, 'Cart is empty');
      }

      // Validate stock and calculate total
      let total = 0;
      const orderItems = [];

      for (const item of cart.items) {
        const product = await Product.findById(item.product._id).session(session);

        if (!product) {
          await session.abortTransaction();
          return handleError(res, 404, `Product not found: ${item.product._id}`);
        }

        if (product.stock < item.quantity) {
          await session.abortTransaction();
          return handleError(res, 400, `Insufficient stock for ${product.name}`);
        }

        product.stock -= item.quantity;
        await product.save({ session });

        total += product.price * item.quantity;
        orderItems.push({
          product: product._id,
          quantity: item.quantity,
          price: product.price,
        });
      }

      // Process payment
      const paymentIntent = await StripeService.createAndConfirmPayment(
        total,
        paymentMethodId,
        req.user.id
      );

      // Create order
      const order = new Order({
        user: req.user.id,
        items: orderItems,
        total,
        shippingAddress,
        paymentIntent: paymentIntent.id,
        status: 'processing',
      });

      await order.save({ session });

      // Clear cart
      cart.items = [];
      await cart.save({ session });

      await session.commitTransaction();
      await order.populate('items.product');

      res.status(201).json({ order });
    } catch (err) {
      await session.abortTransaction();
      console.error('Order creation error:', err.message);
      handleError(res, 500, 'Error creating order');
    } finally {
      session.endSession();
    }
  }

  static async getUserOrders(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const query = { user: req.user.id };

      if (status) query.status = status;

      const orders = await Order.find(query)
        .populate('items.product')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Order.countDocuments(query);

      res.json({
        orders,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
      });
    } catch (err) {
      console.error('Orders fetch error:', err.message);
      handleError(res, 500, 'Error fetching orders');
    }
  }

  static async getOrder(req, res) {
    try {
      const order = await Order.findById(req.params.id)
        .populate('items.product')
        .populate('user', 'name email');

      if (!order) {
        return handleError(res, 404, 'Order not found');
      }

      if (order.user._id.toString() !== req.user.id) {
        return handleError(res, 401, 'Not authorized');
      }

      res.json(order);
    } catch (err) {
      console.error('Order fetch error:', err.message);
      handleError(res, 500, 'Error fetching order');
    }
  }

  static async updateOrderStatus(req, res) {
    try {
      const { status } = req.body;
      const order = await Order.findById(req.params.id);

      if (!order) {
        return handleError(res, 404, 'Order not found');
      }

      if (order.user.toString() !== req.user.id && !req.user.isAdmin) {
        return handleError(res, 401, 'Not authorized');
      }

      if (!VALID_STATUSES.includes(status)) {
        return handleError(res, 400, 'Invalid status');
      }

      if (order.status === 'delivered' && status !== 'delivered') {
        return handleError(res, 400, 'Cannot update status of delivered order');
      }

      if (status === 'cancelled') {
        await OrderController.handleOrderCancellation(order);
      }

      order.status = status;
      await order.save();

      res.json(order);
    } catch (err) {
      console.error('Order status update error:', err.message);
      handleError(res, 500, 'Error updating order status');
    }
  }
}

module.exports = OrderController;