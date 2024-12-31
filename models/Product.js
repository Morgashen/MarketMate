const mongoose = require('mongoose');

// Define the product schema with validation and type definitions
const productSchema = new mongoose.Schema({
    sku: {
        type: String,
        unique: true,
        sparse: true,  // Allows null SKUs during creation since we'll generate them
        uppercase: true // Ensures consistent SKU format
    },
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        minlength: [2, 'Product name must be at least 2 characters'],
        maxlength: [100, 'Product name cannot exceed 100 characters']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    stockQuantity: {
        type: Number,
        default: 0,
        min: [0, 'Stock quantity cannot be negative']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, {
    timestamps: true // Automatically manage createdAt and updatedAt
});

// Add SKU generation middleware
productSchema.pre('save', async function (next) {
    if (!this.sku) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        this.sku = `PRD-${timestamp}-${random}`.toUpperCase();
    }
    next();
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;