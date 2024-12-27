/**
 * Generates comprehensive API documentation information based on the current environment
 * @param {string} environment - The current server environment (development, production, test)
 * @returns {Object} Detailed API documentation object
 */
const getApiInfo = (environment) => {
    return {
        name: 'MarketMate API',
        version: '1.0.0',
        description: 'E-commerce platform REST API',
        environment: environment,
        endpoints: {
            auth: {
                register: 'POST /register',
                login: 'POST /login',
                getUser: 'GET /user'
            },
            products: {
                getAllProducts: 'GET /',
                getProduct: 'GET /:id',
                createProduct: 'POST /',
                updateProduct: 'PUT /:id',
                deleteProduct: 'DELETE /:id'
            },
            cart: {
                getCart: 'GET /',
                addToCart: 'POST /',
                updateCart: 'PUT /:productId',
                removeFromCart: 'DELETE /:productId'
            },
            orders: {
                getAllOrders: 'GET /',
                getOrder: 'GET /:id',
                createOrder: 'POST /',
                updateOrderStatus: 'PATCH /:id/status'
            },
            shipments: {
                createShipment: 'POST /',
                updateShipment: 'PATCH /:id',
                getShipment: 'GET /:id',
                getShipments: 'GET /'
            },
            payments: {
                createPaymentIntent: 'POST /create-payment-intent',
                confirmPayment: 'POST /confirm-payment',
                getPaymentMethods: 'GET /payment-methods',
                addPaymentMethod: 'POST /payment-methods'
            }
        }
    };
};

// Explicitly export the function
module.exports = getApiInfo;