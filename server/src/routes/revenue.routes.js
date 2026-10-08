'use strict';

/**
 * 🛣️ Revenue Intelligence Routes
 * Protected endpoints for financial analytics, cashflow, and doctor payouts liabilities.
 */

const express = require('express');
const router = express.Router();
const revenueController = require('../controllers/revenueIntelligence.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

router.get('/analytics', authMiddleware, authorize('revenue:read'), revenueController.getRevenueAnalytics);
router.get('/trends', authMiddleware, authorize('revenue:read'), revenueController.getRevenueTrends);
router.get('/payouts-liability', authMiddleware, authorize('revenue:read'), revenueController.getDoctorPayoutsLiability);
router.get('/export', authMiddleware, authorize('revenue:export'), revenueController.exportRevenueReport);

module.exports = router;
