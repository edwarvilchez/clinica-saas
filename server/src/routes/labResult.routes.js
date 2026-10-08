const express = require('express');
const router = express.Router();
const labResultController = require('../controllers/labResult.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

router.get('/', authMiddleware, authorize('lab-results:read'), labResultController.getAllLabs);
router.post('/', authMiddleware, authorize('lab-results:write'), labResultController.createLabResult);
router.post('/express-order', authMiddleware, authorize('lab-results:write'), labResultController.createExpressOrder);
router.put('/:id/sample-status', authMiddleware, authorize('lab-results:write'), labResultController.updateSampleStatus);
router.get('/patient/:patientId', authMiddleware, authorize('lab-results:read'), labResultController.getPatientLabs);

module.exports = router;
