const express = require('express');
const router = express.Router();
const productController = require('../controllers/Product.Controller');
const auth = require('../middleware/auth');

// Add logging middleware
router.use((req, res, next) => {
    console.log(`Product Route accessed: ${req.method} ${req.path}`);
    next();
});

// Create product
router.post('/', auth, async (req, res) => {
    try {
        await productController.createProduct(req, res);
    } catch (error) {
        console.error('Route error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process request'
        });
    }
});

// Get all products
router.get('/', async (req, res) => {
    try {
        await productController.getProducts(req, res);
    } catch (error) {
        console.error('Route error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch products'
        });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        await productController.getProduct(req, res);
    } catch (error) {
        console.error('Route error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch product'
        });
    }
});

// Update product
router.put('/:id', auth, async (req, res) => {
    try {
        await productController.updateProduct(req, res);
    } catch (error) {
        console.error('Route error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update product'
        });
    }
});

// Delete product
router.delete('/:id', auth, async (req, res) => {
    try {
        await productController.deleteProduct(req, res);
    } catch (error) {
        console.error('Route error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete product'
        });
    }
});

module.exports = router;