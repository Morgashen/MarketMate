const request = require('supertest');
const { expect } = require('chai');
const { app } = require('../server');
const { clearDatabase } = require('./setup');

describe('Products API Tests', () => {
    let authToken;
    let productId;

    before(async () => {
        // Create a test user and get token
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            });
        authToken = response.body.token;
    });

    beforeEach(async () => {
        await clearDatabase();
    });

    describe('POST /api/products', () => {
        it('should create a new product', async () => {
            const response = await request(app)
                .post('/api/products')
                .set('x-auth-token', authToken)
                .send({
                    name: 'Test Product',
                    description: 'Test Description',
                    price: 99.99,
                    image: 'test-image.jpg',
                    category: 'Test Category',
                    stock: 10
                });

            expect(response.status).to.equal(201);
            expect(response.body).to.have.property('name', 'Test Product');
            expect(response.body).to.have.property('price', 99.99);
            productId = response.body._id;
        });
    });

    describe('GET /api/products', () => {
        beforeEach(async () => {
            // Create a test product
            const response = await request(app)
                .post('/api/products')
                .set('x-auth-token', authToken)
                .send({
                    name: 'Test Product',
                    description: 'Test Description',
                    price: 99.99,
                    image: 'test-image.jpg',
                    category: 'Test Category',
                    stock: 10
                });
            productId = response.body._id;
        });

        it('should get all products', async () => {
            const response = await request(app)
                .get('/api/products');

            expect(response.status).to.equal(200);
            expect(response.body).to.be.an('array');
            expect(response.body).to.have.lengthOf(1);
            expect(response.body[0]).to.have.property('name', 'Test Product');
        });

        it('should get a single product by ID', async () => {
            const response = await request(app)
                .get(`/api/products/${productId}`);

            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('name', 'Test Product');
            expect(response.body).to.have.property('_id', productId);
        });
    });
});
