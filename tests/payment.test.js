const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server'); // Adjust the path as needed
const Payment = require('../models/Payment'); // Adjust the path as needed
const Order = require('../models/Order'); // Adjust the path as needed

// Mock data for my tests
const validPaymentData = {
    orderId: new mongoose.Types.ObjectId(),
    amount: 99.99,
    currency: 'USD',
    paymentMethod: 'credit_card',
    cardDetails: {
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2025
    }
};

const validOrderData = {
    items: [
        {
            productId: new mongoose.Types.ObjectId(),
            quantity: 2,
            price: 49.99
        }
    ],
    totalAmount: 99.99,
    status: 'pending'
};

describe('Payment API Integration Tests', () => {
    let mongoServer;

    // Set up the in-memory database before all tests
    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
    });

    // Clean up after all tests are done
    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    // Clean up the database between tests
    beforeEach(async () => {
        await Payment.deleteMany({});
        await Order.deleteMany({});
    });

    describe('POST /api/payments', () => {
        test('should create a new payment successfully', async () => {
            // First create an order
            const order = await Order.create(validOrderData);
            const paymentData = {
                ...validPaymentData,
                orderId: order._id
            };

            const response = await request(app)
                .post('/api/payments')
                .send(paymentData)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data.paymentId');
            expect(response.body.data.amount).toBe(paymentData.amount);

            // Verify order status was updated
            const updatedOrder = await Order.findById(order._id);
            expect(updatedOrder.status).toBe('paid');
        });

        test('should fail when payment amount doesnt match order total', async () => {
            const order = await Order.create(validOrderData);
            const paymentData = {
                ...validPaymentData,
                orderId: order._id,
                amount: 50.00 // Incorrect amount
            };

            const response = await request(app)
                .post('/api/payments')
                .send(paymentData)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toContain('Payment amount does not match order total');
        });

        test('should fail with invalid card details', async () => {
            const order = await Order.create(validOrderData);
            const paymentData = {
                ...validPaymentData,
                orderId: order._id,
                cardDetails: {
                    ...validPaymentData.cardDetails,
                    expiryYear: 2020 // Expired card
                }
            };

            const response = await request(app)
                .post('/api/payments')
                .send(paymentData)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toContain('Invalid card details');
        });
    });

    describe('GET /api/payments/:id', () => {
        test('should retrieve payment details successfully', async () => {
            // Create a payment first
            const payment = await Payment.create(validPaymentData);

            const response = await request(app)
                .get(`/api/payments/${payment._id}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data._id).toBe(payment._id.toString());
            expect(response.body.data.amount).toBe(payment.amount);
        });

        test('should return 404 for non-existent payment', async () => {
            const fakeId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .get(`/api/payments/${fakeId}`)
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toContain('Payment not found');
        });
    });

    describe('GET /api/payments', () => {
        test('should retrieve all payments with pagination', async () => {
            // Create multiple payments
            await Payment.create([
                validPaymentData,
                { ...validPaymentData, amount: 199.99 },
                { ...validPaymentData, amount: 299.99 }
            ]);

            const response = await request(app)
                .get('/api/payments')
                .query({ page: 1, limit: 2 })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body).toHaveProperty('pagination');
            expect(response.body.pagination).toHaveProperty('totalPages');
            expect(response.body.pagination).toHaveProperty('currentPage', 1);
        });

        test('should filter payments by date range', async () => {
            const yesterday = new Date(Date.now() - 86400000);
            const tomorrow = new Date(Date.now() + 86400000);

            await Payment.create([
                { ...validPaymentData, createdAt: yesterday },
                { ...validPaymentData, createdAt: tomorrow }
            ]);

            const response = await request(app)
                .get('/api/payments')
                .query({
                    startDate: yesterday.toISOString(),
                    endDate: new Date().toISOString()
                })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveLength(1);
        });
    });

    describe('Payment Refund Flow', () => {
        test('should process refund successfully', async () => {
            const payment = await Payment.create(validPaymentData);

            const response = await request(app)
                .post(`/api/payments/${payment._id}/refund`)
                .send({ reason: 'Customer request' })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body.data).toHaveProperty('status', 'refunded');
            expect(response.body.data).toHaveProperty('refundReason', 'Customer request');

            // Verify the original payment was updated
            const updatedPayment = await Payment.findById(payment._id);
            expect(updatedPayment.status).toBe('refunded');
        });

        test('should prevent refund of already refunded payment', async () => {
            const payment = await Payment.create({
                ...validPaymentData,
                status: 'refunded'
            });

            const response = await request(app)
                .post(`/api/payments/${payment._id}/refund`)
                .send({ reason: 'Customer request' })
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toContain('Payment has already been refunded');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle invalid payment method gracefully', async () => {
            const order = await Order.create(validOrderData);
            const paymentData = {
                ...validPaymentData,
                orderId: order._id,
                paymentMethod: 'invalid_method'
            };

            const response = await request(app)
                .post('/api/payments')
                .send(paymentData)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toContain('Invalid payment method');
        });

        test('should handle database connection errors', async () => {
            // Temporarily break the database connection
            await mongoose.disconnect();

            const response = await request(app)
                .post('/api/payments')
                .send(validPaymentData)
                .expect(500);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toContain('Internal server error');

            // Reconnect for subsequent tests
            const mongoUri = mongoServer.getUri();
            await mongoose.connect(mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
        });

        test('should validate required fields', async () => {
            const incompletePaymentData = {
                amount: 99.99,
                // Missing other required fields
            };

            const response = await request(app)
                .post('/api/payments')
                .send(incompletePaymentData)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.error).toContain('Required fields missing');
        });
    });
});