const Cart = require('../models/Cart');
const Product = require('../models/Product');
const mongoose = require('mongoose');

class CartController {
    // Get user's cart
    static async getCart(req, res) {
        try {
            let cart = await Cart.findOne({ user: req.user.id })
                .populate({
                    path: 'items.product',
                    select: 'name price description image inStock'  // Keeping the useful fields from previous version
                });

            if (!cart) {
                cart = new Cart({ user: req.user.id, items: [] });
                await cart.save();
            }

            const total = await cart.calculateTotal();
            res.json({ success: true, cart, total });

        } catch (err) {
            console.error('Cart fetch error:', err.message);
            res.status(500).json({ 
                success: false,
                message: 'Error fetching cart' 
            });
        }
    }

    // Add item to cart
    static async addToCart(req, res) {
        try {
            const { productId, quantity } = req.body;

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Invalid product ID' 
                });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Product not found' 
                });
            }

            if (product.stock < quantity) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Insufficient stock' 
                });
            }

            let cart = await Cart.findOne({ user: req.user.id });
            if (!cart) {
                cart = new Cart({ user: req.user.id, items: [] });
            }

            const itemIndex = cart.items.findIndex(
                item => item.product.toString() === productId
            );

            if (itemIndex > -1) {
                cart.items[itemIndex].quantity = quantity;
            } else {
                cart.items.push({ product: productId, quantity });
            }

            await cart.save();
            await cart.populate('items.product');

            const total = await cart.calculateTotal();
            res.json({ 
                success: true,
                cart, 
                total,
                message: 'Item added to cart successfully'
            });

        } catch (err) {
            console.error('Cart update error:', err.message);
            res.status(500).json({ 
                success: false,
                message: 'Error updating cart' 
            });
        }
    }

    // Update cart item quantity
    static async updateCartItem(req, res) {
        try {
            const { quantity } = req.body;
            const productId = req.params.productId;

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Invalid product ID' 
                });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Product not found' 
                });
            }

            if (product.stock < quantity) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Insufficient stock' 
                });
            }

            let cart = await Cart.findOne({ user: req.user.id });
            if (!cart) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Cart not found' 
                });
            }

            const itemIndex = cart.items.findIndex(
                item => item.product.toString() === productId
            );

            if (itemIndex === -1) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Item not found in cart' 
                });
            }

            cart.items[itemIndex].quantity = quantity;
            await cart.save();
            await cart.populate('items.product');

            const total = await cart.calculateTotal();
            res.json({ 
                success: true,
                cart, 
                total,
                message: 'Cart updated successfully'
            });

        } catch (err) {
            console.error('Cart item update error:', err.message);
            res.status(500).json({ 
                success: false,
                message: 'Error updating cart item' 
            });
        }
    }

    // Remove item from cart
    static async removeFromCart(req, res) {
        try {
            const productId = req.params.productId;

            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ 
                    success: false,
                    message: 'Invalid product ID' 
                });
            }

            const cart = await Cart.findOne({ user: req.user.id });
            if (!cart) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Cart not found' 
                });
            }

            cart.items = cart.items.filter(
                item => item.product.toString() !== productId
            );

            await cart.save();
            await cart.populate('items.product');
            
            const total = await cart.calculateTotal();
            res.json({ 
                success: true,
                cart, 
                total,
                message: 'Item removed successfully' 
            });

        } catch (err) {
            console.error('Cart item removal error:', err.message);
            res.status(500).json({ 
                success: false,
                message: 'Error removing item from cart' 
            });
        }
    }

    // Clear cart
    static async clearCart(req, res) {
        try {
            const cart = await Cart.findOne({ user: req.user.id });
            if (!cart) {
                return res.status(404).json({ 
                    success: false,
                    message: 'Cart not found' 
                });
            }

            cart.items = [];
            await cart.save();

            res.json({ 
                success: true,
                message: 'Cart cleared successfully', 
                cart 
            });

        } catch (err) {
            console.error('Cart clear error:', err.message);
            res.status(500).json({ 
                success: false,
                message: 'Error clearing cart' 
            });
        }
    }

    // Get cart summary
    static async getCartSummary(req, res) {
        try {
            const cart = await Cart.findOne({ user: req.user.id })
                .populate('items.product');

            if (!cart) {
                return res.json({
                    success: true,
                    itemCount: 0,
                    total: 0,
                    items: []
                });
            }

            const total = await cart.calculateTotal();
            const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

            res.json({
                success: true,
                itemCount,
                total,
                items: cart.items.map(item => ({
                    name: item.product.name,
                    quantity: item.quantity,
                    price: item.product.price,
                    subtotal: item.quantity * item.product.price
                }))
            });

        } catch (err) {
            console.error('Cart summary error:', err.message);
            res.status(500).json({ 
                success: false,
                message: 'Error fetching cart summary' 
            });
        }
    }
}

module.exports = CartController;