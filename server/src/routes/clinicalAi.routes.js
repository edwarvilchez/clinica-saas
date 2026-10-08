'use strict';

/**
 * 🛣️ Clinical AI & CDSS Decision Support Routes
 * Enforces Doctor reviews & approves paradigm, tenant isolation, and clinical safety RBAC.
 */

const express = require('express');
const router = express.Router();
const clinicalAiController = require('../controllers/clinicalAi.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

// 1. Pre-Consultation Clinical Brief
router.post('/patients/:patientId/brief', authMiddleware, authorize('clinical-ai:write'), clinicalAiController.generateBrief);

// 2. Differential Diagnostic CIE-11 Hypotheses
router.post('/patients/:patientId/cie11', authMiddleware, authorize('clinical-ai:write'), clinicalAiController.suggestCie11);

// 3. SOAP Note Clinical Draft
router.post('/patients/:patientId/soap', authMiddleware, authorize('clinical-ai:write'), clinicalAiController.generateSoap);

// 4. Prescription Safety & Allergy Conflict Check
router.post('/patients/:patientId/prescription-safety', authMiddleware, authorize('clinical-ai:write'), clinicalAiController.checkPrescriptionSafety);

// 5. Formal Review & Approval by Attending Physician
router.post('/drafts/:draftId/review', authMiddleware, authorize('clinical-ai:review'), clinicalAiController.reviewDraft);

// 6. Query Drafts & Decision Trail
router.get('/patients/:patientId/drafts', authMiddleware, authorize('clinical-ai:read'), clinicalAiController.getDraftsForPatient);
router.get('/drafts/:draftId', authMiddleware, authorize('clinical-ai:read'), clinicalAiController.getDraftById);

module.exports = router;
