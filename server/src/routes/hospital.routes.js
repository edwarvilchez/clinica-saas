const express = require('express');
const router = express.Router();
const hospitalController = require('../controllers/hospital.controller');
const auth = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

// Admisiones
router.get('/admissions', auth, authorize('hospital:read'), hospitalController.getAdmissions);
router.post('/admissions', auth, authorize('hospital:admit'), hospitalController.createAdmission);
router.put('/admissions/:id', auth, authorize('hospital:admit'), hospitalController.updateAdmission);
router.post('/admissions/:id/discharge', auth, authorize('hospital:discharge'), hospitalController.dischargeAdmission);
router.post('/admissions/:id/move-area', auth, authorize('hospital:admit'), hospitalController.recordAreaMovement);

// Triaje de Emergencia
router.get('/triage', auth, authorize('hospital:read'), hospitalController.getTriages);
router.post('/triage', auth, authorize('hospital:triage'), hospitalController.createTriage);

// Camas y Hospitalización
router.get('/beds', auth, authorize('hospital:read'), hospitalController.getBeds);
router.post('/beds/assign', auth, authorize('hospital:admit'), hospitalController.assignBed);

// Cirugías
router.get('/surgeries', auth, authorize('hospital:read'), hospitalController.getSurgeries);
router.post('/surgeries', auth, authorize('hospital:surgery'), hospitalController.createSurgery);

module.exports = router;
