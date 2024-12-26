class InventoryService {
    static async checkLowStock() {
        const lowStockThreshold = config.get('lowStockThreshold');
        const lowStockProducts = await Product.find({ stock: { $lt: lowStockThreshold } });

        if (lowStockProducts.length > 0) {
            await NotificationService.sendLowStockAlert(lowStockProducts);
        }
    }

    static async reserveStock(productId, quantity, sessionId) {
        const product = await Product.findById(productId);

        if (!product || product.stock < quantity) {
            throw new Error('Insufficient stock');
        }

        await Product.updateOne(
            { _id: productId },
            {
                $inc: { stock: -quantity },
                $push: {
                    reservations: {
                        sessionId,
                        quantity,
                        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
                    }
                }
            }
        );
    }

    static async releaseReservedStock() {
        const expiredReservations = await Product.find({
            'reservations.expiresAt': { $lt: new Date() }
        });

        for (const product of expiredReservations) {
            const expired = product.reservations.filter(r => r.expiresAt < new Date());
            const totalQuantity = expired.reduce((sum, r) => sum + r.quantity, 0);

            await Product.updateOne(
                { _id: product._id },
                {
                    $inc: { stock: totalQuantity },
                    $pull: { reservations: { expiresAt: { $lt: new Date() } } }
                }
            );
        }
    }
}