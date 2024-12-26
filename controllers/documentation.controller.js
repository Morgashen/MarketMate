const { renderApiDocumentation } = require('../views/documentation');

class DocumentationController {
    /**
     * Generates API information object containing all endpoint details
     * @param {Object} app - Express application instance
     * @returns {Object} API information object
     */
    static generateApiInfo(app) {
        return {
            name: 'MarketMate API',
            version: app.locals.version,
            description: 'Welcome to the MarketMate e-commerce platform API',
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString(),
            endpoints: {
                authentication: {
                    base: '/api/auth',
                    routes: [
                        {
                            path: '/register',
                            method: 'POST',
                            description: 'Register a new user',
                            body: {
                                email: 'string',
                                password: 'string',
                                name: 'string'
                            }
                        },
                        {
                            path: '/login',
                            method: 'POST',
                            description: 'Authenticate user and get token',
                            body: {
                                email: 'string',
                                password: 'string'
                            }
                        },
                        {
                            path: '/profile',
                            method: 'GET',
                            description: 'Get user profile (requires authentication)'
                        }
                    ]
                },
                products: {
                    base: '/api/products',
                    routes: [
                        {
                            path: '/',
                            method: 'GET',
                            description: 'List all products',
                            query: {
                                category: 'string (optional)',
                                minPrice: 'number (optional)',
                                maxPrice: 'number (optional)',
                                search: 'string (optional)'
                            }
                        },
                        {
                            path: '/:id',
                            method: 'GET',
                            description: 'Get product details'
                        },
                        {
                            path: '/',
                            method: 'POST',
                            description: 'Create new product (requires authentication)',
                            body: {
                                name: 'string',
                                description: 'string',
                                price: 'number',
                                imageUrl: 'string',
                                stock: 'number',
                                category: 'string'
                            }
                        },
                        {
                            path: '/:id',
                            method: 'PUT',
                            description: 'Update product (requires authentication)'
                        }
                    ]
                },
                orders: {
                    base: '/api/orders',
                    routes: [
                        {
                            path: '/',
                            method: 'POST',
                            description: 'Create new order (requires authentication)',
                            body: {
                                items: 'array of { productId: string, quantity: number }',
                                shippingAddress: 'object'
                            }
                        },
                        {
                            path: '/history',
                            method: 'GET',
                            description: 'Get order history (requires authentication)'
                        }
                    ]
                }
            },
            documentation: {
                description: 'For detailed API documentation and usage examples, please refer to the MarketMate API documentation',
                healthCheck: '/health',
                connectionTest: '/api/test-db-connection'
            }
        };
    }

    /**
     * Handles requests to the API root
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static handleApiRoot(req, res) {
        const apiInfo = DocumentationController.generateApiInfo(req.app);

        res.format({
            'text/html': () => {
                const html = renderApiDocumentation(apiInfo);
                res.send(html);
            },
            'application/json': () => {
                res.json(apiInfo);
            },
            default: () => {
                res.json(apiInfo);
            }
        });
    }
}

module.exports = DocumentationController;