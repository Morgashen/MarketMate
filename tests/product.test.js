const chai = require("chai");
const chaiHttp = require("chai-http");
const sinon = require("sinon");
const app = require("../../server");
const Product = require("../../models/productModel");
const DatabaseClient = require("../../config/database");
const { expect } = chai;

chai.use(chaiHttp);

/**
 * Test suite for product management functionality
 * Tests product CRUD operations, validation, and error handling
 * Includes inventory management and product data integrity checks
 */
describe("Product Management System", () => {
    let request;
    let dbConnection;

    // Sample product data for testing scenarios
    const sampleProduct = {
        name: "Premium Cotton T-Shirt",
        sku: "SHIRT-123",
        price: 29.99,
        description: "High-quality cotton t-shirt with custom design",
        category: "Apparel",
        images: ["tshirt-front.jpg", "tshirt-back.jpg"],
        specifications: {
            material: "100% Cotton",
            weight: "180g",
            sizes: ["S", "M", "L", "XL"]
        },
        inventory: {
            inStock: 100,
            lowStockThreshold: 20
        }
    };

    // Initialize test environment
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

    // Close database connection after all tests
    after(async () => {
        if (dbConnection) {
            await DatabaseClient.disconnect();
        }
    });

    describe("Product Creation", () => {
        it("should successfully create a new product with valid data", async () => {
            // Arrange: Set up product creation with complete data
            const saveStub = sinon.stub(Product.prototype, "save").resolves(sampleProduct);

            // Act: Attempt to create the product
            const response = await request
                .post("/api/products/new")
                .send(sampleProduct);

            // Assert: Verify successful product creation
            expect(response).to.have.status(201);
            expect(response.body.success).to.be.true;
            expect(response.body.product).to.have.property("sku");
            expect(saveStub.calledOnce).to.be.true;
        });

        it("should validate required product fields", async () => {
            // Arrange: Create product with missing required fields
            const incompleteProduct = {
                name: "Incomplete Product"
                // Missing required fields like SKU and price
            };

            // Act: Attempt to create product with missing data
            const response = await request
                .post("/api/products/new")
                .send(incompleteProduct);

            // Assert: Verify validation failure
            expect(response).to.have.status(400);
            expect(response.body.success).to.be.false;
            expect(response.body.errors).to.include.members(["SKU is required", "Price is required"]);
        });

        it("should prevent duplicate SKU creation", async () => {
            // Arrange: Simulate duplicate SKU error
            const duplicateError = new Error("Duplicate key error");
            duplicateError.code = 11000;
            sinon.stub(Product.prototype, "save").rejects(duplicateError);

            // Act: Attempt to create product with existing SKU
            const response = await request
                .post("/api/products/new")
                .send(sampleProduct);

            // Assert: Verify duplicate handling
            expect(response).to.have.status(409);
            expect(response.body.success).to.be.false;
            expect(response.body.error).to.include("SKU already exists");
        });
    });

    describe("Product Updates", () => {
        it("should successfully update an existing product", async () => {
            // Arrange: Prepare product updates
            const updates = {
                price: 34.99,
                description: "Updated premium cotton t-shirt description",
                inventory: {
                    inStock: 150,
                    lowStockThreshold: 30
                }
            };

            const updatedProduct = { ...sampleProduct, ...updates };
            sinon.stub(Product, "findOneAndUpdate").resolves(updatedProduct);

            // Act: Update the product
            const response = await request
                .put("/api/products/update/SHIRT-123")
                .send(updates);

            // Assert: Verify update success
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body.product.price).to.equal(updates.price);
        });

        it("should validate price updates", async () => {
            // Arrange: Prepare invalid price update
            const invalidUpdate = {
                price: -10.99 // Negative price
            };

            // Act: Attempt invalid price update
            const response = await request
                .put("/api/products/update/SHIRT-123")
                .send(invalidUpdate);

            // Assert: Verify price validation
            expect(response).to.have.status(400);
            expect(response.body.success).to.be.false;
            expect(response.body.error).to.include("Price must be positive");
        });
    });

    describe("Product Retrieval", () => {
        it("should successfully retrieve a product by SKU", async () => {
            // Arrange: Set up product retrieval
            sinon.stub(Product, "findOne").resolves(sampleProduct);

            // Act: Retrieve the product
            const response = await request.get("/api/products/SHIRT-123");

            // Assert: Verify retrieved product
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body.product).to.deep.equal(sampleProduct);
        });

        it("should handle non-existent product SKUs", async () => {
            // Arrange: Simulate non-existent product
            sinon.stub(Product, "findOne").resolves(null);

            // Act: Attempt to retrieve non-existent product
            const response = await request.get("/api/products/NONEXISTENT");

            // Assert: Verify not found handling
            expect(response).to.have.status(404);
            expect(response.body.success).to.be.false;
            expect(response.body.error).to.include("Product not found");
        });
    });

    describe("Product Listing", () => {
        it("should retrieve all products with pagination", async () => {
            // Arrange: Set up product list with pagination
            const productList = [sampleProduct, { ...sampleProduct, sku: "SHIRT-124" }];
            sinon.stub(Product, "find").resolves(productList);
            sinon.stub(Product, "countDocuments").resolves(2);

            // Act: Retrieve products with pagination
            const response = await request
                .get("/api/products")
                .query({ page: 1, limit: 10 });

            // Assert: Verify paginated results
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body.products).to.be.an("array");
            expect(response.body.pagination).to.deep.include({
                currentPage: 1,
                totalPages: 1,
                totalProducts: 2
            });
        });

        it("should support product filtering and sorting", async () => {
            // Arrange: Set up filtered product search
            const filteredProducts = [sampleProduct];
            const findStub = sinon.stub(Product, "find").returnsThis();
            const sortStub = sinon.stub(Product, "sort").returnsThis();
            const execStub = sinon.stub(Product, "exec").resolves(filteredProducts);

            // Act: Retrieve filtered and sorted products
            const response = await request
                .get("/api/products")
                .query({
                    category: "Apparel",
                    minPrice: 20,
                    maxPrice: 50,
                    sortBy: "price",
                    order: "asc"
                });

            // Assert: Verify filtered results
            expect(response).to.have.status(200);
            expect(response.body.success).to.be.true;
            expect(response.body.products).to.be.an("array");
            expect(findStub.called).to.be.true;
            expect(sortStub.called).to.be.true;
        });
    });
});