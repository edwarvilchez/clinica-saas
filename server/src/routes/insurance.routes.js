const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insurance.controller');
const auth = require('../middlewares/auth.middleware');

// Companies
router.get('/companies', auth, insuranceController.getCompanies);
router.post('/companies', auth, insuranceController.createCompany);
router.put('/companies/:id', auth, insuranceController.updateCompany);
router.delete('/companies/:id', auth, insuranceController.deleteCompany);

// Policies
router.get('/policies', auth, insuranceController.getPolicies);
router.post('/policies', auth, insuranceController.createPolicy);

// Claims (Siniestros / Reclamos a Aseguradoras)
router.get('/claims', auth, insuranceController.getClaims);
router.get('/claims/:id', auth, insuranceController.getClaimById);
router.post('/claims', auth, insuranceController.createClaim);
router.put('/claims/:id/status', auth, insuranceController.updateClaimStatus);
router.delete('/claims/:id', auth, insuranceController.deleteClaim);
router.get('/claims/voucher/:token', insuranceController.getClaimByToken);

module.exports = router;
