const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

router.get('/', authMiddleware, authorize('patients:read'), patientController.getPatients);
router.get('/record/:recordNumber', authMiddleware, authorize('patients:read'), patientController.getPatientByMedicalRecord);
router.get('/user/:userId', authMiddleware, authorize('patients:read'), patientController.getPatientByUserId);
router.get('/:id', authMiddleware, authorize('patients:read'), patientController.getPatientById);
router.post('/', authMiddleware, authorize('patients:read'), patientController.createPatient);
router.put('/:id', authMiddleware, authorize('patients:read'), patientController.updatePatient);
router.post('/express-admission', authMiddleware, authorize('patients:read'), patientController.expressAdmission);
router.post('/:id/verify-coverage', authMiddleware, authorize('patients:read'), patientController.verifyInsuranceCoverage);
router.delete('/:id', authMiddleware, authorize('patients:delete'), patientController.deletePatient);

module.exports = router;
