const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const { check, validationResult } = require('express-validator');

// Create shipment for an order
router.post('/', [auth, [
    check('orderId', 'Order ID is required').notEmpty(),
    check('carrier', 'Valid carrier is required').isIn(['USPS', 'FedEx', 'UPS', 'DHL']),
    check('trackingNumber', 'Tracking number is required').notEmpty(),
    check('shippingMethod', 'Valid shipping method is required').isIn(['standard', 'express', 'overnight'])
]], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const order = await Order.findById(req.body.orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const shipment = new Shipment({
            order: order._id,
            tracking: {
                carrier: req.body.carrier,
                trackingNumber: req.body.trackingNumber,
                estimatedDelivery: req.body.estimatedDelivery
            },
            shippingAddress: order.shippingAddress,
            shippingMethod: req.body.shippingMethod,
            weight: req.body.weight,
            dimensions: req.body.dimensions,
            statusHistory: [{
                status: 'pending',
                notes: 'Shipment created'
            }]
        });

        await shipment.save();

        // Update order status
        order.status = 'shipped';
        await order.save();

        res.status(201).json(shipment);
    } catch (error) {
        console.error('Shipment creation error:', error);
        res.status(500).json({ message: 'Error creating shipment' });
    }
});

// Update shipment status
router.patch('/:id/status', [auth, [
    check('status', 'Valid status is required').isIn([
        'processing', 'shipped', 'in_transit', 'out_for_delivery',
        'delivered', 'failed_delivery', 'returned'
    ]),
    check('location', 'Location is required').notEmpty()
]], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) {
            return res.status(404).json({ message: 'Shipment not found' });
        }

        shipment.status = req.body.status;
        shipment.statusHistory.push({
            status: req.body.status,
            location: req.body.location,
            notes: req.body.notes
        });

        if (req.body.status === 'delivered') {
            shipment.tracking.actualDelivery = new Date();
            const order = await Order.findById(shipment.order);
            if (order) {
                order.status = 'delivered';
                await order.save();
            }
        }

        await shipment.save();
        res.json(shipment);
    } catch (error) {
        console.error('Shipment update error:', error);
        res.status(500).json({ message: 'Error updating shipment' });
    }
});

// Get shipment details
router.get('/:id', auth, async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id)
            .populate('order');

        if (!shipment) {
            return res.status(404).json({ message: 'Shipment not found' });
        }

        res.json(shipment);
    } catch (error) {
        console.error('Shipment fetch error:', error);
        res.status(500).json({ message: 'Error fetching shipment' });
    }
});

// Get shipments for an order
router.get('/order/:orderId', auth, async (req, res) => {
    try {
        const shipments = await Shipment.find({ order: req.params.orderId })
            .sort('-createdAt');
        res.json(shipments);
    } catch (error) {
        console.error('Shipments fetch error:', error);
        res.status(500).json({ message: 'Error fetching shipments' });
    }
});

module.exports = router;