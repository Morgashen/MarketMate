const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    paymentMethodId: {
        type: String,
        required: true
    },
    paymentIntentId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    tracking: {
        carrier: {
            type: String,
            enum: ['USPS', 'FedEx', 'UPS', 'DHL']
        },
        trackingNumber: String,
        estimatedDelivery: Date,
        actualDelivery: Date
    },
    shippingMethod: {
        type: String,
        enum: ['standard', 'express', 'overnight']
    },
    shippingAddress: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String
    },
    statusHistory: [{
        status: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        notes: String
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Shipment', shipmentSchema);