class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);
const handleValidationError = err => {
    const errors = Object.values(err.errors).map(el => el.message);
    return new AppError(`Invalid input data. ${errors.join('. ')}`, 400);
};
const handleDuplicateKeyError = err => {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    return new AppError(`Duplicate field value: ${value}. Please use another value.`, 400);
};

const errorHandler = (environment) => (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (environment === 'development') {
        // Development error response
        return res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    }

    // Production error handling
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'ValidationError') error = handleValidationError(error);
    if (error.code === 11000) error = handleDuplicateKeyError(error);

    // Operational, trusted error: send message to client
    if (error.isOperational) {
        return res.status(error.statusCode).json({
            status: error.status,
            message: error.message
        });
    }

    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥:', error);
    return res.status(500).json({
        status: 'error',
        message: 'Something went wrong'
    });
};

module.exports = {
    AppError,
    errorHandler
};