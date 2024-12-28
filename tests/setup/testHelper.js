const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');
const Product = require('../../models/Product');

const createTestUser = async () => {
    const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
    };

    const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

    return {
        user: response.body.user,
        token: response.body.token
    };
};

const createTestProduct = async (token) => {
    const productData = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        image: 'test-image.jpg',
        category: 'Test Category',
        stock: 10
    };

    const response = await request(app)
        .post('/api/products')
        .set('x-auth-token', token)
        .send(productData);

    return response.body;
};

module.exports = {
    createTestUser,
    createTestProduct
};