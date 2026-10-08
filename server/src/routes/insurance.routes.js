const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insurance.controller');
const auth = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

// Companies
router.get('/companies', auth, authorize('insurance:read'), insuranceController.getCompanies);
router.post('/companies', auth, authorize('insurance:write'), insuranceController.createCompany);
router.put('/companies/:id', auth, authorize('insurance:write'), insuranceController.updateCompany);
router.delete('/companies/:id', auth, authorize('insurance:delete'), insuranceController.deleteCompany);

// Policies
router.get('/policies', auth, authorize('insurance:read'), insuranceController.getPolicies);
router.post('/policies', auth, authorize('insurance:write'), insuranceController.createPolicy);

// Claims (Siniestros / Reclamos a Aseguradoras)
router.get('/claims', auth, authorize('insurance:read'), insuranceController.getClaims);
router.get('/claims/:id', auth, authorize('insurance:read'), insuranceController.getClaimById);
router.post('/claims', auth, authorize('insurance:write'), insuranceController.createClaim);
router.put('/claims/:id/status', auth, authorize('insurance:write'), insuranceController.updateClaimStatus);
router.delete('/claims/:id', auth, authorize('insurance:delete'), insuranceController.deleteClaim);
router.get('/claims/voucher/:token', insuranceController.getClaimByToken);

module.exports = router;
