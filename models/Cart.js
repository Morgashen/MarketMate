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

// Calculate cart total
CartSchema.methods.calculateTotal = async function () {
    let total = 0;
    for (let item of this.items) {
        const product = await mongoose.model('Product').findById(item.product);
        if (product) {
            total += product.price * item.quantity;
        }
    }
    return total;
};

module.exports = mongoose.model('Cart', CartSchema);