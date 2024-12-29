const Product = require('../models/Product');

class ProductController {
  // @desc    Get all products with pagination and filtering
  // @route   GET /api/products
  static async getAllProducts(req, res) {
    try {
      const { page = 1, limit = 10, category, search, minPrice, maxPrice, sort } = req.query;
      const query = {};

      // Add filters if provided
      if (category) {
        query.category = category;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseFloat(minPrice);
        if (maxPrice) query.price.$lte = parseFloat(maxPrice);
      }

      // Build sort object
      let sortOptions = {};
      if (sort) {
        const [field, order] = sort.split(':');
        sortOptions[field] = order === 'desc' ? -1 : 1;
      } else {
        sortOptions = { createdAt: -1 };
      }

      const products = await Product.find(query)
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Product.countDocuments(query);

      res.json({
        products,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalProducts: total
      });
    } catch (err) {
      console.error('Product fetch error:', err.message);
      res.status(500).json({ message: 'Error fetching products' });
    }
  }

  // @desc    Get single product by ID
  // @route   GET /api/products/:id
  static async getProduct(req, res) {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.json(product);
    } catch (err) {
      console.error('Product fetch error:', err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.status(500).json({ message: 'Error fetching product' });
    }
  }

  // @desc    Create new product
  // @route   POST /api/products
  static async createProduct(req, res) {
    try {
      const { name, description, price, image, category, stock } = req.body;

      const product = new Product({
        name,
        description,
        price,
        image,
        category,
        stock
      });

      await product.save();
      res.status(201).json(product);
    } catch (err) {
      console.error('Product creation error:', err.message);
      res.status(500).json({ message: 'Error creating product' });
    }
  }

  // @desc    Update product
  // @route   PUT /api/products/:id
  static async updateProduct(req, res) {
    try {
      const { name, description, price, image, category, stock } = req.body;
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Update fields if provided
      if (name) product.name = name;
      if (description) product.description = description;
      if (price) product.price = price;
      if (image) product.image = image;
      if (category) product.category = category;
      if (stock !== undefined) product.stock = stock;

      await product.save();
      res.json(product);
    } catch (err) {
      console.error('Product update error:', err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.status(500).json({ message: 'Error updating product' });
    }
  }

  // @desc    Delete product
  // @route   DELETE /api/products/:id
  static async deleteProduct(req, res) {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      await product.remove();
      res.json({ message: 'Product removed successfully' });
    } catch (err) {
      console.error('Product deletion error:', err.message);
      if (err.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Product not found' });
      }
      res.status(500).json({ message: 'Error deleting product' });
    }
  }

  // @desc    Update product stock
  // @route   PATCH /api/products/:id/stock
  static async updateStock(req, res) {
    try {
      const { stock } = req.body;
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      product.stock = stock;
      await product.save();

      res.json({
        message: 'Stock updated successfully',
        currentStock: product.stock
      });
    } catch (err) {
      console.error('Stock update error:', err.message);
      res.status(500).json({ message: 'Error updating stock' });
    }
  }

  // @desc    Get products by category
  // @route   GET /api/products/category/:category
  static async getByCategory(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const category = req.params.category;

      const products = await Product.find({ category })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Product.countDocuments({ category });

      res.json({
        products,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalProducts: total
      });
    } catch (err) {
      console.error('Category products fetch error:', err.message);
      res.status(500).json({ message: 'Error fetching category products' });
    }
  }
}

module.exports = ProductController;