const request = require('supertest');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const app = require('../app');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

jest.mock('../utils/redis');
jest.mock('bcrypt');

describe('UsersController', () => {
  let db;
  let usersCollection;

  beforeAll(async () => {
    await dbClient.connect();
    db = dbClient.client.db(dbClient.dbName);
    usersCollection = db.collection('users');
  });

  beforeEach(async () => {
    await usersCollection.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await dbClient.client.close();
  });

  describe('POST /users', () => {
    it('should create a new user successfully', async () => {
      const email = 'test@example.com';
      const password = 'testpassword';
      const hashedPassword = 'hashedpassword123';

      bcrypt.hash.mockResolvedValue(hashedPassword);

      const response = await request(app)
        .post('/users')
        .send({ email, password });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(email);

      const user = await usersCollection.findOne({ email });
      expect(user).toBeTruthy();
      expect(user.password).toBe(hashedPassword);
    });

    it('should return error if email is missing', async () => {
      const response = await request(app)
        .post('/users')
        .send({ password: 'testpassword' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing email');
    });

    it('should return error if password is missing', async () => {
      const response = await request(app)
        .post('/users')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing password');
    });

    it('should return error if user already exists', async () => {
      const email = 'test@example.com';
      await usersCollection.insertOne({
        email,
        password: 'hashedpassword123'
      });

      const response = await request(app)
        .post('/users')
        .send({ email, password: 'testpassword' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Already exist');
    });
  });

  describe('GET /users/me', () => {
    it('should return user information with valid token', async () => {
      const userId = new ObjectId();
      const email = 'test@example.com';
      const token = 'valid-token';

      await usersCollection.insertOne({
        _id: userId,
        email,
        password: 'hashedpassword123'
      });

      redisClient.get.mockResolvedValue(userId.toString());

      const response = await request(app)
        .get('/users/me')
        .set('X-Token', token);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: userId.toString(),
        email
      });
    });

    it('should return unauthorized if token is missing', async () => {
      const response = await request(app)
        .get('/users/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return unauthorized if token is invalid', async () => {
      redisClient.get.mockResolvedValue(null);

      const response = await request(app)
        .get('/users/me')
        .set('X-Token', 'invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return unauthorized if user not found', async () => {
      const userId = new ObjectId();
      const token = 'valid-token';

      redisClient.get.mockResolvedValue(userId.toString());

      const response = await request(app)
        .get('/users/me')
        .set('X-Token', token);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });
});