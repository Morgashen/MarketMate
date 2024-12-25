const chai = require("chai");
const chaiHttp = require("chai-http");
const sinon = require("sinon");
const app = require("../../server");
const Order = require("../../models/orderModel");
const redisClient = require("../../utils/redisClient");
const DatabaseClient = require("../../config/database");
const { expect } = chai;

chai.use(chaiHttp);

/**
 * Test suite for order management functionality
 * Tests order creation, retrieval, and management operations
 * Includes validation, caching, and error handling scenarios
 */
describe("Order Management System", () => {
    let request;
    let dbConnection;

    // Sample order data for testing
    const sampleOrder = {
        orderItems: [
            { name: "Premium Widget", price: 29.99, quantity: 2 },
            { name: "Basic Gadget", price: 15.50, quantity: 1 }
        ],
        totalPrice: 75.48,
        paymentInfo: {
            method: "card",
            transactionId: "txn_123456789"
        },
        shippingAddress: {
            street: "123 Test St",
            city: "Testville",
            zipCode: "12345"
        }
    };

    // Initialize database connection and request object
    before(async () => {
        request = chai.request(app);
        try {
            dbConnection = await DatabaseClient.connectToDatabase();
            if (!dbConnection) {
                throw new Error("Failed to establish database connection");
            }
        } catch (error) {
            console.error("Database connection failed:", error);
            throw error;
        }
    });

    // Clean up after each test
    afterEach(() => {
        sinon.restore();
    });

    // Properly close database connection after all tests
    after(async () => {
        if (dbConnection) {
            await DatabaseClient.disconnect();
        }
    });

    describe("Order Creation", () => {
        it("should successfully create a new order with valid data", async () => {
            // Arrange: Set up order creation stub
            const savedOrder = { ...sampleOrder, _id: "order123" };
            const saveStub = sinon.stub(Order.prototype, "save").resolves(savedOrder);

            // Act: Attempt to create the order
            const response = await request
                .post("/api/orders/create")
                .send(sampleOrder);

            // Assert: Verify order creation
            expect(response).to.have.status(201);
            expect(response.body.success).to.be.true;
            expect(response.body.order).to.have.property("_id");
            expect(saveStub.calledOnce).to.be.true;
        });

        it("should validate order total price calculation", async () => {
            // Arrange: Create order with incorrect total
            const invalidOrder = {
                ...sampleOrder,
                totalPrice: 999.99 // Incorrect total
            };

            // Act: Attempt to create order with invalid total
            const response = await request
                .post("/api/orders/create")
                .send(invalidOrder);

            // Assert: Verify validation failure
            expect(response).to.have.status(400);
            expect(response.body.success).to.be.false;
            expect(response.body.error).to.include("Total price calculation mismatch");
        });

        it("should require valid payment information", async () => {
            // Arrange: Create order with missing payment info
            const orderWithoutPayment = { ...sampleOrder };
            delete orderWithoutPayment.paymentInfo;

            // Act: Attempt to create order without payment
            const response = await request
                .post("/api/orders/create")
                .send(orderWithoutPayment);

            // Assert: Verify payment validation
            expect(response).to.have.status(400);
            expect(response.body.success).to.be.false;
            expect(response.body.error).to.include("Payment information required");
        });
    });

    describe("Order Retrieval", () => {
        it("should successfully retrieve an order by ID", async () => {
            // Arrange: Set up mock order
            const mockOrder = {
                _id: "order123",
                ...sampleOrder,
                user: "user123"
            };
            sinon.stub(Order, "findById").resolves(mockOrder);

            // Act: Attempt to retrieve the order
            const response = await request.get("/api/orders/order123");

            // Assert: Verify order retrieval
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body.order).to.deep.equal(mockOrder);
        });

        it("should handle non-existent order IDs", async () => {
            // Arrange: Simulate non-existent order
            sinon.stub(Order, "findById").resolves(null);

            // Act: Attempt to retrieve non-existent order
            const response = await request.get("/api/orders/nonexistent");

            // Assert: Verify proper error handling
            expect(response).to.have.status(404);
            expect(response.body.success).to.be.false;
            expect(response.body.error).to.include("Order not found");
        });
    });

    describe("User Order History", () => {
        it("should retrieve all orders for a specific user", async () => {
            // Arrange: Set up mock user orders
            const userOrders = [
                { _id: "order1", ...sampleOrder },
                { _id: "order2", ...sampleOrder }
            ];
            sinon.stub(Order, "find").resolves(userOrders);

            // Act: Retrieve user's orders
            const response = await request.get("/api/orders/user/myorders");

            // Assert: Verify order history retrieval
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body.orders).to.be.an("array");
            expect(response.body.orders).to.have.lengthOf(2);
        });

        it("should return empty array for users with no orders", async () => {
            // Arrange: Simulate user with no orders
            sinon.stub(Order, "find").resolves([]);

            // Act: Attempt to retrieve orders
            const response = await request.get("/api/orders/user/myorders");

            // Assert: Verify empty response
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body.orders).to.be.an("array").that.is.empty;
        });
    });

    describe("Order Administration", () => {
        it("should retrieve all orders with Redis cache integration", async () => {
            // Arrange: Set up cache miss scenario
            const allOrders = [
                { _id: "order1", ...sampleOrder },
                { _id: "order2", ...sampleOrder }
            ];
            sinon.stub(Order, "find").resolves(allOrders);
            sinon.stub(redisClient, "getKeys").resolves([]);
            sinon.stub(redisClient, "getValue").resolves(null);
            sinon.stub(redisClient, "setValue").resolves();

            // Act: Retrieve all orders
            const response = await request.get("/api/orders/all");

            // Assert: Verify admin retrieval
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body.orders).to.be.an("array");
            expect(response.body.orders).to.have.lengthOf(2);
        });

        it("should return cached orders when available", async () => {
            // Arrange: Set up cache hit scenario
            const cachedOrders = [
                { _id: "order1", ...sampleOrder }
            ];
            sinon.stub(redisClient, "getKeys").resolves(["orders"]);
            sinon.stub(redisClient, "getValue").resolves(JSON.stringify(cachedOrders));

            // Act: Retrieve all orders
            const response = await request.get("/api/orders/all");

            // Assert: Verify cached response
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body.orders).to.deep.equal(cachedOrders);
            expect(response.body.cached).to.be.true;
        });
    });
});