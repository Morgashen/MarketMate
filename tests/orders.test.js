// tests/orders.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

let mongoServer;
let testUser;
let authToken;
let testProduct;

// Setup database connection before all tests
beforeAll(async () => {
    // Create an in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
});

// Cleanup after all tests are done
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// Clean up the database before each test
beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

    // Create a test user
    const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
    };

    const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

    authToken = registerResponse.body.token;
    testUser = await User.findOne({ email: userData.email });

    // Create a test product
    const productData = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        image: 'test-image.jpg',
        category: 'Test Category',
        stock: 10
    };

    const productResponse = await request(app)
        .post('/api/products')
        .set('x-auth-token', authToken)
        .send(productData);

    testProduct = productResponse.body;
});

describe('Order Endpoints', () => {
    describe('POST /api/orders', () => {
        it('should create a new order successfully', async () => {
            // First add item to cart
            await request(app)
                .post('/api/cart')
                .set('x-auth-token', authToken)
                .send({
                    productId: testProduct._id,
                    quantity: 1
                });

            // Create order
            const response = await request(app)
                .post('/api/orders')
                .set('x-auth-token', authToken)
                .send({
                    shippingAddress: {
                        street: '123 Test St',
                        city: 'Test City',
                        state: 'Test State',
                        zipCode: '12345',
                        country: 'Test Country'
                    }
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('order');
            expect(response.body.order.user.toString()).toBe(testUser._id.toString());
        });

        it('should fail to create order with empty cart', async () => {
            const response = await request(app)
                .post('/api/orders')
                .set('x-auth-token', authToken)
                .send({
                    shippingAddress: {
                        street: '123 Test St',
                        city: 'Test City',
                        state: 'Test State',
                        zipCode: '12345',
                        country: 'Test Country'
                    }
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('message', 'Cart is empty');
        });
    });

    describe('GET /api/orders', () => {
        it('should get all orders for the user', async () => {
            // Create an order first
            await request(app)
                .post('/api/cart')
                .set('x-auth-token', authToken)
                .send({
                    productId: testProduct._id,
                    quantity: 1
                });

            await request(app)
                .post('/api/orders')
                .set('x-auth-token', authToken)
                .send({
                    shippingAddress: {
                        street: '123 Test St',
                        city: 'Test City',
                        state: 'Test State',
                        zipCode: '12345',
                        country: 'Test Country'
                    }
                });

            const response = await request(app)
                .get('/api/orders')
                .set('x-auth-token', authToken);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBeTruthy();
            expect(response.body.length).toBeGreaterThan(0);
        });

        it('should return empty array when user has no orders', async () => {
            const response = await request(app)
                .get('/api/orders')
                .set('x-auth-token', authToken);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBeTruthy();
            expect(response.body.length).toBe(0);
        });
    });

    describe('GET /api/orders/:id', () => {
        it('should get a specific order by ID', async () => {
            // Create an order first
            await request(app)
                .post('/api/cart')
                .set('x-auth-token', authToken)
                .send({
                    productId: testProduct._id,
                    quantity: 1
                });

            const createOrderResponse = await request(app)
                .post('/api/orders')
                .set('x-auth-token', authToken)
                .send({
                    shippingAddress: {
                        street: '123 Test St',
                        city: 'Test City',
                        state: 'Test State',
                        zipCode: '12345',
                        country: 'Test Country'
                    }
                });

            const orderId = createOrderResponse.body.order._id;

            const response = await request(app)
                .get(`/api/orders/${orderId}`)
                .set('x-auth-token', authToken);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('_id', orderId);
        });

        it('should return 404 for non-existent order', async () => {
            const fakeOrderId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/api/orders/${fakeOrderId}`)
                .set('x-auth-token', authToken);

            expect(response.status).toBe(404);
        });
    });
});