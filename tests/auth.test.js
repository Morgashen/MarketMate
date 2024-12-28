const request = require('supertest');
const { expect } = require('chai');
const { app } = require('../server');
const { clearDatabase } = require('./setup');

describe('Authentication API Tests', () => {
    let authToken;

    beforeEach(async () => {
        await clearDatabase();
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(response.status).to.equal(201);
            expect(response.body).to.have.property('token');
            expect(response.body).to.have.property('user');
            expect(response.body.user).to.have.property('name', 'Test User');
            authToken = response.body.token;
        });

        it('should return error for existing email', async () => {
            // First registration
            await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123'
                });

            // Second registration with same email
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User 2',
                    email: 'test@example.com',
                    password: 'password456'
                });

            expect(response.status).to.equal(400);
            expect(response.body).to.have.property('message', 'User already exists');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            // Create a test user before each login test
            await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123'
                });
        });

        it('should login successfully with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(response.status).to.equal(200);
            expect(response.body).to.have.property('token');
            expect(response.body).to.have.property('user');
        });

        it('should return error for invalid password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                });

            expect(response.status).to.equal(401);
            expect(response.body).to.have.property('message', 'Invalid credentials');
        });
    });
});
