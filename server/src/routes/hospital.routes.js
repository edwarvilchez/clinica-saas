const express = require('express');
const router = express.Router();
const hospitalController = require('../controllers/hospital.controller');
const auth = require('../middlewares/auth.middleware');

// Admisiones
router.get('/admissions', auth, hospitalController.getAdmissions);
router.post('/admissions', auth, hospitalController.createAdmission);
router.put('/admissions/:id', auth, hospitalController.updateAdmission);
router.post('/admissions/:id/discharge', auth, hospitalController.dischargeAdmission);
router.post('/admissions/:id/move-area', auth, hospitalController.recordAreaMovement);

// Triaje de Emergencia
router.get('/triage', auth, hospitalController.getTriages);
router.post('/triage', auth, hospitalController.createTriage);

// Camas y Hospitalización
router.get('/beds', auth, hospitalController.getBeds);
router.post('/beds/assign', auth, hospitalController.assignBed);

// Cirugías
router.get('/surgeries', auth, hospitalController.getSurgeries);
router.post('/surgeries', auth, hospitalController.createSurgery);

module.exports = router;
