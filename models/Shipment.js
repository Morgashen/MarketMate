const mongoose = require('mongoose');

const ShipmentSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    tracking: {
        carrier: {
            type: String,
            required: true,
            enum: ['USPS', 'FedEx', 'UPS', 'DHL']
        },
        trackingNumber: {
            type: String,
            required: true
        },
        estimatedDelivery: Date,
        actualDelivery: Date
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned'],
        default: 'pending'
    },
    shippingAddress: {
        street: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        zipCode: {
            type: String,
            required: true
        },
        country: {
            type: String,
            required: true
        }
    },
    shippingMethod: {
        type: String,
        required: true,
        enum: ['standard', 'express', 'overnight']
    },
    weight: {
        value: Number,
        unit: {
            type: String,
            enum: ['kg', 'lb']
        }
    },
    dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: {
            type: String,
            enum: ['cm', 'in']
        }
    },
    statusHistory: [{
        status: {
            type: String,
            required: true
        },
        location: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        notes: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

ShipmentSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Shipment', ShipmentSchema);