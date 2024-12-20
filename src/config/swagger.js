const swaggerUi = require('swagger-ui-express');
const yaml = require('yamljs');
const path = require('path');
const fs = require('fs');

/**
 * Configuration options for Swagger UI
 */
const defaultOptions = {
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'API Documentation'
};

/**
 * Validates the Swagger/OpenAPI document
 * @param {Object} document - The loaded Swagger/OpenAPI document
 * @throws {Error} If the document is invalid
 */
const validateSwaggerDocument = (document) => {
    const requiredFields = ['openapi', 'info', 'paths'];

    for (const field of requiredFields) {
        if (!document[field]) {
            throw new Error(`Invalid Swagger document: missing required field '${field}'`);
        }
    }

    if (!document.info.title || !document.info.version) {
        throw new Error('Invalid Swagger document: info.title and info.version are required');
    }
};

/**
 * Loads and validates the Swagger/OpenAPI document
 * @param {string} docPath - Path to the Swagger/OpenAPI document
 * @returns {Object} Loaded and validated Swagger document
 * @throws {Error} If loading or validation fails
 */
const loadSwaggerDocument = (docPath) => {
    const absolutePath = path.resolve(docPath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Swagger document not found at path: ${absolutePath}`);
    }

    try {
        const document = yaml.load(absolutePath);
        validateSwaggerDocument(document);
        return document;
    } catch (error) {
        throw new Error(`Failed to load Swagger document: ${error.message}`);
    }
};

/**
 * Configures security definitions in the Swagger document
 * @param {Object} document - The Swagger document
 * @param {Object} securityConfig - Security configuration options
 * @returns {Object} Updated Swagger document
 */
const configureSwaggerSecurity = (document, securityConfig = {}) => {
    if (securityConfig.jwt) {
        document.components = document.components || {};
        document.components.securitySchemes = {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter your JWT token in the format: Bearer <token>'
            }
        };

        // Apply global security if specified
        if (securityConfig.globalSecurity) {
            document.security = [{ BearerAuth: [] }];
        }
    }

    return document;
};

/**
 * Sets up rate limiting for the documentation endpoint
 * @param {Object} app - Express application instance
 * @param {string} path - Documentation endpoint path
 * @param {Object} rateLimitConfig - Rate limiting configuration
 */
const setupRateLimiting = (app, path, rateLimitConfig) => {
    if (rateLimitConfig && rateLimitConfig.enabled) {
        const rateLimit = require('express-rate-limit');

        const limiter = rateLimit({
            windowMs: rateLimitConfig.windowMs || 15 * 60 * 1000, // 15 minutes default
            max: rateLimitConfig.max || 100, // 100 requests per windowMs default
            message: 'Too many requests to the API documentation, please try again later.',
            standardHeaders: true,
            legacyHeaders: false
        });

        app.use(path, limiter);
    }
};

/**
 * Configures and sets up Swagger UI
 * @param {Object} app - Express application instance
 * @param {Object} config - Configuration options
 * @param {string} config.docPath - Path to the Swagger/OpenAPI document
 * @param {string} config.routePath - API documentation endpoint path
 * @param {Object} config.uiOptions - Custom Swagger UI options
 * @param {Object} config.security - Security configuration
 * @param {Object} config.rateLimit - Rate limiting configuration
 * @throws {Error} If setup fails
 */
const setupSwaggerDocs = (app, config = {}) => {
    const {
        docPath = './docs/swagger.yaml',
        routePath = '/api-docs',
        uiOptions = {},
        security = {},
        rateLimit = { enabled: false }
    } = config;

    try {
        // Load and validate Swagger document
        let swaggerDocument = loadSwaggerDocument(docPath);

        // Configure security if specified
        swaggerDocument = configureSwaggerSecurity(swaggerDocument, security);

        // Set up rate limiting if enabled
        setupRateLimiting(app, routePath, rateLimit);

        // Merge default options with custom options
        const swaggerUiOptions = {
            ...defaultOptions,
            ...uiOptions,
            swaggerOptions: {
                ...defaultOptions.swaggerOptions,
                ...(uiOptions.swaggerOptions || {})
            }
        };

        // Setup Swagger UI endpoint
        app.use(
            routePath,
            swaggerUi.serve,
            swaggerUi.setup(swaggerDocument, swaggerUiOptions)
        );

        console.log(`API Documentation available at: ${routePath}`);
    } catch (error) {
        console.error('Failed to setup Swagger documentation:', error.message);
        throw error;
    }
};

module.exports = setupSwaggerDocs;