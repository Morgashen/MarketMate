const express = require('express');

const { registerUser, loginUser, logoutUser } = require('../controllers/authController');
const { setUser } = require("../middlewares/authMiddleware");

const router = express.Router();

router.route('/register').post(registerUser);
router.route('/login').post(loginUser);
router.route('/logout').post(setUser, logoutUser);

module.exports = router;
