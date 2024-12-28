const Product = require('../models/Product');
const BaseRepository = require('./BaseRepository');

class InventoryRepository extends BaseRepository {
    constructor() {
        super(Product);
    }

    async checkLowStock(threshold = 10) {
        return await this.find(
            { stock: { $lte: threshold } },
            {
                sort: { stock: 1 },
                select: 'name stock category price'
            }
        );
    }

    async reserveStock(productId, quantity, sessionId) {
        return await this.dbService.withTransaction(async (session) => {
            const product = await this.findOne(
                {
                    _id: productId,
                    stock: { $gte: quantity }
                },
                { session }
            );

            if (!product) {
                throw new Error('Insufficient stock');
            }

            product.reservations.push({
                sessionId,
                quantity,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
            });

            product.stock -= quantity;
            return await product.save({ session });
        });
    }

    async releaseReservedStock(sessionId) {
        const products = await this.find({
            'reservations.sessionId': sessionId
        });

        await this.dbService.withTransaction(async (session) => {
            for (const product of products) {
                const reservation = product.reservations.find(
                    r => r.sessionId === sessionId
                );

                if (reservation) {
                    product.stock += reservation.quantity;
                    product.reservations = product.reservations.filter(
                        r => r.sessionId !== sessionId
                    );
                    await product.save({ session });
                }
            }
        });
    }

    async batchUpdateStock(updates) {
        return await this.dbService.withTransaction(async (session) => {
            const operations = updates.map(async ({ productId, quantity }) => {
                const product = await this.findById(productId, { session });
                if (!product) {
                    throw new Error(`Product not found: ${productId}`);
                }
                if (product.stock + quantity < 0) {
                    throw new Error(`Insufficient stock for product: ${productId}`);
                }
                product.stock += quantity;
                return product.save({ session });
            });

            return await Promise.all(operations);
        });
    }

    async getInventoryAnalytics() {
        const pipeline = [
            {
                $group: {
                    _id: '$category',
                    totalProducts: { $sum: 1 },
                    totalStock: { $sum: '$stock' },
                    averagePrice: { $avg: '$price' },
                    lowStockItems: {
                        $sum: {
                            $cond: [{ $lte: ['$stock', 10] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    category: '$_id',
                    totalProducts: 1,
                    totalStock: 1,
                    averagePrice: { $round: ['$averagePrice', 2] },
                    lowStockItems: 1,
                    stockValue: {
                        $round: [
                            { $multiply: ['$totalStock', '$averagePrice'] },
                            2
                        ]
                    }
                }
            }
        ];

        return await this.aggregate(pipeline);
    }

    async searchInventory(query) {
        const searchConditions = {
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } },
                { category: { $regex: query, $options: 'i' } },
                { sku: { $regex: query, $options: 'i' } }
            ]
        };

        return await this.find(searchConditions, {
            select: 'name stock category price sku'
        });
    }
}

module.exports = InventoryRepository;