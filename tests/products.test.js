const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');

const request = supertest(app);
let mongoServer;
let authToken;

beforeAll(async () => {
    // Create an in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    // Clear collections before each test
    await User.deleteMany({});
    await Product.deleteMany({});

    // Create a test user and get authentication token
    const userData = {
        name: 'Test Admin',
        email: 'admin@test.com',
        password: 'password123'
    };

    const response = await request
        .post('/api/auth/register')
        .send(userData);

    authToken = response.body.token;
});

describe('Product Endpoints', () => {
    describe('POST /api/products', () => {
        it('should create a new product', async () => {
            const productData = {
                name: 'Test Product',
                description: 'Test Description',
                price: 99.99,
                image: 'test-image.jpg',
                category: 'Test Category',
                stock: 10
            };

            const response = await request
                .post('/api/products')
                .set('x-auth-token', authToken)
                .send(productData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('name', productData.name);
            expect(response.body).toHaveProperty('price', productData.price);
            expect(response.body).toHaveProperty('stock', productData.stock);
        });

        it('should not create product without authentication', async () => {
            const productData = {
                name: 'Test Product',
                description: 'Test Description',
                price: 99.99,
                image: 'test-image.jpg',
                category: 'Test Category',
                stock: 10
            };

            const response = await request
                .post('/api/products')
                .send(productData);

            expect(response.status).toBe(401);
        });

        it('should validate required fields', async () => {
            const invalidProduct = {
                name: 'Test Product'
                // Missing required fields
            };

            const response = await request
                .post('/api/products')
                .set('x-auth-token', authToken)
                .send(invalidProduct);

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/products', () => {
        it('should get all products', async () => {
            // First create some test products
            const products = [
                {
                    name: 'Product 1',
                    description: 'Description 1',
                    price: 99.99,
                    image: 'image1.jpg',
                    category: 'Category 1',
                    stock: 10
                },
                {
                    name: 'Product 2',
                    description: 'Description 2',
                    price: 149.99,
                    image: 'image2.jpg',
                    category: 'Category 2',
                    stock: 15
                }
            ];

            // Create products in database
            for (const product of products) {
                await request
                    .post('/api/products')
                    .set('x-auth-token', authToken)
                    .send(product);
            }

            // Get all products
            const response = await request.get('/api/products');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.products)).toBeTruthy();
            expect(response.body.products).toHaveLength(2);
        });

        it('should support pagination', async () => {
            // Create 15 test products
            const productPromises = Array.from({ length: 15 }, (_, i) =>
                request
                    .post('/api/products')
                    .set('x-auth-token', authToken)
                    .send({
                        name: `Product ${i + 1}`,
                        description: `Description ${i + 1}`,
                        price: 99.99,
                        image: `image${i + 1}.jpg`,
                        category: 'Test Category',
                        stock: 10
                    })
            );

            await Promise.all(productPromises);

            // Test pagination with 10 items per page
            const response = await request
                .get('/api/products')
                .query({ page: 1, limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body.products).toHaveLength(10);
            expect(response.body).toHaveProperty('totalPages');
            expect(response.body).toHaveProperty('currentPage');
        });
    });

    describe('GET /api/products/:id', () => {
        it('should get product by ID', async () => {
            // First create a product
            const productData = {
                name: 'Test Product',
                description: 'Test Description',
                price: 99.99,
                image: 'test-image.jpg',
                category: 'Test Category',
                stock: 10
            };

            const createResponse = await request
                .post('/api/products')
                .set('x-auth-token', authToken)
                .send(productData);

            const productId = createResponse.body._id;

            // Get the product by ID
            const response = await request
                .get(`/api/products/${productId}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('_id', productId);
            expect(response.body).toHaveProperty('name', productData.name);
        });

        it('should return 404 for non-existent product', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request
                .get(`/api/products/${fakeId}`);

            expect(response.status).toBe(404);
        });
    });
});