const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { cacheMiddleware, invalidateCache } = require('../utils/cache');
const { authorize } = require('../middlewares/authorization.middleware');

// Credential alerts endpoint
router.get('/credential-alerts',
  authMiddleware,
  authorize('doctors:read'),
  doctorController.getCredentialAlerts
);

// Cache doctors list for 5 minutes
router.get('/', 
  authMiddleware, 
  authorize('doctors:read'),
  cacheMiddleware(300, 'doctors'),
  doctorController.getDoctors
);

// Create new doctor
router.post('/', 
  authMiddleware,
  authorize('doctors:write'),
  async (req, res, next) => {
    await invalidateCache('cache:doctors:*');
    next();
  },
  doctorController.createDoctor
);

// Update doctor profile / credentials
router.put('/:id', 
  authMiddleware,
  authorize('doctors:write'),
  async (req, res, next) => {
    await invalidateCache('cache:doctors:*');
    next();
  },
  doctorController.updateDoctor
);

// Toggle doctor active status
router.patch('/:id/toggle-status', authMiddleware, authorize('doctors:write'), async (req, res, next) => {
  await invalidateCache('cache:doctors:*');
  next();
}, doctorController.toggleDoctorStatus);

// Toggle subscription bypass (VIP Founder)
router.patch('/:id/toggle-bypass', authMiddleware, authorize('doctors:delete'), async (req, res, next) => {
  await invalidateCache('cache:doctors:*');
  next();
}, doctorController.toggleDoctorBypass);

// Delete doctor
router.delete('/:id', authMiddleware, authorize('doctors:delete'), async (req, res, next) => {
  await invalidateCache('cache:doctors:*');
  next();
}, doctorController.deleteDoctor);

module.exports = router;
