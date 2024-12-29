const axios = require('axios');

class MarketMateApiTester {
    constructor(baseUrl = 'http://localhost:5000/api') {
        this.baseUrl = baseUrl;
        this.authToken = null;
        this.testData = {
            productId: null,
            orderId: null,
            shipmentId: null,
            testEmail: `test${Date.now()}@example.com`,
            testPassword: 'test123456'
        };
    }

    async request(method, endpoint, data = null, extraHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
            ...extraHeaders
        };

        try {
            const response = await axios({
                method,
                url: `${this.baseUrl}${endpoint}`,
                data,
                headers
            });
            return { success: true, data: response.data, status: response.status };
        } catch (error) {
            console.error(`Error in ${method} ${endpoint}:`, error.response?.data || error.message);
            return {
                success: false,
                error: {
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message
                }
            };
        }
    }

    async testAuth() {
        console.log('\n=== Testing Authentication Endpoints ===');

        // Test Registration
        console.log('\nTesting Registration...');
        const registerResult = await this.request('POST', '/auth/register', {
            name: 'Test User',
            email: this.testData.testEmail,
            password: this.testData.testPassword
        });
        console.log('Registration Result:', registerResult);

        // Test Login with same credentials
        console.log('\nTesting Login...');
        const loginResult = await this.request('POST', '/auth/login', {
            email: this.testData.testEmail,
            password: this.testData.testPassword
        });
        console.log('Login Result:', loginResult);

        if (loginResult.success) {
            this.authToken = loginResult.data.token;

            // Test Get User
            console.log('\nTesting Get User...');
            const userResult = await this.request('GET', '/auth/user');
            console.log('Get User Result:', userResult);
        } else {
            console.error('Login failed - subsequent tests will fail');
        }
    }

    async testProducts() {
        console.log('\n=== Testing Products Endpoints ===');

        // Create Product
        console.log('\nTesting Create Product...');
        const createResult = await this.request('POST', '/products', {
            name: 'Test Product',
            description: 'A test product description',
            price: 99.99,
            category: 'Test Category',
            stockQuantity: 100
        });
        console.log('Create Product Result:', createResult);

        if (createResult.success) {
            this.testData.productId = createResult.data._id;

            // Get All Products
            console.log('\nTesting Get All Products...');
            const getAllResult = await this.request('GET', '/products');
            console.log('Get All Products Result:', getAllResult);

            // Get Single Product
            console.log('\nTesting Get Single Product...');
            const getOneResult = await this.request('GET', `/products/${this.testData.productId}`);
            console.log('Get Single Product Result:', getOneResult);

            // Update Product
            console.log('\nTesting Update Product...');
            const updateResult = await this.request('PUT', `/products/${this.testData.productId}`, {
                name: 'Updated Test Product',
                price: 149.99
            });
            console.log('Update Product Result:', updateResult);
        } else {
            console.error('Product creation failed - skipping remaining product tests');
        }
    }

    async testCart() {
        if (!this.testData.productId) {
            console.error('No product ID available - skipping cart tests');
            return;
        }

        console.log('\n=== Testing Cart Endpoints ===');

        // Add to Cart
        console.log('\nTesting Add to Cart...');
        const addResult = await this.request('POST', '/cart', {
            productId: this.testData.productId,
            quantity: 2
        });
        console.log('Add to Cart Result:', addResult);

        // Get Cart
        console.log('\nTesting Get Cart...');
        const getResult = await this.request('GET', '/cart');
        console.log('Get Cart Result:', getResult);

        if (addResult.success) {
            // Update Cart Item
            console.log('\nTesting Update Cart Item...');
            const updateResult = await this.request('PUT', `/cart/${this.testData.productId}`, {
                quantity: 3
            });
            console.log('Update Cart Result:', updateResult);

            // Remove from Cart
            console.log('\nTesting Remove from Cart...');
            const removeResult = await this.request('DELETE', `/cart/${this.testData.productId}`);
            console.log('Remove from Cart Result:', removeResult);
        }
    }

    async testOrders() {
        if (!this.testData.productId) {
            console.error('No product ID available - skipping order tests');
            return;
        }

        console.log('\n=== Testing Orders Endpoints ===');

        // Create Order
        console.log('\nTesting Create Order...');
        const createResult = await this.request('POST', '/orders', {
            items: [{
                productId: this.testData.productId,
                quantity: 1
            }],
            shippingAddress: {
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zipCode: '12345'
            }
        });
        console.log('Create Order Result:', createResult);

        if (createResult.success) {
            this.testData.orderId = createResult.data._id;

            // Get All Orders
            console.log('\nTesting Get All Orders...');
            const getAllResult = await this.request('GET', '/orders');
            console.log('Get All Orders Result:', getAllResult);

            // Get Single Order
            console.log('\nTesting Get Single Order...');
            const getOneResult = await this.request('GET', `/orders/${this.testData.orderId}`);
            console.log('Get Single Order Result:', getOneResult);

            // Update Order Status
            console.log('\nTesting Update Order Status...');
            const updateResult = await this.request('PATCH', `/orders/${this.testData.orderId}/status`, {
                status: 'processing'
            });
            console.log('Update Order Status Result:', updateResult);
        }
    }

    async testShipments() {
        if (!this.testData.orderId) {
            console.error('No order ID available - skipping shipment tests');
            return;
        }

        console.log('\n=== Testing Shipments Endpoints ===');

        // Create Shipment
        console.log('\nTesting Create Shipment...');
        const createResult = await this.request('POST', '/shipments', {
            orderId: this.testData.orderId,
            carrier: 'Test Carrier',
            trackingNumber: 'TEST123456'
        });
        console.log('Create Shipment Result:', createResult);

        if (createResult.success) {
            this.testData.shipmentId = createResult.data._id;

            // Get All Shipments
            console.log('\nTesting Get All Shipments...');
            const getAllResult = await this.request('GET', '/shipments');
            console.log('Get All Shipments Result:', getAllResult);

            // Get Single Shipment
            console.log('\nTesting Get Single Shipment...');
            const getOneResult = await this.request('GET', `/shipments/${this.testData.shipmentId}`);
            console.log('Get Single Shipment Result:', getOneResult);

            // Update Shipment
            console.log('\nTesting Update Shipment...');
            const updateResult = await this.request('PATCH', `/shipments/${this.testData.shipmentId}`, {
                status: 'in_transit',
                estimatedDeliveryDate: new Date(Date.now() + 86400000).toISOString()
            });
            console.log('Update Shipment Result:', updateResult);
        }
    }

    async testPayments() {
        console.log('\n=== Testing Payments Endpoints ===');

        // Create Payment Intent
        console.log('\nTesting Create Payment Intent...');
        const createIntent = await this.request('POST', '/payments/create-payment-intent', {
            amount: 9999,
            currency: 'usd'
        });
        console.log('Create Payment Intent Result:', createIntent);

        if (createIntent.success) {
            const paymentIntentId = createIntent.data.paymentIntentId;

            // Confirm Payment
            console.log('\nTesting Confirm Payment...');
            const confirmResult = await this.request('POST', '/payments/confirm-payment', {
                paymentIntentId
            });
            console.log('Confirm Payment Result:', confirmResult);

            // Get Payment Methods
            console.log('\nTesting Get Payment Methods...');
            const getMethodsResult = await this.request('GET', '/payments/payment-methods');
            console.log('Get Payment Methods Result:', getMethodsResult);

            // Add Payment Method
            console.log('\nTesting Add Payment Method...');
            const addMethodResult = await this.request('POST', '/payments/payment-methods', {
                type: 'card',
                card: {
                    number: '4242424242424242',
                    exp_month: 12,
                    exp_year: 2024,
                    cvc: '123'
                }
            });
            console.log('Add Payment Method Result:', addMethodResult);
        }
    }

    async runAllTests() {
        try {
            console.log('Starting MarketMate API Tests...');

            await this.testAuth();
            await this.testProducts();
            await this.testCart();
            await this.testOrders();
            await this.testShipments();
            await this.testPayments();

            console.log('\nAll tests completed!');
        } catch (error) {
            console.error('Test suite error:', error);
        }
    }
}

// Create instance and run tests
const tester = new MarketMateApiTester();
tester.runAllTests();