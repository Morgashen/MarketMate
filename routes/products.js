const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Product = require('../models/Product');

// @route   POST api/products
// @desc    Create a new product
// @access  Private
router.post('/', [
  auth,
  [
    check('name', 'Name is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty(),
    check('price', 'Price must be a positive number').isFloat({ min: 0 }),
    check('image', 'Image URL is required').not().isEmpty(),
    check('category', 'Category is required').not().isEmpty(),
    check('stock', 'Stock must be a non-negative integer').isInt({ min: 0 })
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, price, image, category, stock } = req.body;

    const product = new Product({
      name,
      description,
      price,
      image,
      category,
      stock
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    console.error('Product creation error:', err.message);
    res.status(500).json({ message: 'Server error during product creation', error: err.message });
  }
});

// Ensure other routes are exported
module.exports = router;