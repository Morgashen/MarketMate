const notFoundHandler = (req, res, next) => {
    // Create a new error for not found routes
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.statusCode = 404;

    // Pass the error to the next error handling middleware
    next(error);
};

module.exports = notFoundHandler;