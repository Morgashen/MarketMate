const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

const request = supertest(app);
let mongoServer;
let testUser;
let authToken;
let testProduct;

// Set up database connection before running tests
beforeAll(async () => {
    // Create an in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
});

// Clean up after tests complete
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// Set up test data before each test
beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});

    // Create a test user
    const userData = {
        name: 'Cart Test User',
        email: 'cart@test.com',
        password: 'password123'
    };

    const registerResponse = await request
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

    const productResponse = await request
        .post('/api/products')
        .set('x-auth-token', authToken)
        .send(productData);

    testProduct = productResponse.body;
});

describe('Cart Endpoints', () => {
    describe('POST /api/cart', () => {
        it('should add item to cart', async () => {
            const response = await request
                .post('/api/cart')
                .set('x-auth-token', authToken)
                .send({
                    productId: testProduct._id,
                    quantity: 2
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('cart');
            expect(response.body.cart.items).toHaveLength(1);
            expect(response.body.cart.items[0].quantity).toBe(2);
            expect(response.body.cart.items[0].product.toString()).toBe(testProduct._id.toString());
        });

        it('should not add item with invalid quantity', async () => {
            const response = await request
                .post('/api/cart')
                .set('x-auth-token', authToken)
                .send({
                    productId: testProduct._id,
                    quantity: -1
                });

            expect(response.status).toBe(400);
        });

        it('should not add item with insufficient stock', async () => {
            const response = await request
                .post('/api/cart')
                .set('x-auth-token', authToken)
                .send({
                    productId: testProduct._id,
                    quantity: testProduct.stock + 1
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('message', 'Insufficient stock');
        });
    });

    describe('GET /api/cart', () => {
        it('should get empty cart for new user', async () => {
            const response = await request
                .get('/api/cart')
                .set('x-auth-token', authToken);

            expect(response.status).toBe(200);
            expect(response.body.cart.items).toHaveLength(0);
        });

        it('should get cart with added items', async () => {
            // First add an item to cart
            await request
                .post('/api/cart')
                .set('x-auth-token', authToken)
                .send({
                    productId: testProduct._id,
                    quantity: 2
                });

            // Then get cart
            const response = await request
                .get('/api/cart')
                .set('x-auth-token', authToken);

            expect(response.status).toBe(200);
            expect(response.body.cart.items).toHaveLength(1);
            expect(response.body.cart.items[0].quantity).toBe(2);
        });
    });

    describe('PUT /api/cart/:productId', () => {
        it('should update item quantity', async () => {
            // First add item to cart
            await request
                .post('/api/cart')
                .set('x-auth-token', authToken)
                .send({
                    productId: testProduct._id,
                    quantity: 2
                });

            // Then update quantity
            const response = await request
                .put(`/api/cart/${testProduct._id}`)
                .set('x-auth-token', authToken)
                .send({
                    quantity: 3
                });

            expect(response.status).toBe(200);
            expect(response.body.cart.items[0].quantity).toBe(3);
        });
    });

    describe('DELETE /api/cart/:productId', () => {
        it('should remove item from cart', async () => {
            // First add item to cart
            await request
                .post('/api/cart')
                .set('x-auth-token', authToken)
                .send({
                    productId: testProduct._id,
                    quantity: 2
                });

            // Then remove it
            const response = await request
                .delete(`/api/cart/${testProduct._id}`)
                .set('x-auth-token', authToken);

            expect(response.status).toBe(200);
            expect(response.body.cart.items).toHaveLength(0);
        });
    });
});