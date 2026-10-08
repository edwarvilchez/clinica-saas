const express = require('express');
const router = express.Router();
const labCatalogController = require('../controllers/labCatalog.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');
const { createUpload } = require('../middlewares/upload.middleware');

const upload = createUpload({
  dest: 'uploads/temp/lab_catalog/',
  maxSize: 5 * 1024 * 1024,
  allowedTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel']
});

// Public/All Roles Routes
router.get('/tests', authMiddleware, authorize('lab-catalog:read'), labCatalogController.getTests);
router.get('/combos', authMiddleware, authorize('lab-catalog:read'), labCatalogController.getCombos);

// Management Routes
router.post('/tests', authMiddleware, authorize('lab-catalog:write'), labCatalogController.createTest);
router.put('/tests/:id', authMiddleware, authorize('lab-catalog:write'), labCatalogController.updateTest);
router.delete('/tests/:id', authMiddleware, authorize('lab-catalog:write'), labCatalogController.deleteTest);

router.post('/combos', authMiddleware, authorize('lab-catalog:write'), labCatalogController.createCombo);
router.put('/combos/:id', authMiddleware, authorize('lab-catalog:write'), labCatalogController.updateCombo);
router.delete('/combos/:id', authMiddleware, authorize('lab-catalog:write'), labCatalogController.deleteCombo);

router.post('/import-tests', authMiddleware, authorize('lab-catalog:write'), upload.single('file'), labCatalogController.bulkImport);

module.exports = router;
