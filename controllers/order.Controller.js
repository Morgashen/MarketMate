const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const StripeService = require('../services/StripeService');

class OrderController {
  // @desc    Create new order
  // @route   POST /api/orders
  static async createOrder(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { paymentMethodId, shippingAddress } = req.body;

      // Get user's cart
      const cart = await Cart.findOne({ user: req.user.id })
        .populate('items.product')
        .session(session);

      if (!cart || cart.items.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Cart is empty' });
      }

      // Calculate total and validate stock
      let total = 0;
      const orderItems = [];

      for (const item of cart.items) {
        const product = await Product.findById(item.product._id)
          .session(session);

        if (!product) {
          await session.abortTransaction();
          return res.status(404).json({
            message: `Product not found: ${item.product._id}`
          });
        }

        if (product.stock < item.quantity) {
          await session.abortTransaction();
          return res.status(400).json({
            message: `Insufficient stock for ${product.name}`
          });
        }

        // Update product stock
        product.stock -= item.quantity;
        await product.save({ session });

        total += product.price * item.quantity;
        orderItems.push({
          product: product._id,
          quantity: item.quantity,
          price: product.price
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
        status: 'processing'
      });

      await order.save({ session });

      // Clear cart
      cart.items = [];
      await cart.save({ session });

      await session.commitTransaction();

      // Populate order details for response
      await order.populate('items.product');

      res.status(201).json({ order });
    } catch (err) {
      await session.abortTransaction();
      console.error('Order creation error:', err);
      res.status(500).json({ message: 'Error creating order' });
    } finally {
      session.endSession();
    }
  }

  // @desc    Get all orders for user
  // @route   GET /api/orders
  static async getUserOrders(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const query = { user: req.user.id };

      if (status) {
        query.status = status;
      }

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
        totalOrders: total
      });
    } catch (err) {
      console.error('Orders fetch error:', err.message);
      res.status(500).json({ message: 'Error fetching orders' });
    }
  }

  // @desc    Get order by ID
  // @route   GET /api/orders/:id
  static async getOrder(req, res) {
    try {
      const order = await Order.findById(req.params.id)
        .populate('items.product')
        .populate('user', 'name email');

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Verify user owns this order
      if (order.user._id.toString() !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized' });
      }

      res.json(order);
    } catch (err) {
      console.error('Order fetch error:', err.message);
      res.status(500).json({ message: 'Error fetching order' });
    }
  }

  // @desc    Update order status
  // @route   PATCH /api/orders/:id/status
  static async updateOrderStatus(req, res) {
    try {
      const { status } = req.body;
      const order = await Order.findById(req.params.id);

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Verify user owns this order or is admin
      if (order.user.toString() !== req.user.id && !req.user.isAdmin) {
        return res.status(401).json({ message: 'Not authorized' });
      }

      // Validate status transition
      const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      if (order.status === 'delivered' && status !== 'delivered') {
        return res.status(400).json({
          message: 'Cannot update status of delivered order'
        });
      }

      if (status === 'cancelled') {
        await OrderController.handleOrderCancellation(order);
      }

      order.status = status;
      await order.save();

      res.json(order);
    } catch (err) {
      console.error('Order status update error:', err.message);
      res.status(500).json({ message: 'Error updating order status' });
    }
  }

  // Handle order cancellation
  static async handleOrderCancellation(order) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Process refund through Stripe
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
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // @desc    Generate order invoice
  // @route   GET /api/orders/:id/invoice
  static async generateInvoice(req, res) {
    try {
      const order = await Order.findById(req.params.id)
        .populate('items.product')
        .populate('user', 'name email');

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      if (order.user._id.toString() !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized' });
      }

      const invoice = {
        orderNumber: order._id,
        date: order.createdAt,
        customerInfo: {
          name: order.user.name,
          email: order.user.email,
          shippingAddress: order.shippingAddress
        },
        items: order.items.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price
        })),
        subtotal: order.total,
        tax: order.total * 0.1,
        total: order.total * 1.1,
        status: order.status
      };

      res.json(invoice);
    } catch (err) {
      console.error('Invoice generation error:', err.message);
      res.status(500).json({ message: 'Error generating invoice' });
    }
  }
}

module.exports = OrderController;