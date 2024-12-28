const Order = require('../models/Order');
const BaseRepository = require('./BaseRepository');

class OrderRepository extends BaseRepository {
    constructor() {
        super(Order);
    }

    async getUserOrders(userId, options) {
        return await this.paginate(
            { user: userId },
            {
                ...options,
                populate: 'items.product',
                sort: { createdAt: -1 }
            }
        );
    }

    async createOrder(orderData) {
        return await this.dbService.withTransaction(async (session) => {
            const order = await this.create({
                ...orderData,
                session
            });

            // Update product stock
            for (const item of orderData.items) {
                await this.dbService.update(
                    Product,
                    item.product,
                    { $inc: { stock: -item.quantity } },
                    { session }
                );
            }

            return order;
        });
    }

    async getOrderAnalytics(startDate, endDate) {
        const pipeline = [
            {
                $match: {
                    createdAt: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$total' },
                    averageOrderValue: { $avg: '$total' }
                }
            }
        ];

        return await this.aggregate(pipeline);
    }
}

module.exports = {
    BaseRepository,
    UserRepository,
    ProductRepository,
    OrderRepository
};