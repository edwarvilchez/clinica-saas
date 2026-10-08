const express = require('express');
const router = express.Router();
const statsController = require('../controllers/stats.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { cacheMiddleware } = require('../utils/cache');

const { authorize } = require('../middlewares/authorization.middleware');

// Cache stats for 5 minutes (stats change frequently but not instantly)
router.get('/', authMiddleware, authorize('stats:read'), cacheMiddleware(300, 'stats'), statsController.getStats);

// Real-Time Operations Dashboard (Live, no stale cache)
router.get('/live-operations', authMiddleware, authorize('stats:read'), statsController.getLiveOperationsDashboard);

module.exports = router;
