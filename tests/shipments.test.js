const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');

const request = supertest(app);
let mongoServer;
let authToken;
let testOrder;
let testUser;

beforeAll(async () => {
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
    // Clear all collections
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Shipment.deleteMany({});

    // Create test user
    const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
    };

    const registerResponse = await request
        .post('/api/auth/register')
        .send(userData);

    authToken = registerResponse.body.token;
    testUser = await User.findOne({ email: userData.email });

    // Create test product
    const productData = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        image: 'test-image.jpg',
        category: 'Test Category',
        stock: 10
    };

    const product = await Product.create(productData);

    // Create test order
    const orderData = {
        user: testUser._id,
        items: [{
            product: product._id,
            quantity: 1,
            price: product.price
        }],
        total: product.price,
        shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'Test State',
            zipCode: '12345',
            country: 'Test Country'
        }
    };

    testOrder = await Order.create(orderData);
});

describe('Shipment Endpoints', () => {
    describe('POST /api/shipments', () => {
        it('should create a new shipment', async () => {
            const shipmentData = {
                orderId: testOrder._id,
                carrier: 'UPS',
                trackingNumber: '1Z999999999',
                shippingMethod: 'standard'
            };

            const response = await request
                .post('/api/shipments')
                .set('x-auth-token', authToken)
                .send(shipmentData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('tracking.carrier', 'UPS');
            expect(response.body).toHaveProperty('tracking.trackingNumber', '1Z999999999');
            expect(response.body).toHaveProperty('order', testOrder._id.toString());
        });

        it('should not create shipment for non-existent order', async () => {
            const fakeOrderId = new mongoose.Types.ObjectId();
            const shipmentData = {
                orderId: fakeOrderId,
                carrier: 'UPS',
                trackingNumber: '1Z999999999',
                shippingMethod: 'standard'
            };

            const response = await request
                .post('/api/shipments')
                .set('x-auth-token', authToken)
                .send(shipmentData);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('message', 'Order not found');
        });
    });

    describe('PATCH /api/shipments/:id/status', () => {
        it('should update shipment status', async () => {
            // First create a shipment
            const shipmentData = {
                orderId: testOrder._id,
                carrier: 'UPS',
                trackingNumber: '1Z999999999',
                shippingMethod: 'standard'
            };

            const createResponse = await request
                .post('/api/shipments')
                .set('x-auth-token', authToken)
                .send(shipmentData);

            const shipmentId = createResponse.body._id;

            // Update shipment status
            const response = await request
                .patch(`/api/shipments/${shipmentId}/status`)
                .set('x-auth-token', authToken)
                .send({
                    status: 'in_transit',
                    location: 'Test Location'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'in_transit');
            expect(response.body.statusHistory).toHaveLength(2); // Initial + update
        });
    });

    describe('GET /api/shipments/:id', () => {
        it('should get shipment details', async () => {
            // Create shipment first
            const shipmentData = {
                orderId: testOrder._id,
                carrier: 'UPS',
                trackingNumber: '1Z999999999',
                shippingMethod: 'standard'
            };

            const createResponse = await request
                .post('/api/shipments')
                .set('x-auth-token', authToken)
                .send(shipmentData);

            const shipmentId = createResponse.body._id;

            // Get shipment details
            const response = await request
                .get(`/api/shipments/${shipmentId}`)
                .set('x-auth-token', authToken);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('_id', shipmentId);
            expect(response.body).toHaveProperty('tracking.carrier', 'UPS');
        });
    });
});