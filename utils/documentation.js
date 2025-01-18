// Get API information based on environment
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
                            201: {
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
                    },
                    {
                        path: '/:id',
                        method: 'PUT',
                        description: 'Update order status',
                        auth: true,
                        params: {
                            id: 'string (order ID)'
                        },
                        body: {
                            status: 'string (required)',
                            trackingNumber: 'string',
                            notes: 'string'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: 'Updated order object'
                            },
                            400: { message: 'Validation errors' },
                            401: { message: 'Not authorized' },
                            404: { message: 'Order not found' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/:id',
                        method: 'DELETE',
                        description: 'Cancel order',
                        auth: true,
                        params: {
                            id: 'string (order ID)'
                        },
                        responses: {
                            200: {
                                success: true,
                                message: 'Order cancelled'
                            },
                            400: { message: 'Order cannot be cancelled' },
                            401: { message: 'Not authorized' },
                            404: { message: 'Order not found' },
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
                    },
                    {
                        path: '/:id',
                        method: 'PUT',
                        description: 'Update shipment status',
                        auth: true,
                        params: {
                            id: 'string (shipment ID)'
                        },
                        body: {
                            status: 'string (required)',
                            trackingNumber: 'string',
                            carrier: 'string',
                            estimatedDelivery: 'date'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: 'Updated shipment object'
                            },
                            400: { message: 'Validation errors' },
                            401: { message: 'Not authorized' },
                            404: { message: 'Shipment not found' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/:id',
                        method: 'DELETE',
                        description: 'Cancel shipment',
                        auth: true,
                        params: {
                            id: 'string (shipment ID)'
                        },
                        responses: {
                            200: {
                                success: true,
                                message: 'Shipment cancelled'
                            },
                            400: { message: 'Shipment cannot be cancelled' },
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
                    },
                    {
                        path: '/payment-methods/:id',
                        method: 'PUT',
                        description: 'Update payment method',
                        auth: true,
                        params: {
                            id: 'string (payment method ID)'
                        },
                        body: {
                            isDefault: 'boolean',
                            expirationDate: 'string',
                            billingAddress: 'object'
                        },
                        responses: {
                            200: {
                                success: true,
                                data: 'Updated payment method object'
                            },
                            400: { message: 'Validation errors' },
                            401: { message: 'Not authorized' },
                            404: { message: 'Payment method not found' },
                            500: { message: 'Internal server error' }
                        }
                    },
                    {
                        path: '/payment-methods/:id',
                        method: 'DELETE',
                        description: 'Remove payment method',
                        auth: true,
                        params: {
                            id: 'string (payment method ID)'
                        },
                        responses: {
                            200: {
                                success: true,
                                message: 'Payment method removed'
                            },
                            401: { message: 'Not authorized' },
                            404: { message: 'Payment method not found' },
                            500: { message: 'Internal server error' }
                        }
                    }
                ]
            }
        }
    };
};

// Renders comprehensive API documentation with clean styling
const renderApiDocumentation = (apiInfo) => {
    const renderEndpoint = (route, baseUrl) => {
        return `
            <div class="endpoint">
                <div class="endpoint-header">
                    <span class="method ${route.method.toLowerCase()}">${route.method}</span>
                    <code class="path">${baseUrl}${route.path}</code>
                    ${route.auth ? '<span class="auth-tag">Auth Required</span>' : ''}
                </div>
                
                <p class="description">${route.description}</p>
                
                ${route.params ? `
                    <div class="section">
                        <h4>Path Parameters</h4>
                        <code class="block">${JSON.stringify(route.params, null, 2)}</code>
                    </div>
                ` : ''}

                ${route.query ? `
                    <div class="section">
                        <h4>Query Parameters</h4>
                        <code class="block">${JSON.stringify(route.query, null, 2)}</code>
                    </div>
                ` : ''}

                ${route.body ? `
                    <div class="section">
                        <h4>Request Body</h4>
                        <code class="block">${JSON.stringify(route.body, null, 2)}</code>
                    </div>
                ` : ''}

                <div class="section">
                    <h4>Responses</h4>
                    ${Object.entries(route.responses).map(([code, response]) => `
                        <div class="response ${parseInt(code) < 400 ? 'success' : 'error'}">
                            <div class="response-code">Status ${code}</div>
                            <code class="block">${JSON.stringify(response, null, 2)}</code>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${apiInfo.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.5;
            margin: 0;
            padding: 20px;
            color: #2c3e50;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        header {
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        h1, h2, h3, h4 {
            font-weight: 600;
            color: #1a202c;
        }
        
        .endpoint {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
        }
        
        .endpoint-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }
        
        .method {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 600;
            border: 1px solid;
            min-width: 60px;
            text-align: center;
        }
        
        .get { color: #2f855a; border-color: currentColor; }
        .post { color: #2b6cb0; border-color: currentColor; }
        .put { color: #975a16; border-color: currentColor; }
        .delete { color: #c53030; border-color: currentColor; }
        .patch { color: #2c7a7b; border-color: currentColor; }
        
        .path {
            font-family: 'SFMono-Regular', Consolas, monospace;
            font-size: 14px;
            padding: 4px 8px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
        }
        
        .auth-tag {
            font-size: 12px;
            color: #718096;
            border: 1px solid currentColor;
            padding: 2px 6px;
            border-radius: 4px;
        }
        
        .description {
            color: #4a5568;
            margin: 12px 0;
        }
        
        .section {
            margin: 20px 0;
        }
        
        .section h4 {
            margin: 0 0 8px 0;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #718096;
        }
        
        code.block {
            display: block;
            background: none;
            border: 1px solid #e2e8f0;
            padding: 12px;
            border-radius: 4px;
            font-family: 'SFMono-Regular', Consolas, monospace;
            font-size: 13px;
            white-space: pre;
            overflow-x: auto;
        }
        
        .response {
            margin: 12px 0;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
        }
        
        .response-code {
            padding: 8px 12px;
            font-size: 13px;
            font-weight: 600;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .success .response-code { color: #2f855a; }
        .error .response-code { color: #c53030; }

        @media (max-width: 768px) {
            .endpoint-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }
            
            code.block {
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>${apiInfo.title}</h1>
            <p>Version: ${apiInfo.version} | Environment: ${apiInfo.environment}</p>
            <p>Base URL: ${apiInfo.baseUrl}</p>
        </header>

        <main>
            ${Object.entries(apiInfo.endpoints).map(([category, info]) => `
                <section id="${category}">
                    <h2>${category.charAt(0).toUpperCase() + category.slice(1)}</h2>
                    ${info.routes.map(route => renderEndpoint(route, info.base)).join('')}
                </section>
            `).join('')}
        </main>
    </div>
</body>
</html>
    `;
};

module.exports = {
    getApiInfo,
    renderApiDocumentation
};