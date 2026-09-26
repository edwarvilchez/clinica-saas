const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');
const auth = require('../middlewares/auth.middleware');

// Services
router.get('/services', auth, salesController.getServices);
router.post('/services', auth, salesController.createService);

// Packages & Combos (Plantillas / Paquetes Quirúrgicos)
router.get('/packages', auth, salesController.getPackages);
router.post('/packages', auth, salesController.createPackage);
router.put('/packages/:id', auth, salesController.updatePackage);
router.delete('/packages/:id', auth, salesController.deletePackage);

// Quotes / Presupuestos
router.get('/quotes', auth, salesController.getQuotes);
router.post('/quotes', auth, salesController.createQuote);
router.patch('/quotes/:id/status', auth, salesController.updateQuoteStatus);
router.delete('/quotes/:id', auth, salesController.deleteQuote);

module.exports = router;
