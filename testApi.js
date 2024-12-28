const request = require('supertest');
const { app } = require('./server');  // Destructure to get just the app

async function testApi() {
    try {
        console.log('Testing Authentication...');

        // Your existing test code remains the same, just make sure you're using
        // the destructured app instance
        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            });

        // Rest of your test code...
    } catch (error) {
        console.error('Error testing API:', error.response?.body || error);
    }
}

// Before running tests, ensure we're in test environment
process.env.NODE_ENV = 'test';

// Run the tests
testApi();