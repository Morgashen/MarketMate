const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Initialize or get user's cart
router.get('/', auth, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user.userId })
            .populate('items.product');

        if (!cart) {
            cart = new Cart({ user: req.user.userId, items: [] });
            await cart.save();
        }

        // Check if any products in cart have been deleted or changed price
        const updatedItems = [];
        let hasChanges = false;

        for (const item of cart.items) {
            const currentProduct = await Product.findById(item.product._id);

            if (!currentProduct) {
                hasChanges = true;
                continue; // Skip deleted products
            }

            if (currentProduct.price !== item.priceAtAddition) {
                hasChanges = true;
                item.priceAtAddition = currentProduct.price;
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
            lastUpdated: cart.lastUpdated
        });
    } catch (error) {
        console.error('Cart retrieval error:', error);
        res.status(500).json({
            message: 'Failed to retrieve your MarketMate shopping cart'
        });
    }
});

// Add item to cart
router.post('/items', auth, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { productId, quantity } = req.body;

        // Validate product existence and stock
        const product = await Product.findById(productId);
        if (!product) {
            throw new Error('Product not found in MarketMate catalog');
        }

        if (product.stock < quantity) {
            throw new Error('Requested quantity exceeds available stock');
        }

        let cart = await Cart.findOne({ user: req.user.userId });
        if (!cart) {
            cart = new Cart({ user: req.user.userId, items: [] });
        }

        // Check if product already in cart
        const existingItem = cart.items.find(item =>
            item.product.toString() === productId
        );

        if (existingItem) {
            // Ensure new total quantity doesn't exceed stock
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > product.stock) {
                throw new Error('Total quantity would exceed available stock');
            }
            existingItem.quantity = newQuantity;
            existingItem.priceAtAddition = product.price; // Update to current price
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

        // Populate product details before sending response
        await cart.populate('items.product');

        res.json({
            items: cart.items,
            total: cart.calculateTotal(),
            lastUpdated: cart.lastUpdated
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Add to cart error:', error);
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
});

// Update cart item quantity
router.put('/items/:productId', auth, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { productId } = req.params;
        const { quantity } = req.body;

        if (quantity < 0) {
            throw new Error('Quantity cannot be negative');
        }

        const product = await Product.findById(productId);
        if (!product) {
            throw new Error('Product not found in MarketMate catalog');
        }

        if (quantity > product.stock) {
            throw new Error('Requested quantity exceeds available stock');
        }

        const cart = await Cart.findOne({ user: req.user.userId });
        if (!cart) {
            throw new Error('Cart not found');
        }

        if (quantity === 0) {
            // Remove item from cart
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
            item.priceAtAddition = product.price; // Update to current price
        }

        cart.lastUpdated = Date.now();
        await cart.save({ session });
        await session.commitTransaction();

        await cart.populate('items.product');

        res.json({
            items: cart.items,
            total: cart.calculateTotal(),
            lastUpdated: cart.lastUpdated
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Update cart error:', error);
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
});

// Clear cart
router.delete('/', auth, async (req, res) => {
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
            lastUpdated: Date.now()
        });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({
            message: 'Failed to clear your MarketMate shopping cart'
        });
    }
});

module.exports = router;