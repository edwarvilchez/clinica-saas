const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const auth = require('../middlewares/auth.middleware');

// Items Catalog (Products, Medications, Supplies, Services)
router.get('/items', auth, inventoryController.getItems);
router.get('/items/:id', auth, inventoryController.getItemById);
router.post('/items', auth, inventoryController.createItem);
router.put('/items/:id', auth, inventoryController.updateItem);
router.delete('/items/:id', auth, inventoryController.deleteItem);

// Inventory Movements & Clinical Consumption (Kardex)
router.get('/movements', auth, inventoryController.getMovements);
router.post('/movements', auth, inventoryController.registerMovement);

// Inventory Alerts (Low stock & Expiry)
router.get('/alerts', auth, inventoryController.getInventoryAlerts);

module.exports = router;
