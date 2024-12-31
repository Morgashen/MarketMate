const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    }],
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Here's where we define the calculateTotal method
CartSchema.methods.calculateTotal = async function () {
    // First, make sure the products are populated
    if (!this.populated('items.product')) {
        await this.populate('items.product', 'price');
    }

    // Calculate the total by reducing over the items array
    const total = this.items.reduce((sum, item) => {
        // Make sure both the item and its associated product exist
        if (item && item.product && item.product.price) {
            return sum + (item.product.price * item.quantity);
        }
        return sum;
    }, 0);

    // Return the total rounded to 2 decimal places for currency
    return Number(total.toFixed(2));
};

module.exports = mongoose.model('Cart', CartSchema);