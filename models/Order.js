const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    shippingAddress: {
        street: {
            type: String,
            required: [true, 'Street address is required']
        },
        city: {
            type: String,
            required: [true, 'City is required']
        },
        state: {
            type: String,
            required: [true, 'State/Province is required']
        },
        zipCode: {
            type: String,
            required: [true, 'Zip/Postal code is required']
        },
        country: {
            type: String,
            required: [true, 'Country is required'],
            lowercase: true
        }
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);// Description: Model for Order.