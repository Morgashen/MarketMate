const Cart = require('../models/Cart');
const Product = require('../models/Product');

class CartController {
  // @desc    Get user's cart
  // @route   GET /api/cart
  static async getCart(req, res) {
    try {
      let cart = await Cart.findOne({ user: req.user.id })
        .populate('items.product');

      if (!cart) {
        cart = new Cart({ user: req.user.id, items: [] });
        await cart.save();
      }

      const total = await cart.calculateTotal();
      res.json({ cart, total });
    } catch (err) {
      console.error('Cart fetch error:', err.message);
      res.status(500).json({ message: 'Error fetching cart' });
    }
  }

  // @desc    Add item to cart
  // @route   POST /api/cart
  static async addToCart(req, res) {
    try {
      const { productId, quantity } = req.body;

      // Validate product exists and has sufficient stock
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      if (product.stock < quantity) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }

      let cart = await Cart.findOne({ user: req.user.id });
      if (!cart) {
        cart = new Cart({ user: req.user.id, items: [] });
      }

      // Check if product already exists in cart
      const itemIndex = cart.items.findIndex(
        item => item.product.toString() === productId
      );

      if (itemIndex > -1) {
        // Product exists in cart, update quantity
        cart.items[itemIndex].quantity = quantity;
      } else {
        // Product does not exist in cart, add new item
        cart.items.push({ product: productId, quantity });
      }

      await cart.save();
      await cart.populate('items.product');

      const total = await cart.calculateTotal();
      res.json({ cart, total });
    } catch (err) {
      console.error('Cart update error:', err.message);
      res.status(500).json({ message: 'Error updating cart' });
    }
  }

  // @desc    Update cart item quantity
  // @route   PUT /api/cart/:productId
  static async updateCartItem(req, res) {
    try {
      const { quantity } = req.body;
      const productId = req.params.productId;

      // Validate product and stock
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      if (product.stock < quantity) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }

      let cart = await Cart.findOne({ user: req.user.id });
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      const itemIndex = cart.items.findIndex(
        item => item.product.toString() === productId
      );

      if (itemIndex === -1) {
        return res.status(404).json({ message: 'Item not found in cart' });
      }

      cart.items[itemIndex].quantity = quantity;
      await cart.save();
      await cart.populate('items.product');

      const total = await cart.calculateTotal();
      res.json({ cart, total });
    } catch (err) {
      console.error('Cart item update error:', err.message);
      res.status(500).json({ message: 'Error updating cart item' });
    }
  }

  // @desc    Remove item from cart
  // @route   DELETE /api/cart/:productId
  static async removeFromCart(req, res) {
    try {
      const cart = await Cart.findOne({ user: req.user.id });
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      cart.items = cart.items.filter(
        item => item.product.toString() !== req.params.productId
      );

      await cart.save();
      const total = await cart.calculateTotal();
      res.json({ cart, total });
    } catch (err) {
      console.error('Cart item removal error:', err.message);
      res.status(500).json({ message: 'Error removing item from cart' });
    }
  }

  // @desc    Clear cart
  // @route   DELETE /api/cart
  static async clearCart(req, res) {
    try {
      const cart = await Cart.findOne({ user: req.user.id });
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }

      cart.items = [];
      await cart.save();

      res.json({ message: 'Cart cleared successfully', cart });
    } catch (err) {
      console.error('Cart clear error:', err.message);
      res.status(500).json({ message: 'Error clearing cart' });
    }
  }

  // @desc    Get cart summary
  // @route   GET /api/cart/summary
  static async getCartSummary(req, res) {
    try {
      const cart = await Cart.findOne({ user: req.user.id })
        .populate('items.product');

      if (!cart) {
        return res.json({
          itemCount: 0,
          total: 0,
          items: []
        });
      }

      const total = await cart.calculateTotal();
      const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

      res.json({
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
      res.status(500).json({ message: 'Error fetching cart summary' });
    }
  }
}

module.exports = CartController;