const chai = require("chai");
const chaiHttp = require("chai-http");
const sinon = require("sinon");
const app = require("../../server");
const User = require("../../models/userModel");
const DatabaseClient = require("../../config/database");
const { expect } = chai;

chai.use(chaiHttp);

/**
 * Test suite for authentication routes
 * Tests user registration, login, password reset, and related security features
 * Includes both success and failure scenarios to ensure robust security handling
 */
describe("Authentication Routes", () => {
    let request;
    let dbConnection;

    // Initialize database connection and request object before running tests
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

    // Clean up after each test to prevent test pollution
    afterEach(() => {
        sinon.restore();
    });

    // Properly close database connection after all tests
    after(async () => {
        if (dbConnection) {
            await DatabaseClient.disconnect();
        }
    });

    describe("User Registration", () => {
        const validUser = {
            username: "testuser",
            email: "test@example.com",
            password: "Password123!",
        };

        it("should successfully register a new user with valid credentials", async () => {
            // Arrange: Set up our test user and stub the save method
            const saveStub = sinon.stub(User.prototype, "save").resolves(validUser);

            // Act: Attempt to register the user
            const response = await request
                .post("/api/auth/register")
                .send(validUser);

            // Assert: Verify the registration was successful
            expect(response).to.have.status(201);
            expect(response.body).to.be.an("object");
            expect(response.body.success).to.be.true;
            expect(response.body.message).to.equal("User registered successfully");
            expect(saveStub.calledOnce).to.be.true;
        });

        it("should reject registration with duplicate email", async () => {
            // Arrange: Simulate a duplicate email error
            sinon.stub(User.prototype, "save").rejects({
                code: 11000,
                keyPattern: { email: 1 }
            });

            // Act: Attempt to register with duplicate email
            const response = await request
                .post("/api/auth/register")
                .send(validUser);

            // Assert: Verify the appropriate error response
            expect(response).to.have.status(400);
            expect(response.body.success).to.be.false;
            expect(response.body.error).to.include("Email already exists");
        });

        it("should validate password requirements", async () => {
            // Act: Attempt to register with weak password
            const response = await request
                .post("/api/auth/register")
                .send({
                    ...validUser,
                    password: "weak"
                });

            // Assert: Verify password validation
            expect(response).to.have.status(400);
            expect(response.body.success).to.be.false;
            expect(response.body.error).to.include("Password must meet requirements");
        });
    });

    describe("User Login", () => {
        const validCredentials = {
            email: "test@example.com",
            password: "Password123!"
        };

        it("should successfully log in a user with valid credentials", async () => {
            // Arrange: Create a mock user with password comparison
            const mockUser = {
                ...validCredentials,
                comparePassword: sinon.stub().returns(true),
                generateAuthToken: () => "mock-jwt-token"
            };
            sinon.stub(User, "findOne").resolves(mockUser);

            // Act: Attempt to log in
            const response = await request
                .post("/api/auth/login")
                .send(validCredentials);

            // Assert: Verify successful login
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body).to.have.property("token");
        });

        it("should reject login with incorrect password", async () => {
            // Arrange: Set up mock user with failed password comparison
            const mockUser = {
                ...validCredentials,
                comparePassword: sinon.stub().returns(false)
            };
            sinon.stub(User, "findOne").resolves(mockUser);

            // Act: Attempt to log in with wrong password
            const response = await request
                .post("/api/auth/login")
                .send(validCredentials);

            // Assert: Verify login rejection
            expect(response).to.have.status(401);
            expect(response.body.success).to.be.false;
            expect(response.body.error).to.equal("Invalid credentials");
        });
    });

    describe("Password Reset Flow", () => {
        const userEmail = "test@example.com";

        it("should initiate password reset process successfully", async () => {
            // Arrange: Set up mock user for password reset
            const mockUser = {
                email: userEmail,
                save: sinon.stub().resolves(),
                generatePasswordResetToken: () => "reset-token"
            };
            sinon.stub(User, "findOne").resolves(mockUser);

            // Act: Request password reset
            const response = await request
                .post("/api/user/forgot-password")
                .send({ email: userEmail });

            // Assert: Verify reset process initiated
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body.message).to.include("Password reset email sent");
        });

        it("should successfully reset password with valid token", async () => {
            // Arrange: Set up mock user with valid reset token
            const mockUser = {
                resetPasswordToken: "valid-token",
                resetPasswordExpire: Date.now() + 3600000,
                save: sinon.stub().resolves()
            };
            sinon.stub(User, "findOne").resolves(mockUser);

            // Act: Attempt to reset password
            const response = await request
                .post("/api/user/reset-password/valid-token")
                .send({ password: "NewPassword123!" });

            // Assert: Verify password reset
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body.message).to.include("Password reset successful");
            expect(mockUser.save.calledOnce).to.be.true;
        });

        it("should reject password reset with expired token", async () => {
            // Arrange: Set up mock user with expired reset token
            const mockUser = {
                resetPasswordToken: "expired-token",
                resetPasswordExpire: Date.now() - 3600000
            };
            sinon.stub(User, "findOne").resolves(mockUser);

            // Act: Attempt to reset password with expired token
            const response = await request
                .post("/api/user/reset-password/expired-token")
                .send({ password: "NewPassword123!" });

            // Assert: Verify reset rejection
            expect(response).to.have.status(400);
            expect(response.body.success).to.be.false;
            expect(response.body.error).to.include("Password reset token expired");
        });
    });
});