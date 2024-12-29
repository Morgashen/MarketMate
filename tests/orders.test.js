const chai = require("chai");
const chaiHttp = require("chai-http");
const sinon = require("sinon");
const app = require("../../server");
const Order = require("../../models/orderModel");
const redisClient = require("../../utils/redisClient");
const DatabaseClient = require("../../config/db");

chai.use(chaiHttp);
const { expect } = chai;

describe("Order Routes", () => {
    let request;

    before(() => {
        request = chai.request(app);
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should create a new order", async () => {
        if (await DatabaseClient.connectToDatabase()) {
            const order = {
                orderItems: [{ name: "Item 1", price: 10, quantity: 1 }],
                totalPrice: 10,
                paymentInfo: { method: "card", transactionId: "123" },
            };

            const res = await request.post("/api/orders/create").send(order);

            expect(res).to.have.status(201);
            expect(res.body).to.be.an("object");
            expect(res.body.success).to.be.true;
        }
    });

    it("should get an order by ID", async () => {
        if (await DatabaseClient.connectToDatabase()) {
            const order = { _id: "orderId", user: "userId" };
            sinon.stub(Order, "findById").resolves(order);

            const res = await request.get("/api/orders/orderId");

            expect(res).to.have.status(200);
            expect(res.body).to.be.an("object");
            expect(res.body.success).to.be.true;
        }
    });

    it("should get orders by user ID", async () => {
        if (await DatabaseClient.connectToDatabase()) {
            const orders = [{ user: "userId" }];
            sinon.stub(Order, "find").resolves(orders);

            const res = await request.get("/api/orders/user/myorders");

            expect(res).to.have.status(200);
            expect(res.body).to.be.an("object");
            expect(res.body.success).to.be.true;
        }
    });

    it("should get all orders", async () => {
        if (await DatabaseClient.connectToDatabase()) {
            const orders = [{}, {}];
            sinon.stub(Order, "find").resolves(orders);
            sinon.stub(redisClient, "getKeys").resolves([]);
            sinon.stub(redisClient, "getValue").resolves(null);

            const res = await request.get("/api/orders/all");

            expect(res).to.have.status(200);
            expect(res.body).to.be.an("object");
            expect(res.body.success).to.be.true;
        }
    });
});