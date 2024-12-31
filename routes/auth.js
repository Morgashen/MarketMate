const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
const auth = require('../middleware/auth');
const { validate, registerValidation, loginValidation } = require('../middleware/validation');
const User = require('../models/User');

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', validate(registerValidation), async (req, res) => {
    try {
        //add development logging
        if (process.env.NODE_ENV === 'development') {
            console.log('Registration attempt:', {
                path: req.path,
                originalUrl: req.originalUrl,
                body: { ...req.body, password: '[REDACTED]' }
            });
        }
        const { name, email, password } = req.body;

        // Update the user existence check
        let user = await User.findOne({ email }).exec();
        if (user) {
            return res.status(409).json({
                status: 'error',
                code: 'USER_EXISTS',
                message: 'A user with this email already exists'
            });
        }
        // Update the user existence check
        const salt = await bcrypt.genSalt(12);
        user = new User({
            name,
            email,
            password: await bcrypt.hash(password, salt)
        });

        await user.save();
        // upadate the JWT signing with more options
        const payload = {
            user: { id: user.id },
            iat: Date.now()

        };

        jwt.sign(
            payload,
            config.get('jwtSecret'),
            {
                expiresIn: '24h',
                algorithm: 'HS256',
                audience: config.get('jwtAudience'),
                issuer: config.get('jwtIssuer')
            },
            (err, token) => {
                if (err) {
                    console.error('JWT generation error:', err);
                    return res.stutus(500).json({
                        status: 'error',
                        code: 'JWT_GENERATIOM_FAILED',
                        message: 'failed to complete registration'
                    });
                }
                res.status(201).json({
                    status: 'success',
                    data: {
                        token,
                        user: {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            created: user.createdAt
                        }
                    }
                });
            }

        );
    } catch (err) {
        console.error('Registration error:', {
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
        res.status(500).json({
            status: 'error',
            code: 'REGISTRATION_FAILED',
            message: 'An unexpected error occurred during registration'
        });
    }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', validate(loginValidation), async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            config.get('jwtSecret'),
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/auth/user
// @desc    Get user data
// @access  Private
router.get('/user', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error('User fetch error:', err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;