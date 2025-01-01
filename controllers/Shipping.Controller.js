const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ShippingController = require('../controllers/Shipping.Controller');
const { check, validationResult } = require('express-validator');

// Validation middleware for shipment creation
const createShipmentValidation = [
    check('orderId', 'Order ID is required').notEmpty(),
    check('carrier', 'Valid carrier is required').isIn(['USPS', 'FedEx', 'UPS', 'DHL']),
    check('trackingNumber', 'Tracking number is required').notEmpty(),
    check('shippingMethod', 'Valid shipping method is required').isIn(['standard', 'express', 'overnight'])
];

// Validation middleware for status updates
const updateStatusValidation = [
    check('status', 'Valid status is required').isIn([
        'processing', 'shipped', 'in_transit', 'out_for_delivery',
        'delivered', 'failed_delivery', 'returned'
    ]),
    check('location', 'Location is required').notEmpty()
];

// Route handler for request debugging
router.use((req, res, next) => {
    console.log(`Shipment Route Accessed: ${req.method} ${req.originalUrl}`);
    next();
});

// Order-specific routes should be defined first
router.get('/order/:orderId', auth, ShippingController.getOrderShipments);

// Create new shipment
router.post('/', [auth, createShipmentValidation], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        await ShippingController.createShipment(req, res);
    } catch (error) {
        console.error('Error creating shipment:', error);
        next(error); // Pass the error to the next middleware
    }
});

// Get tracking history
router.get('/:id/tracking', auth, ShippingController.getTrackingHistory);

// Update shipping address
router.patch('/:id/address', auth, ShippingController.updateShippingAddress);

// Update shipment status
router.patch('/:id/status', [auth, updateStatusValidation], async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        await ShippingController.updateShipmentStatus(req, res);
    } catch (error) {
        console.error('Error updating shipment status:', error);
        next(error); // Pass the error to the next middleware
    }
});

// Get single shipment details
router.get('/:id', auth, ShippingController.getShipment);

module.exports = router;