'use strict';

/**
 * 🛣️ Patient Portal Routes
 * Self-service endpoints for patients with strict Anti-IDOR and least-privilege scoping.
 */

const express = require('express');
const router = express.Router();
const portalController = require('../controllers/patientPortal.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

// Profile & Demographics
router.get('/profile', authMiddleware, authorize('portal:read'), portalController.getProfile);
router.put('/profile', authMiddleware, authorize('portal:write'), portalController.updateProfile);

// Appointments Self-Management
router.get('/appointments', authMiddleware, authorize('portal:read'), portalController.getAppointments);
router.post('/appointments', authMiddleware, authorize('portal:write'), portalController.bookAppointment);
router.post('/appointments/:id/cancel', authMiddleware, authorize('portal:write'), portalController.cancelAppointment);

// Clinical Reports (Completed Results & Active Prescriptions)
router.get('/lab-results', authMiddleware, authorize('portal:read'), portalController.getLabResults);
router.get('/prescriptions', authMiddleware, authorize('portal:read'), portalController.getPrescriptions);

// Financial Receipts
router.get('/payments', authMiddleware, authorize('portal:read'), portalController.getPayments);

// Digital Health Passport
router.get('/health-card', authMiddleware, authorize('portal:read'), portalController.getHealthCard);

module.exports = router;
