const express = require('express');

const {sendForgotPasswordEmail, resetPassword} = require('../controllers/userController');

const router = express.Router();

router.post('/forgot-password', sendForgotPasswordEmail);
router.post('/reset-password/:token', resetPassword);

module.exports = router;
