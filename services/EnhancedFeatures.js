const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const StripeService = require('./StripeService');
const NotificationService = require('./NotificationService');

class OrderService {
    static async createOrder(userId, paymentMethodId, shippingAddress) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const cart = await Cart.findOne({ user: userId })
                .populate('items.product')
                .session(session);

            if (!cart || cart.items.length === 0) {
                throw new Error('Cart is empty');
            }

            const { orderItems, total } = await this.validateAndPrepareOrderItems(cart, session);

            const paymentIntent = await StripeService.createAndConfirmPayment(
                total,
                paymentMethodId,
                userId
            );

            const order = await this.saveOrder(
                userId,
                orderItems,
                total,
                shippingAddress,
                paymentIntent.id,
                session
            );

            await this.clearCart(cart, session);
            await session.commitTransaction();

            // Send order confirmation email
            const user = await User.findById(userId);
            await NotificationService.sendOrderConfirmation(order, user);

            return order;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    static async validateAndPrepareOrderItems(cart, session) {
        const orderItems = [];
        let total = 0;

        for (const item of cart.items) {
            const product = await Product.findById(item.product._id).session(session);

            if (!product) {
                throw new Error(`Product not found: ${item.product._id}`);
            }

            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for product: ${product.name}`);
            }

            product.stock -= item.quantity;
            await product.save({ session });

            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: product.price
            });

            total += product.price * item.quantity;
        }

        return { orderItems, total };
    }

    static async saveOrder(userId, items, total, shippingAddress, paymentIntentId, session) {
        const order = new Order({
            user: userId,
            items,
            total,
            shippingAddress,
            paymentIntent: paymentIntentId,
            status: 'processing',
            orderNumber: await this.generateOrderNumber()
        });

        await order.save({ session });
        return order;
    }

    static async generateOrderNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().substr(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const count = await Order.countDocuments() + 1;
        return `ORD-${year}${month}-${count.toString().padStart(4, '0')}`;
    }

    static async getUserOrders(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const orders = await Order.find({ user: userId })
            .populate('items.product', 'name price image')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Order.countDocuments({ user: userId });

        return {
            orders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalOrders: total
            }
        };
    }

    static async getOrderDetails(orderId, userId) {
        const order = await Order.findById(orderId)
            .populate('items.product')
            .populate('user', 'name email');

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.user._id.toString() !== userId) {
            throw new Error('Unauthorized access to order');
        }

        return order;
    }

    static async updateOrderStatus(orderId, status, userId) {
        const order = await Order.findById(orderId);

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.user.toString() !== userId) {
            throw new Error('Unauthorized access to order');
        }

        const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new Error('Invalid order status');
        }

        if (order.status === 'delivered') {
            throw new Error('Cannot update delivered order');
        }

        if (status === 'cancelled') {
            await this.handleOrderCancellation(order);
        }

        order.status = status;
        await order.save();

        // Send status update notification
        const user = await User.findById(userId);
        await NotificationService.sendStatusUpdate(order, user);

        return order;
    }

    static async addShippingInfo(orderId, trackingInfo) {
        const order = await Order.findById(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        order.shipping = {
            carrier: trackingInfo.carrier,
            trackingNumber: trackingInfo.trackingNumber,
            estimatedDelivery: trackingInfo.estimatedDelivery
        };
        order.status = 'shipped';

        await order.save();

        const user = await User.findById(order.user);
        await NotificationService.sendShippingUpdate(order, user, trackingInfo);

        return order;
    }

    static async processRefund(orderId, userId, refundReason) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const order = await Order.findById(orderId).session(session);

            if (!order) {
                throw new Error('Order not found');
            }

            if (order.user.toString() !== userId) {
                throw new Error('Unauthorized access to order');
            }

            if (!['damaged', 'wrong_item', 'not_received'].includes(refundReason)) {
                throw new Error('Invalid refund reason');
            }

            const refund = await StripeService.refundPayment(order.paymentIntent);

            order.refund = {
                amount: order.total,
                reason: refundReason,
                processedAt: new Date(),
                refundId: refund.id
            };
            order.status = 'refunded';

            await order.save({ session });

            // Restore product stock
            for (const item of order.items) {
                await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { stock: item.quantity } },
                    { session }
                );
            }

            await session.commitTransaction();

            // Send refund notification
            const user = await User.findById(userId);
            await NotificationService.sendRefundConfirmation(order, user);

            return order;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    static async generateInvoice(orderId, userId) {
        const order = await Order.findById(orderId)
            .populate('items.product')
            .populate('user', 'name email');

        if (!order) {
            throw new Error('Order not found');
        }

        if (order.user._id.toString() !== userId) {
            throw new Error('Unauthorized access to order');
        }

        const invoice = {
            orderNumber: order.orderNumber,
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
            paymentStatus: order.status,
            shippingInfo: order.shipping || null
        };

        return invoice;
    }

    static async clearCart(cart, session) {
        cart.items = [];
        await cart.save({ session });
    }

    static async handleOrderCancellation(order) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
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
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
}

module.exports = OrderService;