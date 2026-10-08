const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

router.get('/', authMiddleware, authorize('staff:read'), staffController.getStaff);
router.delete('/:id', authMiddleware, authorize('staff:delete'), staffController.deleteStaff);

module.exports = router;
