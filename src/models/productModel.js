const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true },
    numberOfProductsAvailable: { type: Number, required: true },
    images: [{ type: String }]
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);

module.exports = Product;
