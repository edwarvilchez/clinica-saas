const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescription.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

router.post('/', roleMiddleware(['SUPERADMIN', 'DOCTOR']), prescriptionController.createPrescription);
router.get('/record/:medicalRecordId', prescriptionController.getRecordPrescriptions);
router.delete('/:id', roleMiddleware(['SUPERADMIN', 'DOCTOR']), prescriptionController.deletePrescription);

module.exports = router;
