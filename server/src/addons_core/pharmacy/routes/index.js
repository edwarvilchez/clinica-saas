const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacy.controller');
const authMiddleware = require('../../../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/inventory', (req, res) => pharmacyController.getInventory(req, res));
router.post('/items', (req, res) => pharmacyController.createItem(req, res));
router.post('/batches', (req, res) => pharmacyController.addBatch(req, res));
router.post('/dispense-fefo', (req, res) => pharmacyController.dispenseFEFO(req, res));

module.exports = router;
