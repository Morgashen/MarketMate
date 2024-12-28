const request = require('supertest');
const app = require('../server'); // Adjust the path if needed

describe('Orders API', () => {
    it('should create a new order', async () => {
        const response = await request(app)
            .post('/orders')
            .send({
                userId: '123456',
                productId: '654321',
                quantity: 2
            });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('userId', '123456');
    });

    it('should get all orders', async () => {
        const response = await request(app)
            .get('/orders');

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });
});