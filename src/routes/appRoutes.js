const express = require('express');
const { getStats, getStatus } = require('../controllers/appConroller');

const router = express.Router();

router.get('/stats', getStats);
router.get('/status', getStatus);

module.exports = router;
