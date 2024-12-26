// Custom error class for validation errors
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.status = 400;
    }
}

// Custom error class for authentication errors
class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
        this.status = 401;
    }
}

// Custom error class for not found errors
class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.status = 404;
    }
}

// Export all error classes
module.exports = {
    ValidationError,
    AuthenticationError,
    NotFoundError
};