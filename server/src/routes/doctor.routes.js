const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { cacheMiddleware, invalidateCache } = require('../utils/cache');
const roleMiddleware = require('../middlewares/role.middleware');

// Credential alerts endpoint
router.get('/credential-alerts',
  authMiddleware,
  doctorController.getCredentialAlerts
);

// Cache doctors list for 5 minutes
router.get('/', 
  authMiddleware, 
  cacheMiddleware(300, 'doctors'),
  doctorController.getDoctors
);

// Create new doctor
router.post('/', 
  authMiddleware,
  async (req, res, next) => {
    await invalidateCache('cache:doctors:*');
    next();
  },
  doctorController.createDoctor
);

// Update doctor profile / credentials
router.put('/:id', 
  authMiddleware,
  async (req, res, next) => {
    await invalidateCache('cache:doctors:*');
    next();
  },
  doctorController.updateDoctor
);

// Toggle doctor active status
router.patch('/:id/toggle-status', authMiddleware, roleMiddleware(['SUPERADMIN', 'ADMINISTRATIVE', 'HOSPITAL_ADMIN']), async (req, res, next) => {
  await invalidateCache('cache:doctors:*');
  next();
}, doctorController.toggleDoctorStatus);

// Toggle subscription bypass (VIP Founder)
router.patch('/:id/toggle-bypass', authMiddleware, roleMiddleware(['SUPERADMIN']), async (req, res, next) => {
  await invalidateCache('cache:doctors:*');
  next();
}, doctorController.toggleDoctorBypass);

// Delete doctor
router.delete('/:id', authMiddleware, roleMiddleware(['SUPERADMIN']), async (req, res, next) => {
  await invalidateCache('cache:doctors:*');
  next();
}, doctorController.deleteDoctor);

module.exports = router;
