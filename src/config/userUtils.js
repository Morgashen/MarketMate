const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const redisClient = require('./redisClient');
const { v4: uuidv4 } = require('uuid');

// Constants
const SALT_ROUNDS = 12; // Increased from 10 for better security
const TOKEN_EXPIRY = '1d';
const COOKIE_NAME = 'Z-Token';
const SESSION_COOKIE_NAME = 'session-id';
const COOKIE_MAX_AGE = 24 * 3600 * 1000; // 1 day in milliseconds

/**
 * Hash a password using bcrypt
 * @param {string} password - The plain text password to hash
 * @returns {Promise<string>} The hashed password
 * @throws {Error} If password is invalid or hashing fails
 */
const hashPassword = async (password) => {
    if (!password || typeof password !== 'string') {
        throw new Error('Invalid password provided');
    }

    try {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        return await bcrypt.hash(password, salt);
    } catch (error) {
        throw new Error(`Password hashing failed: ${error.message}`);
    }
};

/**
 * Verify a password against its hash
 * @param {string} password - The plain text password to verify
 * @param {string} storedHash - The stored hash to compare against
 * @returns {Promise<boolean>} True if password matches, false otherwise
 * @throws {Error} If inputs are invalid or comparison fails
 */
const verifyPassword = async (password, storedHash) => {
    if (!password || !storedHash) {
        throw new Error('Password and hash are required');
    }

    try {
        return await bcrypt.compare(password, storedHash);
    } catch (error) {
        throw new Error(`Password verification failed: ${error.message}`);
    }
};

/**
 * Generate a JWT token
 * @param {string} userId - The user ID to encode in the token
 * @param {Object} additionalClaims - Optional additional claims to include in the token
 * @returns {string} The generated JWT token
 * @throws {Error} If token generation fails
 */
const generateToken = (userId, additionalClaims = {}) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
    }

    try {
        return jwt.sign(
            {
                userId,
                ...additionalClaims,
                iat: Math.floor(Date.now() / 1000)
            },
            process.env.JWT_SECRET,
            {
                expiresIn: TOKEN_EXPIRY,
                algorithm: 'HS256'
            }
        );
    } catch (error) {
        throw new Error(`Token generation failed: ${error.message}`);
    }
};

/**
 * Cache user details in Redis
 * @param {string} token - The token to use as key
 * @param {Object} user - The user object to cache
 * @throws {Error} If caching fails
 */
const cacheToken = async (token, user) => {
    if (!token || !user) {
        throw new Error('Token and user object are required');
    }

    const userDetails = {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        lastAccess: new Date().toISOString()
    };

    try {
        await redisClient.setValue(
            `auth:${token}`,
            JSON.stringify(userDetails),
            COOKIE_MAX_AGE
        );
    } catch (error) {
        throw new Error(`Failed to cache token: ${error.message}`);
    }
};

/**
 * Configure and send an email
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.message - Email message
 * @throws {Error} If email sending fails
 */
const sendEmail = async (options) => {
    const requiredEnvVars = [
        'EMAIL_SERVICE',
        'EMAIL_PORT',
        'EMAIL_USERNAME',
        'EMAIL_PASSWORD',
        'FROM_NAME',
        'FROM_EMAIL'
    ];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    }

    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SERVICE,
        port: parseInt(process.env.EMAIL_PORT, 10),
        secure: process.env.EMAIL_PORT === '465',
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
        },
        tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
    });

    const message = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
    };

    try {
        await transporter.sendMail(message);
    } catch (error) {
        throw new Error(`Failed to send email: ${error.message}`);
    }
};

/**
 * Set authentication cookie
 * @param {Object} response - Express response object
 * @param {string} token - Token to store in cookie
 * @returns {Object} Response object with cookie set
 */
const storeCookie = (response, token) => {
    if (!token) {
        throw new Error('Token is required');
    }

    return response.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: COOKIE_MAX_AGE,
        path: '/'
    });
};

/**
 * Handle session ID for unauthenticated users
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @param {Function} next - Express next middleware function
 */
const checkSessionId = (request, response, next) => {
    // Skip for authentication routes
    if (request.path.startsWith('/api/auth')) {
        return next();
    }

    if (!request.user) {
        const existingSessionId = request.cookies[SESSION_COOKIE_NAME];

        if (!existingSessionId) {
            const sessionId = uuidv4();
            response.cookie(SESSION_COOKIE_NAME, sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: COOKIE_MAX_AGE,
                path: '/'
            });
            request.sessionId = sessionId;
        } else {
            request.sessionId = existingSessionId;
        }
    }

    next();
};

/**
 * Get user ID or session ID
 * @param {Object} request - Express request object
 * @returns {string} User ID or session ID
 */
const getUserOrSessionId = (request) => {
    if (request.user) {
        return request.user.id;
    }

    let sessionId = request.cookies[SESSION_COOKIE_NAME];
    if (!sessionId) {
        sessionId = uuidv4();
        request.cookies[SESSION_COOKIE_NAME] = sessionId;
    }

    return sessionId;
};

/**
 * Validate JWT token
 * @param {string} token - JWT token to validate
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or verification fails
 */
const validateToken = (token) => {
    if (!token) {
        throw new Error('Token is required');
    }

    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error(`Token validation failed: ${error.message}`);
    }
};

/**
 * Clear authentication data
 * @param {Object} response - Express response object
 * @param {string} token - Token to remove from cache
 */
const clearAuthData = async (response, token) => {
    try {
        if (token) {
            await redisClient.deleteKey(`auth:${token}`);
        }

        response.clearCookie(COOKIE_NAME);
        response.clearCookie(SESSION_COOKIE_NAME);
    } catch (error) {
        throw new Error(`Failed to clear auth data: ${error.message}`);
    }
};

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    validateToken,
    cacheToken,
    sendEmail,
    storeCookie,
    checkSessionId,
    getUserOrSessionId,
    clearAuthData,
    // Export constants for testing and configuration
    COOKIE_NAME,
    SESSION_COOKIE_NAME,
    COOKIE_MAX_AGE,
    TOKEN_EXPIRY
};