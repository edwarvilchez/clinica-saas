const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accounting.controller');
const auth = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');

// Chart of accounts
router.get('/accounts', auth, authorize('accounting:read'), accountingController.getChartOfAccounts);
router.post('/accounts', auth, authorize('accounting:write'), accountingController.createAccount);

// Journal entries (Libro Diario)
router.get('/journal-entries', auth, authorize('accounting:read'), accountingController.getJournalEntries);
router.post('/journal-entries', auth, authorize('accounting:write'), accountingController.createJournalEntry);

// Trial balance (Balance de Comprobación)
router.get('/trial-balance', auth, authorize('accounting:read'), accountingController.getTrialBalance);

// SENIAT Tax Retentions
router.get('/retentions', auth, authorize('accounting:read'), accountingController.getTaxRetentions);
router.post('/retentions', auth, authorize('accounting:write'), accountingController.createTaxRetention);

module.exports = router;
