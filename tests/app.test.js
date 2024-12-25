const chai = require("chai");
const chaiHttp = require("chai-http");
const sinon = require("sinon");
const app = require("../../server");
const redisClient = require("../../utils/redisClient");
const DatabaseClient = require("../../config/database");
const { User, Product, Order } = require("../../models"); // Adding explicit model imports

chai.use(chaiHttp);
const { expect } = chai;

/**
 * Test suite for application routes
 * Tests status endpoints and statistics gathering functionality
 */
describe("App Routes", () => {
    let request;
    let dbConnection;

    // Setup before all tests
    before(async () => {
        request = chai.request(app);
        // Establish database connection once before all tests
        try {
            dbConnection = await DatabaseClient.connectToDatabase();
            if (!dbConnection) {
                throw new Error("Failed to connect to database");
            }
        } catch (error) {
            console.error("Database connection failed:", error);
            throw error;
        }
    });

    // Cleanup after each test
    afterEach(() => {
        sinon.restore();
    });

    // Cleanup after all tests
    after(async () => {
        if (dbConnection) {
            await DatabaseClient.disconnect();
        }
    });

    describe("GET /api/app/status", () => {
        it("should return successful application status when all services are up", async () => {
            // Arrange
            const redisPingStub = sinon.stub(redisClient, "ping").resolves("PONG");

            // Act
            const response = await request.get("/api/app/status");

            // Assert
            expect(response).to.have.status(200);
            expect(response.body).to.be.an("object");
            expect(response.body.redisActive).to.be.true;
            expect(response.body.databaseActive).to.be.true;

            // Verify our stub was called
            expect(redisPingStub.calledOnce).to.be.true;
        });

        it("should handle redis failure gracefully", async () => {
            // Arrange
            sinon.stub(redisClient, "ping").rejects(new Error("Redis connection failed"));

            // Act
            const response = await request.get("/api/app/status");

            // Assert
            expect(response).to.have.status(200);
            expect(response.body).to.be.an("object");
            expect(response.body.redisActive).to.be.false;
            expect(response.body.databaseActive).to.be.true;
        });
    });

    describe("GET /api/app/stats", () => {
        it("should return accurate application statistics", async () => {
            // Arrange
            const expectedStats = {
                totalNumberOfUsers: 10,
                totalNumberOfProducts: 20,
                totalNumberOfOrders: 30,
            };

            // Setup stubs for each model count
            const userCountStub = sinon.stub(User, "countDocuments")
                .resolves(expectedStats.totalNumberOfUsers);
            const productCountStub = sinon.stub(Product, "countDocuments")
                .resolves(expectedStats.totalNumberOfProducts);
            const orderCountStub = sinon.stub(Order, "countDocuments")
                .resolves(expectedStats.totalNumberOfOrders);

            // Act
            const response = await request.get("/api/app/stats");

            // Assert
            expect(response).to.have.status(200);
            expect(response.body).to.be.an("object");
            expect(response.body).to.deep.equal(expectedStats);

            // Verify all stubs were called
            expect(userCountStub.calledOnce).to.be.true;
            expect(productCountStub.calledOnce).to.be.true;
            expect(orderCountStub.calledOnce).to.be.true;
        });

        it("should handle database query errors gracefully", async () => {
            // Arrange
            sinon.stub(User, "countDocuments")
                .rejects(new Error("Database query failed"));

            // Act
            const response = await request.get("/api/app/stats");

            // Assert
            expect(response).to.have.status(500);
            expect(response.body).to.have.property("error");
        });
    });
});