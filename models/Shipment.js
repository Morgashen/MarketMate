const mongoose = require('mongoose');

const shipmentEventSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        required: true,
        default: Date.now
    },
    status: {
        type: String,
        required: true
    },
    location: String,
    description: String
});

const addressSchema = new mongoose.Schema({
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
});

const shipmentSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    carrier: {
        type: String,
        required: true
    },
    trackingNumber: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'label_created', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'],
        default: 'pending'
    },
    shippingAddress: {
        type: addressSchema,
        required: true
    },
    estimatedDeliveryDate: {
        type: Date
    },
    actualDeliveryDate: {
        type: Date
    },
    events: [shipmentEventSchema]
}, {
    timestamps: true
});

// Create indexes safely
async function createIndexes() {
    try {
        await Promise.all([
            shipmentSchema.index({ orderId: 1 }, { background: true }),
            shipmentSchema.index({ trackingNumber: 1 }, { unique: true, background: true }),
            shipmentSchema.index({ status: 1 }, { background: true }),
            shipmentSchema.index({ carrier: 1 }, { background: true })
        ]);
    } catch (error) {
        console.warn('Index creation warning:', error.message);
    }
}

createIndexes();

const Shipment = mongoose.model('Shipment', shipmentSchema);

module.exports = Shipment;