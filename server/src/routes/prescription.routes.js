const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescription.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

router.use(authMiddleware);

router.post('/', authorize('prescriptions:write'), prescriptionController.createPrescription);
router.get('/record/:medicalRecordId', authorize('prescriptions:read'), prescriptionController.getRecordPrescriptions);
router.delete('/:id', authorize('prescriptions:delete'), prescriptionController.deletePrescription);

module.exports = router;
