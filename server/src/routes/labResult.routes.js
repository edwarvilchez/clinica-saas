const express = require('express');
const router = express.Router();
const labResultController = require('../controllers/labResult.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.get('/', authMiddleware, roleMiddleware(['SUPERADMIN', 'SUPERADMIN', 'DOCTOR', 'ADMINISTRATIVE', 'ADMIN']), labResultController.getAllLabs);
router.post('/', authMiddleware, roleMiddleware(['SUPERADMIN', 'DOCTOR']), labResultController.createLabResult);
router.post('/express-order', authMiddleware, roleMiddleware(['SUPERADMIN', 'DOCTOR', 'ADMINISTRATIVE', 'NURSE']), labResultController.createExpressOrder);
router.put('/:id/sample-status', authMiddleware, roleMiddleware(['SUPERADMIN', 'DOCTOR', 'ADMINISTRATIVE', 'NURSE']), labResultController.updateSampleStatus);
router.get('/patient/:patientId', authMiddleware, labResultController.getPatientLabs);

module.exports = router;
