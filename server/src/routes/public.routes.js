const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');

// Public routes - no authentication required
router.post('/appointments', publicController.createPublicAppointment);
router.post('/checkout-preview', publicController.getCheckoutPreview);
router.get('/doctors', publicController.getPublicDoctors);
router.get('/prescriptions/verify/:hash', publicController.verifyPrescription);
router.get('/receipt/doctor-fee/:token', require('../controllers/doctorFee.controller').getReceiptByToken);
router.get('/receipt/insurance-claim/:token', require('../controllers/insurance.controller').getClaimByToken);

module.exports = router;
