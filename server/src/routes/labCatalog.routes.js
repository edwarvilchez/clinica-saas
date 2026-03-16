const express = require('express');
const router = express.Router();
const labCatalogController = require('../controllers/labCatalog.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/role.middleware');
const { createUpload } = require('../middlewares/upload.middleware');

const upload = createUpload({ 
  dest: 'uploads/temp/lab_catalog/', 
  maxSize: 5 * 1024 * 1024,
  allowedTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel']
});

// Public/All Roles Routes
router.get('/tests', verifyToken, labCatalogController.getTests);
router.get('/combos', verifyToken, labCatalogController.getCombos);

// Management Routes (Doctor and Administrative)
const canManageCatalog = checkRole(['SUPERADMIN', 'DOCTOR', 'ADMINISTRATIVE']);

router.post('/tests', verifyToken, canManageCatalog, labCatalogController.createTest);
router.put('/tests/:id', verifyToken, canManageCatalog, labCatalogController.updateTest);
router.delete('/tests/:id', verifyToken, canManageCatalog, labCatalogController.deleteTest);

router.post('/combos', verifyToken, canManageCatalog, labCatalogController.createCombo);
router.put('/combos/:id', verifyToken, canManageCatalog, labCatalogController.updateCombo);
router.delete('/combos/:id', verifyToken, canManageCatalog, labCatalogController.deleteCombo);

router.post('/import-tests', verifyToken, canManageCatalog, upload.single('file'), labCatalogController.bulkImport);

module.exports = router;
