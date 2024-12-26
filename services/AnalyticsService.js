class AnalyticsService {
    static async generateSalesReport(startDate, endDate) {
        const orders = await Order.find({
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed'
        }).populate('items.product');

        const report = {
            totalSales: 0,
            totalOrders: orders.length,
            averageOrderValue: 0,
            topProducts: [],
            salesByDay: {}
        };

        const productSales = {};

        for (const order of orders) {
            report.totalSales += order.total;

            for (const item of order.items) {
                const productId = item.product._id.toString();
                if (!productSales[productId]) {
                    productSales[productId] = {
                        name: item.product.name,
                        quantity: 0,
                        revenue: 0
                    };
                }
                productSales[productId].quantity += item.quantity;
                productSales[productId].revenue += item.price * item.quantity;
            }

            const day = order.createdAt.toISOString().split('T')[0];
            report.salesByDay[day] = (report.salesByDay[day] || 0) + order.total;
        }

        report.averageOrderValue = report.totalSales / report.totalOrders;
        report.topProducts = Object.values(productSales)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        return report;
    }
}