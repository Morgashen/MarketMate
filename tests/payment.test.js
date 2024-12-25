const chai = require("chai");
const chaiHttp = require("chai-http");
const sinon = require("sinon");
const app = require("../../server");
const stripe = require("../../config/stripe");
const redisClient = require("../../utils/redisClient");
const Order = require("../../models/orderModel");
const DatabaseClient = require("../../config/database");
const { expect } = chai;

chai.use(chaiHttp);

/**
 * Test suite for payment processing functionality
 * Tests payment processing, validation, security measures, and error handling
 * Includes tests for different payment methods and scenarios
 */
describe("Payment Processing System", () => {
    let request;
    let dbConnection;

    // Sample payment data for testing
    const validPaymentDetails = {
        amount: 1000, // $10.00 in cents
        currency: "usd",
        paymentMethodId: "pm_valid_123",
        shippingDetails: {
            name: "John Doe",
            address: "123 Main St",
            city: "New York",
            state: "NY",
            postalCode: "10001",
            country: "USA"
        },
        billingDetails: {
            name: "John Doe",
            email: "john@example.com"
        }
    };

    const sampleCart = {
        cartItems: [
            { name: "Premium Widget", price: 100, quantity: 10 }
        ],
        subtotal: 1000,
        tax: 80,
        shipping: 50
    };

    // Set up test environment
    before(async () => {
        request = chai.request(app);
        try {
            dbConnection = await DatabaseClient.connectToDatabase();
            if (!dbConnection) {
                throw new Error("Database connection failed");
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

    // Close database connection after all tests
    after(async () => {
        if (dbConnection) {
            await DatabaseClient.disconnect();
        }
    });

    describe("Payment Processing", () => {
        it("should successfully process a valid payment", async () => {
            // Arrange: Set up successful payment scenario
            const paymentIntent = {
                id: "pi_valid_123",
                status: "succeeded",
                amount: validPaymentDetails.amount,
                currency: validPaymentDetails.currency
            };

            // Mock external service calls
            sinon.stub(stripe.paymentIntents, "create").resolves(paymentIntent);
            sinon.stub(redisClient, "getValue").resolves(JSON.stringify(sampleCart));
            sinon.stub(Order.prototype, "save").resolves({
                ...sampleCart,
                paymentId: paymentIntent.id
            });

            // Act: Attempt to process payment
            const response = await request
                .post("/api/payment/pay")
                .send(validPaymentDetails);

            // Assert: Verify successful payment processing
            expect(response).to.have.status(201);
            expect(response.body.success).to.be.true;
            expect(response.body.paymentIntent).to.have.property("id");
            expect(response.body.order).to.have.property("paymentId");
        });

        it("should validate payment amount against cart total", async () => {
            // Arrange: Create cart with different total than payment amount
            const invalidCart = {
                ...sampleCart,
                subtotal: 2000 // Different from payment amount
            };
            sinon.stub(redisClient, "getValue").resolves(JSON.stringify(invalidCart));

            // Act: Attempt payment with mismatched amount
            const response = await request
                .post("/api/payment/pay")
                .send(validPaymentDetails);

            // Assert: Verify amount validation
            expect(response).to.have.status(400);
            expect(response.body.success).to.be.false;
            expect(response.body.error).to.include("Payment amount mismatch");
        });

        it("should handle payment method decline gracefully", async () => {
            // Arrange: Simulate declined payment
            sinon.stub(stripe.paymentIntents, "create").rejects({
                type: "StripeCardError",
                message: "Your card was declined"
            });
            sinon.stub(redisClient, "getValue").resolves(JSON.stringify(sampleCart));

            // Act: Attempt payment with declined card
            const response = await request
                .post("/api/payment/pay")
                .send(validPaymentDetails);

            // Assert: Verify proper error handling
            expect(response).to.have.status(400);
            expect(response.body.success).to.be.false);
        expect(response.body.error).to.include("Payment failed");
        expect(response.body.details).to.include("card was declined");
    });
});

describe("Payment Security", () => {
    it("should require valid shipping information", async () => {
        // Arrange: Create payment details with missing shipping info
        const invalidPayment = { ...validPaymentDetails };
        delete invalidPayment.shippingDetails.postalCode;

        // Act: Attempt payment with invalid shipping
        const response = await request
            .post("/api/payment/pay")
            .send(invalidPayment);

        // Assert: Verify shipping validation
        expect(response).to.have.status(400);
        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include("Invalid shipping information");
    });

    it("should validate currency codes", async () => {
        // Arrange: Create payment with invalid currency
        const invalidPayment = {
            ...validPaymentDetails,
            currency: "invalid"
        };

        // Act: Attempt payment with invalid currency
        const response = await request
            .post("/api/payment/pay")
            .send(invalidPayment);

        // Assert: Verify currency validation
        expect(response).to.have.status(400);
        expect(response.body.success).to.be.false;
        expect(response.body.error).to.include("Invalid currency code");
    });
});

describe("Payment Recovery", () => {
    it("should handle temporary Stripe outages", async () => {
        // Arrange: Simulate temporary Stripe outage
        const stripeError = new Error("Connection error");
        stripeError.type = "StripeConnectionError";
        sinon.stub(stripe.paymentIntents, "create")
            .onFirstCall().rejects(stripeError)
            .onSecondCall().resolves({
                id: "pi_retry_123",
                status: "succeeded"
            });
        sinon.stub(redisClient, "getValue").resolves(JSON.stringify(sampleCart));

        // Act: Attempt payment during outage
        const response = await request
            .post("/api/payment/pay")
            .send(validPaymentDetails);

        // Assert: Verify automatic retry and recovery
        expect(response).to.have.status(201);
        expect(response.body.success).to.be.true;
        expect(response.body.retried).to.be.true;
    });

    it("should save failed payment attempts for recovery", async () => {
        // Arrange: Set up failed payment scenario
        sinon.stub(stripe.paymentIntents, "create").rejects({
            type: "StripeAPIError",
            message: "API Error"
        });
        const saveFailedPaymentStub = sinon.stub(Order.prototype, "save").resolves({
            status: "payment_failed",
            retryToken: "retry_token_123"
        });

        // Act: Attempt payment that fails
        const response = await request
            .post("/api/payment/pay")
            .send(validPaymentDetails);

        // Assert: Verify failed payment is saved
        expect(response).to.have.status(503);
        expect(response.body.success).to.be.false;
        expect(response.body).to.have.property("retryToken");
        expect(saveFailedPaymentStub.calledOnce).to.be.true;
    });
});
});