const express = require('express');
const router = express.Router();
const labCatalogController = require('../controllers/labCatalog.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const checkRole = require('../middlewares/role.middleware');
const { createUpload } = require('../middlewares/upload.middleware');

const upload = createUpload({
  dest: 'uploads/temp/lab_catalog/',
  maxSize: 5 * 1024 * 1024,
  allowedTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel']
});

// Public/All Roles Routes
router.get('/tests', authMiddleware, labCatalogController.getTests);
router.get('/combos', authMiddleware, labCatalogController.getCombos);

// Management Routes (Doctor and Administrative)
const canManageCatalog = checkRole(['SUPERADMIN', 'DOCTOR', 'ADMINISTRATIVE']);

router.post('/tests', authMiddleware, canManageCatalog, labCatalogController.createTest);
router.put('/tests/:id', authMiddleware, canManageCatalog, labCatalogController.updateTest);
router.delete('/tests/:id', authMiddleware, canManageCatalog, labCatalogController.deleteTest);

router.post('/combos', authMiddleware, canManageCatalog, labCatalogController.createCombo);
router.put('/combos/:id', authMiddleware, canManageCatalog, labCatalogController.updateCombo);
router.delete('/combos/:id', authMiddleware, canManageCatalog, labCatalogController.deleteCombo);

router.post('/import-tests', authMiddleware, canManageCatalog, upload.single('file'), labCatalogController.bulkImport);

module.exports = router;
