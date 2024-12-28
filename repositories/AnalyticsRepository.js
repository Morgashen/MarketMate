const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const BaseRepository = require('./BaseRepository');

class AnalyticsRepository extends BaseRepository {
    constructor() {
        super(Order); // Using Order as base model for sales analytics
    }

    async getSalesAnalytics(startDate, endDate) {
        const pipeline = [
            {
                $match: {
                    createdAt: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    },
                    status: { $ne: 'cancelled' }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    totalSales: { $sum: '$total' },
                    orderCount: { $sum: 1 },
                    averageOrderValue: { $avg: '$total' }
                }
            },
            {
                $sort: {
                    '_id.year': 1,
                    '_id.month': 1,
                    '_id.day': 1
                }
            }
        ];

        return await this.aggregate(pipeline);
    }

    async getProductPerformance(period = 30) { // period in days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - period);

        const pipeline = [
            {
                $match: {
                    createdAt: { $gte: startDate },
                    status: { $ne: 'cancelled' }
                }
            },
            {
                $unwind: '$items'
            },
            {
                $group: {
                    _id: '$items.product',
                    totalSold: { $sum: '$items.quantity' },
                    revenue: {
                        $sum: {
                            $multiply: ['$items.price', '$items.quantity']
                        }
                    },
                    orderCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            {
                $unwind: '$productInfo'
            },
            {
                $project: {
                    name: '$productInfo.name',
                    category: '$productInfo.category',
                    totalSold: 1,
                    revenue: 1,
                    orderCount: 1,
                    currentStock: '$productInfo.stock'
                }
            }
        ];

        return await this.aggregate(pipeline);
    }

    async getCustomerAnalytics() {
        const pipeline = [
            {
                $group: {
                    _id: '$user',
                    orderCount: { $sum: 1 },
                    totalSpent: { $sum: '$total' },
                    averageOrderValue: { $avg: '$total' },
                    lastOrder: { $max: '$createdAt' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            {
                $unwind: '$userInfo'
            },
            {
                $project: {
                    name: '$userInfo.name',
                    email: '$userInfo.email',
                    orderCount: 1,
                    totalSpent: 1,
                    averageOrderValue: 1,
                    lastOrder: 1,
                    daysSinceLastOrder: {
                        $divide: [
                            { $subtract: [new Date(), '$lastOrder'] },
                            1000 * 60 * 60 * 24
                        ]
                    }
                }
            }
        ];

        return await this.aggregate(pipeline);
    }

    async getCategoryPerformance() {
        const pipeline = [
            {
                $unwind: '$items'
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            {
                $unwind: '$productInfo'
            },
            {
                $group: {
                    _id: '$productInfo.category',
                    totalSales: {
                        $sum: {
                            $multiply: ['$items.price', '$items.quantity']
                        }
                    },
                    itemsSold: { $sum: '$items.quantity' },
                    uniqueProducts: { $addToSet: '$items.product' }
                }
            },
            {
                $project: {
                    category: '$_id',
                    totalSales: 1,
                    itemsSold: 1,
                    uniqueProductCount: { $size: '$uniqueProducts' },
                    averageItemPrice: {
                        $divide: ['$totalSales', '$itemsSold']
                    }
                }
            }
        ];

        return await this.aggregate(pipeline);
    }

    async getRetentionMetrics(period = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - period);

        const pipeline = [
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$user',
                    firstOrder: { $min: '$createdAt' },
                    lastOrder: { $max: '$createdAt' },
                    orderCount: { $sum: 1 },
                    totalSpent: { $sum: '$total' }
                }
            },
            {
                $project: {
                    daysBetweenOrders: {
                        $divide: [
                            { $subtract: ['$lastOrder', '$firstOrder'] },
                            1000 * 60 * 60 * 24
                        ]
                    },
                    orderCount: 1,
                    totalSpent: 1,
                    isRetained: {
                        $cond: [
                            { $gt: ['$orderCount', 1] },
                            true,
                            false
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCustomers: { $sum: 1 },
                    retainedCustomers: {
                        $sum: { $cond: ['$isRetained', 1, 0] }
                    },
                    averageOrderCount: { $avg: '$orderCount' },
                    averageDaysBetweenOrders: { $avg: '$daysBetweenOrders' }
                }
            }
        ];

        return await this.aggregate(pipeline);
    }
}

module.exports = AnalyticsRepository;