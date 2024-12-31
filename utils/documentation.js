// utils/documentation.js

const getApiInfo = (environment) => {
    return {
        title: 'MarketMate API Documentation',
        version: '1.0.0',
        environment,
        baseUrl: environment === 'production' ? 'https://api.marketmate.com' : 'http://localhost:5000',
        endpoints: {
            auth: {
                base: '/api/auth',
                routes: [
                    {
                        path: '/register',
                        method: 'POST',
                        description: 'Register a new user',
                        body: {
                            email: 'string (required)',
                            password: 'string (required)',
                            name: 'string (required)'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: { token: 'JWT Token' }
                            },
                            400: { message: 'Validation error details' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/login',
                        method: 'POST',
                        description: 'Authenticate user and get token',
                        body: {
                            email: 'string (required)',
                            password: 'string (required)'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: { token: 'JWT Token' }
                            },
                            401: { message: 'Invalid credentials' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/user',
                        method: 'GET',
                        description: 'Get current user information',
                        auth: true,
                        responses: {
                            200: {
                                success: true,
                                data: {
                                    id: 'string',
                                    name: 'string',
                                    email: 'string',
                                    createdAt: 'date'
                                }
                            },
                            401: { message: 'Not authorized' },
                            500: { message: 'Internal server error' }
                        }
                    }
                ]
            },
            products: {
                base: '/api/products',
                routes: [
                    {
                        path: '/',
                        method: 'GET',
                        description: 'Get all products with optional filtering',
                        query: {
                            page: 'number (pagination)',
                            limit: 'number (items per page)',
                            category: 'string (filter by category)',
                            search: 'string (search term)',
                            sort: 'string (sort field)',
                            order: 'string (asc/desc)'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: {
                                    products: 'array',
                                    total: 'number',
                                    page: 'number',
                                    pages: 'number'
                                }
                            },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/:id',
                        method: 'GET',
                        description: 'Get product by ID',
                        params: {
                            id: 'string (product ID)'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: {
                                    id: 'string',
                                    name: 'string',
                                    description: 'string',
                                    price: 'number',
                                    image: 'string',
                                    stock: 'number',
                                    category: 'string'
                                }
                            },
                            404: { message: 'Product not found' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/',
                        method: 'POST',
                        description: 'Create new product',
                        auth: true,
                        body: {
                            name: 'string (required)',
                            description: 'string (required)',
                            price: 'number (required)',
                            image: 'string (required)',
                            stock: 'number (required)',
                            category: 'string (required)'
                        },
                        responses: {
                            201: {
                                success: true,
                                data: 'Product object'
                            },
                            400: { message: 'Validation errors' },
                            401: { message: 'Not authorized' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/:id',
                        method: 'PUT',
                        description: 'Update product',
                        auth: true,
                        params: {
                            id: 'string (product ID)'
                        },
                        body: {
                            name: 'string',
                            description: 'string',
                            price: 'number',
                            image: 'string',
                            stock: 'number',
                            category: 'string'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: 'Updated product object'
                            },
                            400: { message: 'Validation errors' },
                            401: { message: 'Not authorized' },
                            404: { message: 'Product not found' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/:id',
                        method: 'DELETE',
                        description: 'Delete product',
                        auth: true,
                        params: {
                            id: 'string (product ID)'
                        },
                        responses: {
                            200: {
                                success: true,
                                message: 'Product deleted'
                            },
                            401: { message: 'Not authorized' },
                            404: { message: 'Product not found' },
                            500: { message: 'Internal server error' }
                        }
                    }
                ]
            },
            cart: {
                base: '/api/cart',
                routes: [
                    {
                        path: '/',
                        method: 'GET',
                        description: 'Get user\'s cart',
                        auth: true,
                        responses: {
                            200: {
                                success: true,
                                data: {
                                    items: 'array of cart items',
                                    total: 'number'
                                }
                            },
                            401: { message: 'Not authorized' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/',
                        method: 'POST',
                        description: 'Add item to cart',
                        auth: true,
                        body: {
                            productId: 'string (required)',
                            quantity: 'number (required)'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: 'Updated cart object'
                            },
                            400: { message: 'Validation errors' },
                            401: { message: 'Not authorized' },
                            404: { message: 'Product not found' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/:productId',
                        method: 'PUT',
                        description: 'Update cart item quantity',
                        auth: true,
                        params: {
                            productId: 'string (product ID)'
                        },
                        body: {
                            quantity: 'number (required)'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: 'Updated cart object'
                            },
                            400: { message: 'Validation errors' },
                            401: { message: 'Not authorized' },
                            404: { message: 'Product not found' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/:productId',
                        method: 'DELETE',
                        description: 'Remove item from cart',
                        auth: true,
                        params: {
                            productId: 'string (product ID)'
                        },
                        responses: {
                            200: {
                                success: true,
                                message: 'Item removed from cart'
                            },
                            401: { message: 'Not authorized' },
                            404: { message: 'Product not found' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/clear',
                        method: 'DELETE',
                        description: 'Clear entire cart',
                        auth: true,
                        responses: {
                            200: {
                                success: true,
                                message: 'Cart cleared'
                            },
                            401: { message: 'Not authorized' },
                            500: { message: 'Internal server error' }
                        }
                    }
                ]
            },
            orders: {
                base: '/api/orders',
                routes: [
                    {
                        path: '/',
                        method: 'GET',
                        description: 'Get user\'s orders',
                        auth: true,
                        query: {
                            page: 'number',
                            limit: 'number',
                            status: 'string'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: {
                                    orders: 'array of orders',
                                    total: 'number',
                                    page: 'number',
                                    pages: 'number'
                                }
                            },
                            401: { message: 'Not authorized' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/:id',
                        method: 'GET',
                        description: 'Get order by ID',
                        auth: true,
                        params: {
                            id: 'string (order ID)'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: 'Order object'
                            },
                            401: { message: 'Not authorized' },
                            404: { message: 'Order not found' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/',
                        method: 'POST',
                        description: 'Create new order',
                        auth: true,
                        body: {
                            shippingAddress: {
                                street: 'string (required)',
                                city: 'string (required)',
                                state: 'string (required)',
                                zipCode: 'string (required)',
                                country: 'string (required)'
                            }
                        },
                        responses: {
                            201: {
                                success: true,
                                data: 'Created order object'
                            },
                            400: { message: 'Validation errors' },
                            401: { message: 'Not authorized' },
                            500: { message: 'Internal server error' }
                        }
                    }
                ]
            },
            shipments: {
                base: '/api/shipments',
                routes: [
                    {
                        path: '/',
                        method: 'GET',
                        description: 'Get shipments for user\'s orders',
                        auth: true,
                        query: {
                            orderId: 'string',
                            status: 'string'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: 'Array of shipments'
                            },
                            401: { message: 'Not authorized' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/:id',
                        method: 'GET',
                        description: 'Get shipment by ID',
                        auth: true,
                        params: {
                            id: 'string (shipment ID)'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: 'Shipment object'
                            },
                            401: { message: 'Not authorized' },
                            404: { message: 'Shipment not found' },
                            500: { message: 'Internal server error' }
                        }
                    }
                ]
            },
            payments: {
                base: '/api/payments',
                routes: [
                    {
                        path: '/create-intent',
                        method: 'POST',
                        description: 'Create payment intent',
                        auth: true,
                        body: {
                            amount: 'number (required)',
                            currency: 'string (required)',
                            orderId: 'string (required)'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: {
                                    clientSecret: 'string',
                                    paymentIntentId: 'string'
                                }
                            },
                            400: { message: 'Validation errors' },
                            401: { message: 'Not authorized' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/confirm-payment',
                        method: 'POST',
                        description: 'Confirm payment',
                        auth: true,
                        body: {
                            paymentIntentId: 'string (required)',
                            orderId: 'string (required)'
                        },
                        responses: {
                            200: {
                                success: true,
                                message: 'Payment confirmed'
                            },
                            400: { message: 'Validation errors' },
                            401: { message: 'Not authorized' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/payment-methods',
                        method: 'GET',
                        description: 'Get user\'s saved payment methods',
                        auth: true,
                        responses: {
                            200: {
                                success: true,
                                data: 'Array of payment methods'
                            },
                            401: { message: 'Not authorized' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/payment-methods',
                        method: 'POST',
                        description: 'Add new payment method',
                        auth: true,
                        body: {
                            paymentMethodId: 'string (required)',
                            isDefault: 'boolean'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: 'Payment method object'
                            },
                            400: { message: 'Validation errors' },
                            401: { message: 'Not authorized' },
                            500: { message: 'Internal server error' }
                        }
                    }
                ]
            }
        }
    };
};

const renderApiDocumentation = (apiInfo) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${apiInfo.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            color: #333;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            border-bottom: 2px solid #eee;
            margin-bottom: 30px;
            padding-bottom: 20px;
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        h2 {
            font-size: 1.8em;
            margin-top: 40px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        .endpoint {
            background: #f8f9fa;
            padding: 20px;
            margin: 15px 0;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }
        .method {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            min-width: 80px;
            text-align: center;
            margin-right: 10px;
        }
        .method.get { background-color: #2ecc71; }
        .method.post { background-color: #3498db; }
        .method.put { background-color: #f1c40f; }
        .method.delete { background-color: #e74c3c; }
        .path {
            font-family: monospace;
            font-size: 1.1em;
            color: #34495e;
        }
        .auth-badge {
            background-color: #95a5a6;
            color: white;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 0.9em;
            margin-left: 10px;
            vertical-align: middle;
        }
        .description {
            margin: 10px 0;
            color: #666;
        }
        .params-title {
            font-weight: bold;
            margin: 15px 0 5px 0;
            color: #2c3e50;
        }
        code {
            background: #ecf0f1;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
        }
        pre {
            background: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        .response {
            margin: 10px 0;
            padding: 10px;
            background: #f8f9fa;
            border-left: 4px solid;
        }
        .response.success { border-color: #2ecc71; }
        .response.error { border-color: #e74c3c; }
        .navigation {
            position: fixed;
            top: 20px;
            bottom: 20px;
            left: 20px;
            width: 250px;
            overflow-y: auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .content {
            margin-left: 290px;
        }
        @media (max-width: 1200px) {
            .navigation {
                display: none;
            }
            .content {
                margin-left: 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${apiInfo.title}</h1>
            <p>Version: ${apiInfo.version}</p>
            <p>Environment: ${apiInfo.environment}</p>
            <p>Base URL: ${apiInfo.baseUrl}</p>
        </div>

        <nav class="navigation">
            <h3>Quick Navigation</h3>
            ${Object.keys(apiInfo.endpoints).map(category => `
                <p><a href="#${category}">${category.charAt(0).toUpperCase() + category.slice(1)}</a></p>
            `).join('')}
        </nav>

        <div class="content">
            ${Object.entries(apiInfo.endpoints).map(([category, info]) => `
                <section id="${category}">
                    <h2>${category.charAt(0).toUpperCase() + category.slice(1)} Endpoints</h2>
                    ${info.routes.map(route => `
                        <div class="endpoint">
                            <div>
                                <span class="method ${route.method.toLowerCase()}">${route.method}</span>
                                <span class="path">${info.base}${route.path}</span>
                                ${route.auth ? '<span class="auth-badge">Requires Authentication</span>' : ''}
                            </div>
                            
                            <div class="description">${route.description}</div>

                            ${route.params ? `
                                <div class="params-title">Path Parameters:</div>
                                <pre><code>${JSON.stringify(route.params, null, 2)}</code></pre>
                            ` : ''}

                            ${route.query ? `
                                <div class="params-title">Query Parameters:</div>
                                <pre><code>${JSON.stringify(route.query, null, 2)}</code></pre>
                            ` : ''}

                            ${route.body ? `
                                <div class="params-title">Request Body:</div>
                                <pre><code>${JSON.stringify(route.body, null, 2)}</code></pre>
                            ` : ''}

                            <div class="params-title">Responses:</div>
                            ${Object.entries(route.responses).map(([code, response]) => `
                                <div class="response ${code.startsWith('2') ? 'success' : 'error'}">
                                    <strong>Status: ${code}</strong>
                                    <pre><code>${JSON.stringify(response, null, 2)}</code></pre>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </section>
            `).join('')}
        </div>
    </div>

    <script>
        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });
    </script>
</body>
</html>
    `;
};

module.exports = {
    getApiInfo,
    renderApiDocumentation
};