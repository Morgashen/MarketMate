const request = require('supertest');
const { expect } = require('chai');
const { app } = require('../server');
const { clearDatabase } = require('./setup');

describe('Shipments API Tests', () => {
    let authToken;
    let orderId;
    let shipmentId;

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

        // Create a test product and add to cart
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

        await request(app)
            .post('/api/cart')
            .set('x-auth-token', authToken)
            .send({
                productId: productResponse.body._id,
                quantity: 2
            });

        // Create a test order
        const orderResponse = await request(app)
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
        orderId = orderResponse.body._id;
    });

    beforeEach(async () => {
        await clearDatabase();
    });

    describe('POST /api/shipments', () => {
        it('should create a new shipment for an order', async () => {
            const response = await request(app)
                .post('/api/shipments')
                .set('x-auth-token', authToken)
                .send({
                    orderId,
                    carrier: 'UPS',
                    trackingNumber: '1Z999AA1234567890',
                    estimatedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                });

            expect(response.status).to.equal(201);
            expect(response.body).to.have.property('orderId', orderId);
            expect(response.body).to.have.property('carrier', 'UPS');
            expect(response.body).to.have.property('trackingNumber');
            expect(response.body).to.have.property('status', 'pending');

            shipmentId = response.body._id;
        });

        it('should fail to create shipment for non-existent order', async () => {
            const response = await request(app)
                .post('/api/shipments')
                .set('x-auth-token', authToken)
                .send({
                    orderId: '507f1f77bcf86cd799439011', // Non-existent order ID
                    carrier: 'UPS',
                    trackingNumber: '1Z999AA1234567890'
                });

            expect(response.status).to.equal(404);
            expect(response.body).to.have.property('message', 'Order not found');
        });
    });

    describe('GET /api/shipments', () => {
        beforeEach(async () => {
            // Create a test shipment before each test
            const shipmentResponse = await request(app)
                .post('/api/shipments')
                .set('x-auth-token', authToken)
                .send({
                    orderId,
                    carrier: 'UPS',
                    trackingNumber: '1Z999AA1234567890',
                    estimatedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                });
            shipmentId = shipmentResponse.body._id;
        });

        it('should get all shipments for user', async () => {
            const response = await request(app)
                .get('/api/shipments')
                .set('x-auth-token', authToken);

            expect(response.status).to.equal(200);
            expect(response.body).to.be.an('array');
            expect(response.body).to.have.lengthOf(1);
            expect(response.body[0]).to.have.property('carrier', 'UPS');
        });

        it('should get a single shipment by ID', async () => {
            const response = await request(app)
                .get(`/api/shipments/${shipmentId}`)
                .set('x-auth-token', authToken);

            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('_id', shipmentId);
            expect(response.body).to.have.property('carrier', 'UPS');
        });
    });

    describe('PATCH /api/shipments/:id/status', () => {
        beforeEach(async () => {
            // Create a test shipment before each test
            const shipmentResponse = await request(app)
                .post('/api/shipments')
                .set('x-auth-token', authToken)
                .send({
                    orderId,
                    carrier: 'UPS',
                    trackingNumber: '1Z999AA1234567890'
                });
            shipmentId = shipmentResponse.body._id;
        });

        it('should update shipment status', async () => {
            const response = await request(app)
                .patch(`/api/shipments/${shipmentId}/status`)
                .set('x-auth-token', authToken)
                .send({
                    status: 'in_transit',
                    location: 'Distribution Center',
                    notes: 'Package has left the warehouse'
                });

            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('status', 'in_transit');
            expect(response.body).to.have.property('location', 'Distribution Center');
        });

        it('should fail to update with invalid status', async () => {
            const response = await request(app)
                .patch(`/api/shipments/${shipmentId}/status`)
                .set('x-auth-token', authToken)
                .send({
                    status: 'invalid_status'
                });

            expect(response.status).to.equal(400);
            expect(response.body).to.have.property('message').that.includes('Invalid status');
        });
    });
});