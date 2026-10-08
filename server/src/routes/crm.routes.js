'use strict';

const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crm.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

// Rutas de CRM Clínico y Embudo de Conversión
router.get('/leads/stats', authMiddleware, authorize('crm:read'), crmController.getLeadStats);
router.get('/leads', authMiddleware, authorize('crm:read'), crmController.getLeads);
router.get('/leads/:id', authMiddleware, authorize('crm:read'), crmController.getLeadById);
router.post('/leads', authMiddleware, authorize('crm:create'), crmController.createLead);
router.put('/leads/:id', authMiddleware, authorize('crm:update'), crmController.updateLead);
router.post('/leads/:id/convert', authMiddleware, authorize('crm:convert'), crmController.convertLeadToPatient);
router.delete('/leads/:id', authMiddleware, authorize('crm:delete'), crmController.deleteLead);

module.exports = router;
