const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');
const auth = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

// Services
router.get('/services', auth, authorize('sales:read'), salesController.getServices);
router.post('/services', auth, authorize('sales:write'), salesController.createService);

// Packages & Combos (Plantillas / Paquetes Quirúrgicos)
router.get('/packages', auth, authorize('sales:read'), salesController.getPackages);
router.post('/packages', auth, authorize('sales:write'), salesController.createPackage);
router.put('/packages/:id', auth, authorize('sales:write'), salesController.updatePackage);
router.delete('/packages/:id', auth, authorize('sales:delete'), salesController.deletePackage);

// Quotes / Presupuestos
router.get('/quotes', auth, authorize('sales:read'), salesController.getQuotes);
router.post('/quotes', auth, authorize('sales:write'), salesController.createQuote);
router.patch('/quotes/:id/status', auth, authorize('sales:write'), salesController.updateQuoteStatus);
router.delete('/quotes/:id', auth, authorize('sales:delete'), salesController.deleteQuote);

module.exports = router;
