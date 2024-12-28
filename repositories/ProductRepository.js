const Product = require('../models/Product');
const BaseRepository = require('./BaseRepository');

class ProductRepository extends BaseRepository {
    constructor() {
        super(Product);
    }

    async findByCategory(category, options) {
        return await this.find({ category }, options);
    }

    async updateStock(productId, quantity) {
        return await this.update(productId,
            { $inc: { stock: quantity } },
            { new: true }
        );
    }

    async searchProducts(query, options) {
        const searchConditions = {
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
            ]
        };
        return await this.paginate(searchConditions, options);
    }
}