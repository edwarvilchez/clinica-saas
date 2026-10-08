'use strict';

const express = require('express');
const router = express.Router();
const waitlistController = require('../controllers/waitlist.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

// Collection routes
router.get('/stats', authMiddleware, authorize('waitlist:read'), waitlistController.getWaitlistStats);
router.post('/auto-match', authMiddleware, authorize('waitlist:write'), waitlistController.autoMatchSlot);
router.get('/', authMiddleware, authorize('waitlist:read'), waitlistController.getWaitlist);
router.post('/', authMiddleware, authorize('waitlist:create'), waitlistController.addToWaitlist);

// Resource routes
router.get('/:id', authMiddleware, authorize('waitlist:read'), waitlistController.getWaitlistEntryById);
router.post('/:id/offer', authMiddleware, authorize('waitlist:write'), waitlistController.offerSlot);
router.post('/:id/accept', authMiddleware, authorize('waitlist:accept'), waitlistController.acceptOffer);
router.post('/:id/decline', authMiddleware, authorize('waitlist:accept'), waitlistController.declineOffer);

module.exports = router;
