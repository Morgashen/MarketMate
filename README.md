# MarketMate E-commerce Backend

MarketMate is a robust e-commerce backend system built with Node.js and Express, designed to power modern online retail platforms. This system provides comprehensive functionality for managing products, orders, payments, and shipments, with built-in security features and thorough testing coverage.

## Features

Our backend system offers a complete suite of e-commerce functionalities that make it suitable for both small businesses and scalable enterprises:

### User Management and Authentication

The system implements secure user authentication using JWT tokens, with features including user registration, login, and profile management. All sensitive routes are protected using middleware authentication.

### Product Management

Merchants can manage their product catalog with features for creating, updating, and removing products. The system supports detailed product information, including pricing, inventory tracking, and categorization.

### Shopping Cart System

A flexible shopping cart system allows users to add products, update quantities, and manage their selections before proceeding to checkout. The cart system includes automatic inventory validation to prevent overselling.

### Order Processing

The order management system handles the complete order lifecycle, from creation through fulfillment. It includes:

- Order creation with inventory validation
- Payment processing integration with Stripe
- Order status tracking
- Order history and details retrieval

### Payment Integration

Secure payment processing is implemented through Stripe, supporting:

- Multiple payment methods
- Secure payment intent creation
- Payment confirmation handling
- Refund processing

### Shipping Management

The shipping system tracks order fulfillment and delivery with features for:

- Creating shipping records
- Updating shipping status
- Tracking information management
- Delivery confirmation

## Technical Stack

- **Runtime Environment**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Payment Processing**: Stripe API
- **Testing**: Jest with Supertest
- **Security**: Helmet.js for HTTP headers
- **API Documentation**: Built-in interactive documentation

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm (Node Package Manager)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/morgashen/marketmate.git
   cd marketmate
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables by creating a .env file:

   ```
   NODE_ENV=development
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/marketmate
   JWT_SECRET=your_jwt_secret_key
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Running Tests

Our test suite covers all major functionality. To run tests:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch
```

## API Documentation

When you start the server, visit http://localhost:5000 to see the interactive API documentation. The documentation includes all available endpoints, required parameters, and example responses.

### Core API Endpoints

The API is organized around the following main resources:

- **Authentication**: /api/auth

  - Register: POST /api/auth/register
  - Login: POST /api/auth/login
  - Get User Profile: GET /api/auth/user

- **Products**: /api/products

  - List Products: GET /api/products
  - Get Product: GET /api/products/:id
  - Create Product: POST /api/products
  - Update Product: PUT /api/products/:id
  - Delete Product: DELETE /api/products/:id

- **Cart**: /api/cart

  - View Cart: GET /api/cart
  - Add to Cart: POST /api/cart
  - Update Cart Item: PUT /api/cart/:productId
  - Remove from Cart: DELETE /api/cart/:productId

- **Orders**: /api/orders

  - Create Order: POST /api/orders
  - List Orders: GET /api/orders
  - Get Order Details: GET /api/orders/:id
  - Update Order Status: PATCH /api/orders/:id/status

- **Shipments**: /api/shipments
  - Create Shipment: POST /api/shipments
  - Update Shipment: PATCH /api/shipments/:id
  - Get Shipment Details: GET /api/shipments/:id

## Security

Security is a top priority in our implementation. We have implemented several security measures:

1. All passwords are hashed using bcrypt before storage
2. JWT authentication protects sensitive routes
3. Input validation and sanitization prevent injection attacks
4. CORS protection is configured based on environment
5. Secure HTTP headers are set using Helmet.js
6. Rate limiting prevents brute force attacks
7. Environment-specific security configurations

## Error Handling

The system implements comprehensive error handling with appropriate HTTP status codes and detailed error messages during development. In production, error details are appropriately sanitized to prevent information leakage.

## Contributing

We welcome contributions! Please read through our contributing guidelines before submitting pull requests to our project.

1. Fork the repository
2. Create your feature branch (git checkout -b feature/AmazingFeature)
3. Commit your changes (git commit -m 'Add some AmazingFeature')
4. Push to the branch (git push origin feature/AmazingFeature)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please email support@marketmate.com or open an issue in the GitHub repository.

## Acknowledgments

- Express.js team for the excellent web framework
- Stripe for secure payment processing
- MongoDB team for the robust database system
- All our contributors and supporters

## Project Status

MarketMate is under active development. We regularly add new features and welcome feature requests through our GitHub issues.
