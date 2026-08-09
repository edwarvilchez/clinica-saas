const express = require('express');
const router = express.Router();
const medicalRecordController = require('../controllers/medicalRecord.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

router.post('/', authMiddleware, authorize('medical-records:write'), medicalRecordController.createRecord);
router.get('/patient/:patientId', authMiddleware, authorize('medical-records:read'), medicalRecordController.getPatientHistory);
router.get('/ai-summary/:patientId', authMiddleware, authorize('medical-records:read'), medicalRecordController.getAISummary);
router.post('/ai-icd11-suggestions', authMiddleware, authorize('medical-records:read'), medicalRecordController.suggestICD11);

module.exports = router;
