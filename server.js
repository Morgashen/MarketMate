require('dotenv').config();
const express = require('express');
const config = require('config');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');

// Initialize Express application
const app = express();

// Environment configuration
const environment = process.env.NODE_ENV || 'development';
console.log(`Application environment: ${environment}`);

// Connect to Database if not in test environment
if (environment !== 'test') {
    connectDB();
}

// Security Middleware
app.use(helmet());

// CORS configuration based on environment
const corsOptions = {
    origin: environment === 'production' ? config.get('allowedOrigins') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
};
app.use(cors(corsOptions));

// Request parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging configuration based on environment
if (environment === 'development') {
    app.use(morgan('dev'));
} else if (environment === 'production') {
    app.use(morgan('combined'));
}

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/payments', require('./routes/payments'));

// API Documentation Route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to MarketMate API',
        version: '1.0.0',
        environment,
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                getUser: 'GET /api/auth/user'
            },
            products: {
                getAllProducts: 'GET /api/products',
                getProduct: 'GET /api/products/:id',
                createProduct: 'POST /api/products',
                updateProduct: 'PUT /api/products/:id',
                deleteProduct: 'DELETE /api/products/:id'
            },
            cart: {
                getCart: 'GET /api/cart',
                addToCart: 'POST /api/cart',
                updateCart: 'PUT /api/cart/:productId',
                removeFromCart: 'DELETE /api/cart/:productId'
            },
            orders: {
                getAllOrders: 'GET /api/orders',
                getOrder: 'GET /api/orders/:id',
                createOrder: 'POST /api/orders',
                updateOrderStatus: 'PATCH /api/orders/:id/status'
            },
            shipments: {
                createShipment: 'POST /api/shipments',
                updateShipment: 'PATCH /api/shipments/:id',
                getShipment: 'GET /api/shipments/:id',
                getShipments: 'GET /api/shipments'
            },
            payments: {
                createPaymentIntent: 'POST /api/payments/create-payment-intent',
                confirmPayment: 'POST /api/payments/confirm-payment',
                getPaymentMethods: 'GET /api/payments/payment-methods',
                addPaymentMethod: 'POST /api/payments/payment-methods'
            }
        }
    });
});

// Error Handling Middleware
app.use((req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;

    if (environment === 'development') {
        console.error(err.stack);
        res.status(statusCode).json({
            message: err.message,
            stack: err.stack,
            error: err
        });
    } else {
        res.status(statusCode).json({
            message: statusCode === 500 ? 'Internal Server Error' : err.message
        });
    }
});

// Server Initialization
let server;
if (environment !== 'test') {
    const PORT = process.env.PORT || 5000;
    server = app.listen(PORT, () => {
        console.log(`Server running in ${environment} mode on port ${PORT}`);
        console.log(`API Documentation available at http://localhost:${PORT}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
        console.error('Unhandled Promise Rejection:', err);
        server.close(() => process.exit(1));
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
        console.log('SIGTERM received. Shutting down gracefully...');
        server.close(() => {
            console.log('Process terminated.');
            process.exit(0);
        });
    });
}

module.exports = { app, server };