const supertest = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const config = require('config');

const request = supertest(app);
let mongoServer;

describe('Authentication Endpoints', () => {
    beforeAll(async () => {
        // Create an in-memory MongoDB instance
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();

        // Connect to the in-memory database
        await mongoose.connect(mongoUri);
    });

    afterAll(async () => {
        // Cleanup and close connection
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear the users collection before each test
        await User.deleteMany({});
    });

    describe('POST /api/auth/register', () => {
        const validUser = {
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123'
        };

        it('should register a new user successfully', async () => {
            const response = await request
                .post('/api/auth/register')
                .send(validUser);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');

            // Verify user was created in database
            const user = await User.findOne({ email: validUser.email });
            expect(user).toBeTruthy();
            expect(user.name).toBe(validUser.name);
        });

        it('should not register user with existing email', async () => {
            // First registration
            await request
                .post('/api/auth/register')
                .send(validUser);

            // Attempt duplicate registration
            const response = await request
                .post('/api/auth/register')
                .send(validUser);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('message', 'User already exists');
        });

        it('should validate required fields', async () => {
            const response = await request
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    // Missing email and password
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('errors');
        });

        it('should validate password length', async () => {
            const response = await request
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: '123' // Too short
                });

            expect(response.status).toBe(400);
            expect(response.body.errors[0].msg).toContain('6');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            // Create a test user before each login test
            await request
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123'
                });
        });

        it('should login successfully with valid credentials', async () => {
            const response = await request
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');

            // Verify token is valid
            const decoded = jwt.verify(response.body.token, config.get('jwtSecret'));
            expect(decoded).toHaveProperty('user.id');
        });

        it('should not login with incorrect password', async () => {
            const response = await request
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('message', 'Invalid credentials');
        });

        it('should not login with non-existent email', async () => {
            const response = await request
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('message', 'Invalid credentials');
        });
    });

    describe('GET /api/auth/user', () => {
        let authToken;

        beforeEach(async () => {
            // Create a test user and get token
            const response = await request
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123'
                });

            authToken = response.body.token;
        });

        it('should get user profile with valid token', async () => {
            const response = await request
                .get('/api/auth/user')
                .set('x-auth-token', authToken);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('name', 'Test User');
            expect(response.body).toHaveProperty('email', 'test@example.com');
            expect(response.body).not.toHaveProperty('password');
        });

        it('should not get profile without token', async () => {
            const response = await request
                .get('/api/auth/user');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message', 'No token, authorization denied');
        });

        it('should not get profile with invalid token', async () => {
            const response = await request
                .get('/api/auth/user')
                .set('x-auth-token', 'invalid-token');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message', 'Token is not valid');
        });
    });
});