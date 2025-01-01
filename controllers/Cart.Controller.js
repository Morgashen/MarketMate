const Cart = require('../models/Cart');
const Product = require('../models/Product');

const getCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const cart = await Cart.findOne({ userId }).populate('items.product', 'name price imageUrl stock');

        if (!cart) {
            return res.status(200).json({ items: [], total: 0 });
        }

        res.json(cart);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve cart',
            error: error.message
        });
    }
};

const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const userId = req.user.id;

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const existingItem = cart.items.find(item => item.product.toString() === productId);

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.items.push({ product: productId, quantity });
        }

        await cart.save();
        await cart.populate('items.product', 'name price imageUrl');

        res.json(cart);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to add item to cart',
            error: error.message
        });
    }
};

const updateCartItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;
        const userId = req.user.id;

        const cart = await Cart.findOneAndUpdate(
            { userId, 'items._id': id },
            { '$set': { 'items.$.quantity': quantity } },
            { new: true }
        ).populate('items.product', 'name price imageUrl');

        if (!cart) {
            return res.status(404).json({
                status: 'error',
                message: 'Cart item not found'
            });
        }

        res.json(cart);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to update cart item',
            error: error.message
        });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const cart = await Cart.findOneAndUpdate(
            { userId },
            { $pull: { items: { _id: id } } },
            { new: true }
        ).populate('items.product', 'name price imageUrl');

        res.json(cart);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to remove item from cart',
            error: error.message
        });
    }
};

const clearCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const cart = await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } },
            { new: true }
        );

        res.json(cart);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to clear cart',
            error: error.message
        });
    }
};

module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart
};