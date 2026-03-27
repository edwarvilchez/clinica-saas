const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organization.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.get('/settings', authMiddleware, organizationController.getSettings);
router.put('/settings', authMiddleware, roleMiddleware(['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN']), organizationController.updateSettings);

module.exports = router;
