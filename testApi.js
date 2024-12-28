const request = require('supertest');
const app = require('./server');

async function testApi() {
    try {
        // Test Authentication
        console.log('Testing Authentication...');

        // Register
        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            });

        console.log('Register Response:', registerResponse.body);
        const token = registerResponse.body.token;

        // Login
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123'
            });

        console.log('Login Response:', loginResponse.body);

        // Test Product Management
        console.log('\nTesting Product Management...');

        // Create Product
        const productResponse = await request(app)
            .post('/api/products')
            .set('x-auth-token', token)
            .send({
                name: 'Test Product',
                description: 'Test Description',
                price: 99.99,
                image: 'test-image.jpg',
                category: 'Test Category',
                stock: 10
            });

        console.log('Create Product Response:', productResponse.body);
        const productId = productResponse.body._id;

        // Get Products
        const getProductsResponse = await request(app)
            .get('/api/products');

        console.log('Get Products Response:', getProductsResponse.body);

        // Test Cart Management
        console.log('\nTesting Cart Management...');

        // Add to Cart
        const addToCartResponse = await request(app)
            .post('/api/cart')
            .set('x-auth-token', token)
            .send({
                productId,
                quantity: 2
            });

        console.log('Add to Cart Response:', addToCartResponse.body);

        // Get Cart
        const getCartResponse = await request(app)
            .get('/api/cart')
            .set('x-auth-token', token);

        console.log('Get Cart Response:', getCartResponse.body);

        // Test Order Management
        console.log('\nTesting Order Management...');

        // Create Order
        const orderResponse = await request(app)
            .post('/api/orders')
            .set('x-auth-token', token)
            .send({
                shippingAddress: {
                    street: '123 Test St',
                    city: 'Test City',
                    state: 'Test State',
                    zipCode: '12345',
                    country: 'Test Country'
                }
            });

        console.log('Create Order Response:', orderResponse.body);

        // Get Orders
        const getOrdersResponse = await request(app)
            .get('/api/orders')
            .set('x-auth-token', token);

        console.log('Get Orders Response:', getOrdersResponse.body);

        console.log('\nAPI Testing Complete!');
    } catch (error) {
        console.error('Error testing API:', error.response?.body || error);
    }
}

// Run the tests
testApi();