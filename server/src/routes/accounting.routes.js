const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accounting.controller');
const auth = require('../middlewares/auth.middleware');

// Chart of accounts
router.get('/accounts', auth, accountingController.getChartOfAccounts);
router.post('/accounts', auth, accountingController.createAccount);

// Journal entries (Libro Diario)
router.get('/journal-entries', auth, accountingController.getJournalEntries);
router.post('/journal-entries', auth, accountingController.createJournalEntry);

// Trial balance (Balance de Comprobación)
router.get('/trial-balance', auth, accountingController.getTrialBalance);

// SENIAT Tax Retentions
router.get('/retentions', auth, accountingController.getTaxRetentions);
router.post('/retentions', auth, accountingController.createTaxRetention);

module.exports = router;
