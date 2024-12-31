const Product = require('../models/Product');

class ProductController {
  // Create a new product
  async createProduct(req, res) {
    try {
      console.log('Creating product with data:', {
        ...req.body,
        password: req.body.password ? '[REDACTED]' : undefined
      });

      const product = new Product({
        name: req.body.name,
        price: req.body.price,
        description: req.body.description,
        stockQuantity: req.body.stockQuantity || 0,
        category: req.body.category
      });

      const savedProduct = await product.save();
      console.log('Product saved successfully:', savedProduct);

      return res.status(201).json({
        status: 'success',
        message: 'Product created successfully',
        data: savedProduct
      });

    } catch (error) {
      console.error('Product creation error:', error);
      return this.handleError(res, error);
    }
  }

  // Get all products with filtering and pagination
  async getProducts(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const { category, search } = req.query;

      const filter = {};
      if (category) filter.category = category;
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const products = await Product.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await Product.countDocuments(filter);

      return res.status(200).json({
        status: 'success',
        data: {
          products,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalProducts: total,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Error fetching products:', error);
      return this.handleError(res, error);
    }
  }

  // Get a single product
  async getProduct(req, res) {
    try {
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({
          status: 'error',
          message: 'Product not found'
        });
      }

      return res.status(200).json({
        status: 'success',
        data: product
      });

    } catch (error) {
      console.error('Error fetching product:', error);
      return this.handleError(res, error);
    }
  }

  // Update a product
  async updateProduct(req, res) {
    try {
      const updateData = { ...req.body };
      delete updateData.sku;  // Protect SKU from modification

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({
          status: 'error',
          message: 'Product not found'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Product updated successfully',
        data: product
      });

    } catch (error) {
      console.error('Error updating product:', error);
      return this.handleError(res, error);
    }
  }

  // Delete (deactivate) a product
  async deleteProduct(req, res) {
    try {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { status: 'inactive' },
        { new: true }
      );

      if (!product) {
        return res.status(404).json({
          status: 'error',
          message: 'Product not found'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Product successfully deactivated',
        data: product
      });

    } catch (error) {
      console.error('Error deleting product:', error);
      return this.handleError(res, error);
    }
  }

  // Error handler helper method
  handleError(res, error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid product data',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = new ProductController();