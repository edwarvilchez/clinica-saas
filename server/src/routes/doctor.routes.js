const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { cacheMiddleware, invalidateCache } = require('../utils/cache');
const roleMiddleware = require('../middlewares/role.middleware');

// Cache doctors list for 5 minutes
router.get('/', 
  authMiddleware, 
  cacheMiddleware(300, 'doctors'),
  doctorController.getDoctors
);

router.patch('/:id/toggle-status', authMiddleware, roleMiddleware(['SUPERADMIN']), async (req, res, next) => {
  await invalidateCache('cache:doctors:*');
  next();
}, doctorController.toggleDoctorStatus);

router.delete('/:id', authMiddleware, roleMiddleware(['SUPERADMIN']), async (req, res, next) => {
  await invalidateCache('cache:doctors:*');
  next();
}, doctorController.deleteDoctor);


module.exports = router;
