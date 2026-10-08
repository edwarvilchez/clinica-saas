'use strict';

/**
 * 🛣️ Omnichannel Communications & WhatsApp Routes
 * Protected endpoints for message dispatch, log inspection, analytics, and public webhook callbacks.
 */

const express = require('express');
const router = express.Router();
const communicationsController = require('../controllers/communications.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

// Public Webhook receiver for delivery status updates (Twilio, Meta, UltraMsg callbacks)
router.post('/webhook/:provider', communicationsController.handleWebhook);

// Protected Messaging Endpoints
router.post('/send', authMiddleware, authorize('communications:write'), communicationsController.sendMessage);
router.get('/logs', authMiddleware, authorize('communications:read'), communicationsController.getLogs);
router.get('/stats', authMiddleware, authorize('communications:read'), communicationsController.getStats);

module.exports = router;
