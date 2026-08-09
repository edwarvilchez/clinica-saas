const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');

// Public routes - no authentication required
router.post('/appointments', publicController.createPublicAppointment);
router.post('/checkout-preview', publicController.getCheckoutPreview);
router.get('/doctors', publicController.getPublicDoctors);
router.get('/prescriptions/verify/:hash', publicController.verifyPrescription);

module.exports = router;
