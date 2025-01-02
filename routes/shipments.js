const express = require('express');
const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');
const router = express.Router();

// Get all shipments with filtering
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            carrier,
            status,
            fromDate,
            toDate
        } = req.query;

        // Build query
        const query = {};
        if (carrier) query.carrier = carrier;
        if (status) query.status = status;
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }

        // Execute query with pagination
        const totalItems = await Shipment.countDocuments(query);
        const shipments = await Shipment.find(query)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            data: {
                shipments: shipments.map(shipment => ({
                    id: shipment._id,
                    orderId: shipment.orderId,
                    carrier: shipment.carrier,
                    trackingNumber: shipment.trackingNumber,
                    status: shipment.status,
                    shippingAddress: shipment.shippingAddress,
                    estimatedDeliveryDate: shipment.estimatedDeliveryDate,
                    createdAt: shipment.createdAt
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalItems / limit),
                    totalItems,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching shipments:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch shipments',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get specific shipment by ID
router.get('/:shipmentId', async (req, res) => {
    try {
        const { shipmentId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(shipmentId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid shipment ID format'
            });
        }

        const shipment = await Shipment.findById(shipmentId);

        if (!shipment) {
            return res.status(404).json({
                status: 'error',
                message: 'Shipment not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: shipment
        });
    } catch (error) {
        console.error('Error fetching shipment:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch shipment details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get shipments by order ID
router.get('/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid order ID format'
            });
        }

        const shipments = await Shipment.find({ orderId });

        res.status(200).json({
            status: 'success',
            data: { shipments }
        });
    } catch (error) {
        console.error('Error fetching order shipments:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch order shipments',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get tracking information
router.get('/tracking/:trackingNumber', async (req, res) => {
    try {
        const { trackingNumber } = req.params;

        const shipment = await Shipment.findOne({ trackingNumber });

        if (!shipment) {
            return res.status(404).json({
                status: 'error',
                message: 'Tracking number not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: {
                trackingNumber: shipment.trackingNumber,
                carrier: shipment.carrier,
                status: shipment.status,
                estimatedDeliveryDate: shipment.estimatedDeliveryDate,
                events: shipment.events,
                lastUpdated: shipment.updatedAt
            }
        });
    } catch (error) {
        console.error('Error fetching tracking information:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch tracking information',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Create shipment for order
router.post('/orders', async (req, res) => {
    try {
        const {
            orderId,
            carrier,
            trackingNumber,
            shippingAddress,
            estimatedDeliveryDate
        } = req.body;

        // Validate required fields
        if (!orderId || !carrier || !trackingNumber || !shippingAddress) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields'
            });
        }

        // Validate orderId format
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid order ID format'
            });
        }

        // Create initial shipment event
        const initialEvent = {
            status: 'label_created',
            description: 'Shipping label created',
            location: 'System'
        };

        // Create new shipment
        const shipment = new Shipment({
            orderId,
            carrier,
            trackingNumber,
            shippingAddress,
            estimatedDeliveryDate,
            status: 'label_created',
            events: [initialEvent]
        });

        await shipment.save();

        res.status(201).json({
            status: 'success',
            message: 'Shipment created successfully',
            data: shipment
        });
    } catch (error) {
        // Handle duplicate tracking number
        if (error.code === 11000) {
            return res.status(400).json({
                status: 'error',
                message: 'Tracking number already exists'
            });
        }

        console.error('Error creating shipment:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create shipment',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;