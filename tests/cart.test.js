const request = require('supertest');
const { expect } = require('chai');
const { app } = require('../server');
const { clearDatabase } = require('./setup');

describe('Cart API Tests', () => {
    let authToken;
    let productId;

    before(async () => {
        // Create a test user and get token
        const authResponse = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            });
        authToken = authResponse.body.token;

        // Create a test product
        const productResponse = await request(app)
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
        productId = productResponse.body._id;
    });

    beforeEach(async () => {
        await clearDatabase();
    });

    describe('POST /api/cart', () => {
        it('should add item to cart', async () => {
            const response = await request(app)
                .post('/api/cart')
                .set('x-auth-token', authToken)
                .send({
                    productId,
                    quantity: 2
                });

            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('items');
            expect(response.body.items).to.have.lengthOf(1);
            expect(response.body.items[0]).to.have.property('quantity', 2);
        });
    });

    describe('GET /api/cart', () => {
        beforeEach(async () => {
            // Add item to cart before each test
            await request(app)
                .post('/api/cart')
                .set('x-auth-token', authToken)
                .send({
                    productId,
                    quantity: 2
                });
        });

        it('should get cart contents', async () => {
            const response = await request(app)
                .get('/api/cart')
                .set('x-auth-token', authToken);

            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('items');
            expect(response.body.items).to.have.lengthOf(1);
        });
    });
});