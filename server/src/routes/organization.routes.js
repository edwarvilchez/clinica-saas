const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organization.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

router.get('/settings', authMiddleware, authorize('organizations:read'), organizationController.getSettings);
router.put('/settings', authMiddleware, authorize('organizations:write'), organizationController.updateSettings);

module.exports = router;
