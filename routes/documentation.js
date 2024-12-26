const express = require('express');
const router = express.Router();
const DocumentationController = require('../controllers/documentation.controller');

// Root route handler
router.get('/', DocumentationController.handleApiRoot);

module.exports = router;