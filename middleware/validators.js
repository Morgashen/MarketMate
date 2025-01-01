const { validationResult, check } = require('express-validator');

/**
 * Middleware to validate request payload using express-validator
 * @param {Array} validations - Array of validation rules
 * @returns {Function} Middleware function
 */
const validate = (validations) => {
    return async (req, res, next) => {
        // Execute all validations
        await Promise.all(validations.map((validation) => validation.run(req)));

        // Collect validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Proceed to the next middleware or route handler
        next();
    };
};

/**
 * Validation rules for user registration
 */
const registerValidation = [
    check('name')
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 3 })
        .withMessage('Name must be at least 3 characters long'),
    check('email')
        .isEmail()
        .withMessage('Please include a valid email'),
    check('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
];

/**
 * Validation rules for user login
 */
const loginValidation = [
    check('email')
        .isEmail()
        .withMessage('Please include a valid email'),
    check('password')
        .notEmpty()
        .withMessage('Password is required'),
];

/**
 * Validation rules for shipment creation
 */
const shipmentValidation = [
    check('orderId')
        .notEmpty()
        .withMessage('Order ID is required'),
    check('carrier')
        .isIn(['USPS', 'FedEx', 'UPS', 'DHL'])
        .withMessage('Invalid carrier. Allowed values are USPS, FedEx, UPS, or DHL'),
    check('trackingNumber')
        .notEmpty()
        .withMessage('Tracking number is required'),
    check('shippingMethod')
        .isIn(['standard', 'express', 'overnight'])
        .withMessage('Invalid shipping method. Allowed values are standard, express, or overnight'),
];

module.exports = {
    validate,
    registerValidation,
    loginValidation,
    shipmentValidation,
};