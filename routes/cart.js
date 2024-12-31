const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

// Rate limiting configuration for different cart operations
const cartViewLimit = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minute window
    max: 100,                  // 100 requests per window
    message: {
        error: 'Too many cart view requests. Please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const cartModifyLimit = rateLimit({
    windowMs: 5 * 60 * 1000,   // 5 minute window
    max: 30,                   // 30 modifications per window
    message: {
        error: 'Too many cart modifications. Please try again later.',
        retryAfter: '5 minutes'
    }
});

// Input validation middleware
const validateCartItem = (req, res, next) => {
    const { productId, quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
            message: 'Invalid product ID format',
            details: 'Product ID must be a valid MongoDB ObjectId'
        });
    }

    if (!Number.isInteger(quantity)) {
        return res.status(400).json({
            message: 'Invalid quantity format',
            details: 'Quantity must be a whole number'
        });
    }

    if (quantity < 0) {
        return res.status(400).json({
            message: 'Invalid quantity value',
            details: 'Quantity cannot be negative'
        });
    }

    if (quantity > 100) {
        return res.status(400).json({
            message: 'Quantity too large',
            details: 'Maximum quantity per item is 100'
        });
    }

    next();
};

// Global middleware for cart routes
router.use((req, res, next) => {
    // Security headers
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    next();
});

// Get cart contents
router.get('/', cartViewLimit, auth, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user.userId })
            .populate('items.product');

        if (!cart) {
            cart = new Cart({ user: req.user.userId, items: [] });
            await cart.save();
        }

        // Synchronize cart with current product data
        const updatedItems = [];
        let hasChanges = false;

        for (const item of cart.items) {
            const currentProduct = await Product.findById(item.product._id);

            if (!currentProduct) {
                hasChanges = true;
                continue; // Remove deleted products
            }

            if (currentProduct.price !== item.priceAtAddition) {
                hasChanges = true;
                item.priceAtAddition = currentProduct.price;
            }

            // Ensure quantity doesn't exceed current stock
            if (item.quantity > currentProduct.stock) {
                hasChanges = true;
                item.quantity = currentProduct.stock;
            }

            updatedItems.push(item);
        }

        if (hasChanges) {
            cart.items = updatedItems;
            cart.lastUpdated = Date.now();
            await cart.save();
        }

        res.json({
            items: cart.items,
            total: cart.calculateTotal(),
            lastUpdated: cart.lastUpdated,
            itemCount: cart.items.length
        });
    } catch (error) {
        console.error('Cart retrieval error:', error);
        res.status(500).json({
            message: 'Failed to retrieve cart',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Add item to cart
router.post('/items', cartModifyLimit, auth, validateCartItem, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { productId, quantity } = req.body;

        const product = await Product.findById(productId).session(session);
        if (!product) {
            throw new Error('Product not found');
        }

        if (product.stock < quantity) {
            throw new Error(`Only ${product.stock} units available`);
        }

        let cart = await Cart.findOne({ user: req.user.userId }).session(session);
        if (!cart) {
            cart = new Cart({ user: req.user.userId, items: [] });
        }

        const existingItem = cart.items.find(item =>
            item.product.toString() === productId
        );

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > product.stock) {
                throw new Error(`Cannot add ${quantity} more units. Cart would exceed available stock`);
            }
            existingItem.quantity = newQuantity;
            existingItem.priceAtAddition = product.price;
        } else {
            cart.items.push({
                product: productId,
                quantity,
                priceAtAddition: product.price
            });
        }

        cart.lastUpdated = Date.now();
        await cart.save({ session });
        await session.commitTransaction();

        // Populate product details for response
        await cart.populate('items.product');

        res.json({
            items: cart.items,
            total: cart.calculateTotal(),
            lastUpdated: cart.lastUpdated,
            itemCount: cart.items.length
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Add to cart error:', error);
        res.status(400).json({
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        session.endSession();
    }
});

// Update cart item quantity
router.put('/items/:productId', cartModifyLimit, auth, validateCartItem, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { productId } = req.params;
        const { quantity } = req.body;

        const product = await Product.findById(productId).session(session);
        if (!product) {
            throw new Error('Product not found');
        }

        if (quantity > product.stock) {
            throw new Error(`Only ${product.stock} units available`);
        }

        const cart = await Cart.findOne({ user: req.user.userId }).session(session);
        if (!cart) {
            throw new Error('Cart not found');
        }

        if (quantity === 0) {
            cart.items = cart.items.filter(item =>
                item.product.toString() !== productId
            );
        } else {
            const item = cart.items.find(item =>
                item.product.toString() === productId
            );

            if (!item) {
                throw new Error('Item not found in cart');
            }

            item.quantity = quantity;
            item.priceAtAddition = product.price;
        }

        cart.lastUpdated = Date.now();
        await cart.save({ session });
        await session.commitTransaction();

        await cart.populate('items.product');

        res.json({
            items: cart.items,
            total: cart.calculateTotal(),
            lastUpdated: cart.lastUpdated,
            itemCount: cart.items.length
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Update cart error:', error);
        res.status(400).json({
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        session.endSession();
    }
});

// Clear cart
router.delete('/', cartModifyLimit, auth, async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user.userId });
        if (cart) {
            cart.items = [];
            cart.lastUpdated = Date.now();
            await cart.save();
        }

        res.json({
            items: [],
            total: 0,
            lastUpdated: Date.now(),
            itemCount: 0
        });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({
            message: 'Failed to clear cart',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;