const Cart = require('../models/Cart');
const Product = require('../models/Product');
const BaseRepository = require('./BaseRepository');

class CartRepository extends BaseRepository {
    constructor() {
        super(Cart);
    }

    async getOrCreateCart(userId) {
        let cart = await this.findOne(
            { user: userId },
            'items.product'
        );

        if (!cart) {
            cart = await this.create({
                user: userId,
                items: []
            });
        }

        return cart;
    }

    async addItem(userId, productId, quantity) {
        return await this.dbService.withTransaction(async (session) => {
            // Check product availability
            const product = await Product.findById(productId).session(session);
            if (!product || product.stock < quantity) {
                throw new Error('Product not available in requested quantity');
            }

            let cart = await this.getOrCreateCart(userId);
            const itemIndex = cart.items.findIndex(
                item => item.product.toString() === productId
            );

            if (itemIndex > -1) {
                // Update existing item
                const newQuantity = cart.items[itemIndex].quantity + quantity;
                if (product.stock < newQuantity) {
                    throw new Error('Insufficient stock for requested quantity');
                }
                cart.items[itemIndex].quantity = newQuantity;
            } else {
                // Add new item
                cart.items.push({
                    product: productId,
                    quantity
                });
            }

            cart.updatedAt = new Date();
            await cart.save({ session });
            return await cart.populate('items.product');
        });
    }

    async updateItemQuantity(userId, productId, quantity) {
        return await this.dbService.withTransaction(async (session) => {
            // Validate product stock
            const product = await Product.findById(productId).session(session);
            if (!product || product.stock < quantity) {
                throw new Error('Insufficient stock');
            }

            const cart = await this.findOne({ user: userId }).session(session);
            if (!cart) {
                throw new Error('Cart not found');
            }

            const itemIndex = cart.items.findIndex(
                item => item.product.toString() === productId
            );

            if (itemIndex === -1) {
                throw new Error('Item not found in cart');
            }

            cart.items[itemIndex].quantity = quantity;
            cart.updatedAt = new Date();

            await cart.save({ session });
            return await cart.populate('items.product');
        });
    }

    async removeItem(userId, productId) {
        const cart = await this.findOne({ user: userId });
        if (!cart) {
            throw new Error('Cart not found');
        }

        cart.items = cart.items.filter(
            item => item.product.toString() !== productId
        );
        cart.updatedAt = new Date();

        await cart.save();
        return await cart.populate('items.product');
    }

    async clearCart(userId) {
        const cart = await this.findOne({ user: userId });
        if (!cart) {
            throw new Error('Cart not found');
        }

        cart.items = [];
        cart.updatedAt = new Date();
        await cart.save();
        return cart;
    }

    async moveToSavedForLater(userId, productId) {
        return await this.dbService.withTransaction(async (session) => {
            const cart = await this.findOne({ user: userId }).session(session);
            if (!cart) {
                throw new Error('Cart not found');
            }

            const itemIndex = cart.items.findIndex(
                item => item.product.toString() === productId
            );

            if (itemIndex === -1) {
                throw new Error('Item not found in cart');
            }

            const item = cart.items[itemIndex];
            cart.items.splice(itemIndex, 1);

            if (!cart.savedForLater) {
                cart.savedForLater = [];
            }

            cart.savedForLater.push(item);
            cart.updatedAt = new Date();

            await cart.save({ session });
            return await cart.populate(['items.product', 'savedForLater.product']);
        });
    }

    async moveToCart(userId, productId) {
        return await this.dbService.withTransaction(async (session) => {
            const cart = await this.findOne({ user: userId }).session(session);
            if (!cart) {
                throw new Error('Cart not found');
            }

            const savedItemIndex = cart.savedForLater.findIndex(
                item => item.product.toString() === productId
            );

            if (savedItemIndex === -1) {
                throw new Error('Item not found in saved items');
            }

            const item = cart.savedForLater[savedItemIndex];

            // Verify stock availability
            const product = await Product.findById(productId).session(session);
            if (!product || product.stock < item.quantity) {
                throw new Error('Product not available in requested quantity');
            }

            cart.savedForLater.splice(savedItemIndex, 1);
            cart.items.push(item);
            cart.updatedAt = new Date();

            await cart.save({ session });
            return await cart.populate(['items.product', 'savedForLater.product']);
        });
    }

    async mergeCarts(userId, sessionCartId) {
        return await this.dbService.withTransaction(async (session) => {
            const [userCart, sessionCart] = await Promise.all([
                this.getOrCreateCart(userId),
                this.findById(sessionCartId)
            ]);

            if (!sessionCart) {
                throw new Error('Session cart not found');
            }

            // Merge items, checking stock and updating quantities
            for (const sessionItem of sessionCart.items) {
                const product = await Product.findById(sessionItem.product)
                    .session(session);

                if (!product) continue;

                const existingItemIndex = userCart.items.findIndex(
                    item => item.product.toString() === sessionItem.product.toString()
                );

                if (existingItemIndex > -1) {
                    // Update quantity if there's sufficient stock
                    const newQuantity = userCart.items[existingItemIndex].quantity +
                        sessionItem.quantity;

                    if (product.stock >= newQuantity) {
                        userCart.items[existingItemIndex].quantity = newQuantity;
                    }
                } else {
                    // Add new item if there's sufficient stock
                    if (product.stock >= sessionItem.quantity) {
                        userCart.items.push(sessionItem);
                    }
                }
            }

            // Merge saved for later items
            if (sessionCart.savedForLater && sessionCart.savedForLater.length > 0) {
                if (!userCart.savedForLater) {
                    userCart.savedForLater = [];
                }
                userCart.savedForLater = [...userCart.savedForLater, ...sessionCart.savedForLater];
            }

            userCart.updatedAt = new Date();
            await userCart.save({ session });
            await sessionCart.remove({ session });

            return await userCart.populate(['items.product', 'savedForLater.product']);
        });
    }

    async getCartSummary(userId) {
        const cart = await this.findOne(
            { user: userId },
            'items.product'
        );

        if (!cart) {
            return {
                itemCount: 0,
                total: 0,
                items: []
            };
        }

        await cart.populate('items.product');

        const summary = {
            itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
            items: cart.items.map(item => ({
                product: {
                    id: item.product._id,
                    name: item.product.name,
                    price: item.product.price
                },
                quantity: item.quantity,
                subtotal: item.product.price * item.quantity
            }))
        };

        summary.total = summary.items.reduce((sum, item) => sum + item.subtotal, 0);

        return summary;
    }

    async validateCartItems(userId) {
        const cart = await this.findOne({ user: userId })
            .populate('items.product');

        if (!cart) {
            throw new Error('Cart not found');
        }

        const invalidItems = [];
        const validItems = [];

        for (const item of cart.items) {
            if (!item.product) {
                invalidItems.push({
                    item,
                    reason: 'Product not found'
                });
                continue;
            }

            if (item.product.stock < item.quantity) {
                invalidItems.push({
                    item,
                    reason: 'Insufficient stock',
                    availableStock: item.product.stock
                });
                continue;
            }

            validItems.push(item);
        }

        return {
            isValid: invalidItems.length === 0,
            validItems,
            invalidItems
        };
    }

    async applyCoupon(userId, couponCode) {
        // This would integrate with your coupon/discount system
        throw new Error('Method not implemented');
    }
}

module.exports = CartRepository;