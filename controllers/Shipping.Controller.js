const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const mongoose = require('mongoose');

class ShippingController {
    // @desc    Create new shipment
    // @route   POST /api/shipments
    static async createShipment(req, res) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { orderId, carrier, trackingNumber, shippingMethod } = req.body;

            // Verify order exists
            const order = await Order.findById(orderId).session(session);
            if (!order) {
                await session.abortTransaction();
                return res.status(404).json({ message: 'Order not found' });
            }

            // Create shipment
            const shipment = new Shipment({
                order: orderId,
                tracking: {
                    carrier,
                    trackingNumber,
                    estimatedDelivery: req.body.estimatedDelivery
                },
                status: 'pending',
                shippingAddress: order.shippingAddress,
                shippingMethod,
                weight: req.body.weight,
                dimensions: req.body.dimensions,
                statusHistory: [{
                    status: 'pending',
                    location: 'Warehouse',
                    notes: 'Shipment created'
                }]
            });

            await shipment.save({ session });

            // Update order status
            order.status = 'shipped';
            await order.save({ session });

            await session.commitTransaction();

            await shipment.populate('order');
            res.status(201).json(shipment);
        } catch (err) {
            await session.abortTransaction();
            console.error('Shipment creation error:', err.message);
            res.status(500).json({ message: 'Error creating shipment' });
        } finally {
            session.endSession();
        }
    }

    // @desc    Update shipment status
    // @route   PATCH /api/shipments/:id/status
    static async updateShipmentStatus(req, res) {
        try {
            const { status, location, notes } = req.body;
            const shipment = await Shipment.findById(req.params.id);

            if (!shipment) {
                return res.status(404).json({ message: 'Shipment not found' });
            }

            // Validate status
            const validStatuses = [
                'pending', 'processing', 'shipped', 'in_transit',
                'out_for_delivery', 'delivered', 'failed_delivery', 'returned'
            ];

            if (!validStatuses.includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }

            shipment.status = status;
            shipment.statusHistory.push({
                status,
                location,
                notes,
                timestamp: new Date()
            });

            if (status === 'delivered') {
                shipment.tracking.actualDelivery = new Date();
                // Update order status
                await Order.findByIdAndUpdate(shipment.order, {
                    status: 'delivered'
                });
            }

            await shipment.save();
            res.json(shipment);
        } catch (err) {
            console.error('Shipment status update error:', err.message);
            res.status(500).json({ message: 'Error updating shipment status' });
        }
    }

    // @desc    Get shipment details
    // @route   GET /api/shipments/:id
    static async getShipment(req, res) {
        try {
            const shipment = await Shipment.findById(req.params.id)
                .populate({
                    path: 'order',
                    populate: {
                        path: 'user',
                        select: 'name email'
                    }
                });

            if (!shipment) {
                return res.status(404).json({ message: 'Shipment not found' });
            }

            res.json(shipment);
        } catch (err) {
            console.error('Shipment fetch error:', err.message);
            res.status(500).json({ message: 'Error fetching shipment' });
        }
    }

    // @desc    Get shipments by order
    // @route   GET /api/shipments/order/:orderId
    static async getOrderShipments(req, res) {
        try {
            const shipments = await Shipment.find({ order: req.params.orderId })
                .sort('-createdAt');

            res.json(shipments);
        } catch (err) {
            console.error('Order shipments fetch error:', err.message);
            res.status(500).json({ message: 'Error fetching shipments' });
        }
    }

    // @desc    Update shipping address
    // @route   PATCH /api/shipments/:id/address
    static async updateShippingAddress(req, res) {
        try {
            const shipment = await Shipment.findById(req.params.id);
            if (!shipment) {
                return res.status(404).json({ message: 'Shipment not found' });
            }

            // Only allow address update if shipment hasn't been shipped
            if (shipment.status !== 'pending' && shipment.status !== 'processing') {
                return res.status(400).json({
                    message: 'Cannot update address after shipment has been shipped'
                });
            }

            shipment.shippingAddress = req.body.shippingAddress;
            await shipment.save();

            res.json(shipment);
        } catch (err) {
            console.error('Address update error:', err.message);
            res.status(500).json({ message: 'Error updating shipping address' });
        }
    }

    // @desc    Get shipment tracking history
    // @route   GET /api/shipments/:id/tracking
    static async getTrackingHistory(req, res) {
        try {
            const shipment = await Shipment.findById(req.params.id)
                .select('tracking statusHistory');

            if (!shipment) {
                return res.status(404).json({ message: 'Shipment not found' });
            }

            res.json({
                tracking: shipment.tracking,
                history: shipment.statusHistory.sort((a, b) =>
                    b.timestamp - a.timestamp
                )
            });
        } catch (err) {
            console.error('Tracking history fetch error:', err.message);
            res.status(500).json({ message: 'Error fetching tracking history' });
        }
    }
}

module.exports = ShippingController;