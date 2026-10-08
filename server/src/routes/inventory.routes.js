const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const auth = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

// Items Catalog (Products, Medications, Supplies, Services)
router.get('/items', auth, authorize('inventory:read'), inventoryController.getItems);
router.get('/items/:id', auth, authorize('inventory:read'), inventoryController.getItemById);
router.post('/items', auth, authorize('inventory:write'), inventoryController.createItem);
router.put('/items/:id', auth, authorize('inventory:write'), inventoryController.updateItem);
router.delete('/items/:id', auth, authorize('inventory:delete'), inventoryController.deleteItem);

// Inventory Movements & Clinical Consumption (Kardex)
router.get('/movements', auth, authorize('inventory:read'), inventoryController.getMovements);
router.post('/movements', auth, authorize('inventory:write'), inventoryController.registerMovement);

// Inventory Alerts (Low stock & Expiry)
router.get('/alerts', auth, authorize('inventory:read'), inventoryController.getInventoryAlerts);

module.exports = router;
