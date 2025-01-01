const express = require('express');
const router = express.Router();
const OrdersController = require('../controllers/OrdersController'); // Ensure this file exists and is implemented

// Define the `/orders` routes
router.get('/orders', OrdersController.getOrders);
router.post('/orders', OrdersController.createOrder);

// Export the router
module.exports = router;