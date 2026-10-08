'use strict';

const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorization.middleware');
const { secureMemoryUpload } = require('../middlewares/upload.middleware');

/**
 * 🔒 File Routes
 */

// Optional auth for download: allows pre-signed HMAC URLs OR JWT Bearer session
const conditionalAuthForDownload = (req, res, next) => {
  if (req.query.sig && req.query.expires) {
    // Has signed URL parameters: let fileController verify the HMAC signature
    return next();
  }
  // Otherwise requires standard JWT bearer authentication
  return authMiddleware(req, res, next);
};

// 1. Download file via signed URL or active JWT session
router.get('/download', conditionalAuthForDownload, fileController.downloadFile);

// 2. Upload file with memory storage and magic bytes analysis
router.post('/upload', authMiddleware, authorize('files:upload'), secureMemoryUpload.single('file'), fileController.uploadFile);

// 3. Download Payment Receipt
router.get('/payments/:id/receipt', authMiddleware, authorize('payments:read'), fileController.getPaymentReceipt);

// 4. Generate short-lived signed URL
router.post('/sign-url', authMiddleware, authorize('files:read'), fileController.generateSignedUrl);

module.exports = router;
