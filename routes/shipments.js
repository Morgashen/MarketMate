const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const { check, validationResult } = require('express-validator');

// Debug middleware for API route tracking
router.use((req, res, next) => {
    console.log('API Request:', {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        params: req.params,
        query: req.query
    });
    next();
});

// Get all shipments for an order
router.get('/order/:orderId', auth, async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid order ID format'
            });
        }

        const shipments = await Shipment.find({ order: orderId })
            .sort('-createdAt')
            .populate('order')
            .populate('user', '-password');

        return res.status(200).json({
            status: 'success',
            data: { shipments }
        });
    } catch (error) {
        console.error('Error fetching shipments:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch shipments',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Create new shipment for order
router.post('/order/:orderId', auth, [
    check('paymentMethodId', 'Payment method ID is required').notEmpty(),
    check('paymentIntentId', 'Payment intent ID is required').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid input data',
                errors: errors.array()
            });
        }

        const { orderId } = req.params;
        const { paymentMethodId, paymentIntentId } = req.body;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid order ID format'
            });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                status: 'error',
                message: 'Order not found'
            });
        }

        const shipment = new Shipment({
            order: orderId,
            user: userId,
            paymentMethodId,
            paymentIntentId,
            status: 'pending',
            statusHistory: [{
                status: 'pending',
                timestamp: new Date(),
                notes: 'Shipment created'
            }],
            shippingAddress: order.shippingAddress
        });

        const savedShipment = await shipment.save();
        await Order.findByIdAndUpdate(orderId, {
            status: 'processing',
            shipment: savedShipment._id
        });

        return res.status(201).json({
            status: 'success',
            message: 'Shipment created successfully',
            data: {
                shipment: {
                    id: savedShipment._id,
                    status: savedShipment.status,
                    orderId: savedShipment.order
                }
            }
        });
    } catch (error) {
        console.error('Error creating shipment:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to create shipment',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get shipment by ID
router.get('/:shipmentId', auth, async (req, res) => {
    try {
        const { shipmentId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid shipment ID format'
            });
        }

        const shipment = await Shipment.findById(shipmentId)
            .populate('order')
            .populate('user', '-password');

        if (!shipment) {
            return res.status(404).json({
                status: 'error',
                message: 'Shipment not found'
            });
        }

        return res.status(200).json({
            status: 'success',
            data: {
                shipment
            }
        });
    } catch (error) {
        console.error('Error fetching shipment:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch shipment details',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update shipment tracking information
router.put('/:shipmentId/tracking', auth, [
    check('carrier', 'Carrier is required').isIn(['USPS', 'FedEx', 'UPS', 'DHL']),
    check('trackingNumber', 'Tracking number is required').notEmpty(),
    check('shippingMethod', 'Shipping method is required').isIn(['standard', 'express', 'overnight'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid input data',
                errors: errors.array()
            });
        }

        const { shipmentId } = req.params;
        const { carrier, trackingNumber, shippingMethod, estimatedDelivery } = req.body;

        const shipment = await Shipment.findById(shipmentId);
        if (!shipment) {
            return res.status(404).json({
                status: 'error',
                message: 'Shipment not found'
            });
        }

        shipment.tracking = {
            carrier,
            trackingNumber,
            estimatedDelivery: estimatedDelivery || null
        };
        shipment.shippingMethod = shippingMethod;
        shipment.status = 'processing';
        shipment.statusHistory.push({
            status: 'processing',
            timestamp: new Date(),
            notes: `Tracking information added: ${carrier} - ${trackingNumber}`
        });

        const updatedShipment = await shipment.save();

        return res.status(200).json({
            status: 'success',
            message: 'Tracking information updated successfully',
            data: {
                shipment: updatedShipment
            }
        });
    } catch (error) {
        console.error('Error updating tracking information:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to update tracking information',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update shipment status
router.patch('/:shipmentId/status', auth, [
    check('status', 'Valid status is required').isIn([
        'pending', 'processing', 'shipped', 'delivered', 'cancelled'
    ]),
    check('notes', 'Status update notes are required').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid input data',
                errors: errors.array()
            });
        }

        const { shipmentId } = req.params;
        const { status, notes } = req.body;

        const shipment = await Shipment.findById(shipmentId);
        if (!shipment) {
            return res.status(404).json({
                status: 'error',
                message: 'Shipment not found'
            });
        }

        shipment.status = status;
        shipment.statusHistory.push({
            status,
            timestamp: new Date(),
            notes
        });

        if (status === 'delivered') {
            shipment.tracking.actualDelivery = new Date();
            await Order.findByIdAndUpdate(shipment.order, { status: 'delivered' });
        }

        const updatedShipment = await shipment.save();

        return res.status(200).json({
            status: 'success',
            message: 'Shipment status updated successfully',
            data: {
                shipment: updatedShipment
            }
        });
    } catch (error) {
        console.error('Error updating shipment status:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to update shipment status',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;