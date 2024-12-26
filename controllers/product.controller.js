const Product = require('../models/Product');
const logger = require('../config/logger');
const { ValidationError, NotFoundError } = require('../utils/errors');

class ProductController {
  /**
   * Create a new product in the MarketMate catalog
   * @param {Object} productData - Product information
   * @returns {Promise<Object>} Created product
   */
  static async createProduct(productData) {
    try {
      const product = new Product(productData);
      await product.save();

      logger.info(`New product created: ${product.name} (SKU: ${product.sku})`);
      return product;
    } catch (error) {
      logger.error('Product creation error:', error);
      throw error;
    }
  }

  /**
   * Retrieve products with optional filtering
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} Array of products
   */
  static async getProducts(filters = {}) {
    try {
      const query = {};
      const options = {
        sort: filters.sort || { createdAt: -1 },
        limit: filters.limit || 50,
        skip: filters.skip || 0
      };

      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.minPrice || filters.maxPrice) {
        query.price = {};
        if (filters.minPrice) query.price.$gte = filters.minPrice;
        if (filters.maxPrice) query.price.$lte = filters.maxPrice;
      }

      if (filters.search) {
        query.$text = { $search: filters.search };
      }

      const products = await Product.find(query, null, options);
      logger.info(`Retrieved ${products.length} products with filters:`, filters);

      return products;
    } catch (error) {
      logger.error('Product retrieval error:', error);
      throw error;
    }
  }

  /**
   * Get a single product by ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} Product data
   */
  static async getProductById(productId) {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new NotFoundError('Product not found in MarketMate catalog');
      }
      return product;
    } catch (error) {
      logger.error(`Error retrieving product ${productId}:`, error);
      throw error;
    }
  }
}

module.exports = ProductController;