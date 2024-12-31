const express = require('express');
const router = express.Router();
const cartController = require('../controllers/Cart.Controller');
const auth = require('../middleware/auth'); // Your authentication middleware

// Each route uses a specific controller method
router.get('/', auth, cartController.getCart);
router.post('/add', auth, cartController.addToCart);
router.put('/update', auth, cartController.updateCartItem);
router.delete('/remove/:productId', auth, cartController.removeFromCart);
router.delete('/clear', auth, cartController.clearCart);

module.exports = router;