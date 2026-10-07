'use strict';

const path = require('path');
const fs = require('fs');
const fileStorageService = require('../services/fileStorage.service');
const auditService = require('../services/audit.service');
const { Payment, Patient, User } = require('../models');
const logger = require('../utils/logger');

/**
 * 📂 Secure File Controller
 * Manages authorized document uploads, downloads, and time-limited signed URL access.
 */

/**
 * Stream file with strict security headers
 */
const streamFileSecurely = (res, storageKey, requestedFilename = null) => {
  const ext = path.extname(storageKey).toLowerCase();
  
  let mimeType = 'application/octet-stream';
  if (ext === '.pdf') mimeType = 'application/pdf';
  else if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
  else if (ext === '.webp') mimeType = 'image/webp';
  else if (ext === '.csv') mimeType = 'text/csv';

  const downloadName = requestedFilename || path.basename(storageKey);

  // Security Headers against Content Sniffing and Embedded Execution
  res.setHeader('Content-Type', mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);

  const stream = fileStorageService.getFileStream(storageKey);
  stream.on('error', (err) => {
    logger.error({ error: err.message, storageKey }, 'Error streaming secure file');
    if (!res.headersSent) {
      res.status(404).json({ message: 'Archivo no encontrado' });
    }
  });

  stream.pipe(res);
};

/**
 * Download file via either:
 * 1. Valid HMAC Signed URL parameters (?key=...&expires=...&sig=...)
 * 2. Authenticated Session with Tenant Isolation check
 */
exports.downloadFile = async (req, res) => {
  try {
    const { key, expires, sig, org } = req.query;

    if (!key) {
      return res.status(400).json({ message: 'Parámetro "key" es requerido' });
    }

    // 1. Signed URL Path (Pre-authorized temporary access)
    if (expires && sig) {
      const isValid = fileStorageService.verifySignedUrl(key, expires, sig, org);
      if (!isValid) {
        return res.status(403).json({ message: 'Enlace de descarga inválido o expirado' });
      }

      // If user is also authenticated, verify tenant alignment
      if (req.user && org && req.user.role !== 'SUPERADMIN' && req.user.role !== 'PLATFORM_ADMIN') {
        if (req.user.organizationId !== org) {
          return res.status(403).json({ message: 'Acceso denegado: el archivo pertenece a otra organización' });
        }
      }

      return streamFileSecurely(res, key);
    }

    // 2. Authenticated Session Path (Direct API call with Bearer Token)
    if (!req.user) {
      return res.status(401).json({ message: 'Autenticación requerida para acceder al archivo' });
    }

    const isSuperAdmin = req.user.role === 'SUPERADMIN' || req.user.role === 'PLATFORM_ADMIN';

    // Verify tenant boundary from storageKey: "tenants/<organizationId>/..."
    const keyParts = key.split('/');
    if (keyParts[0] === 'tenants' && keyParts.length >= 2) {
      const fileOrgId = keyParts[1];
      if (!isSuperAdmin && fileOrgId !== 'system' && req.user.organizationId !== fileOrgId) {
        return res.status(403).json({ message: 'Acceso no autorizado a documentos de otra organización' });
      }
    }

    return streamFileSecurely(res, key);
  } catch (error) {
    logger.error({ error: error.message }, 'Download file error');
    if (!res.headersSent) {
      res.status(500).json({ message: error.message || 'Error al descargar archivo' });
    }
  }
};

/**
 * Upload attachment with magic byte validation and tenant isolation
 */
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se envió ningún archivo' });
    }

    const organizationId = req.user?.organizationId || 'system';
    const folder = req.body.folder || 'documents';

    // Store securely
    const fileResult = await fileStorageService.saveFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      organizationId,
      folder
    });

    // Generate signed download URL
    const signedUrl = fileStorageService.generateSignedUrl(fileResult.storageKey, {
      expiresInSeconds: 3600,
      organizationId
    });

    // Audit log
    auditService.logEvent({
      action: 'UPLOAD_DOCUMENT',
      entity: 'File',
      entityId: fileResult.filename,
      organizationId,
      actorUserId: req.user?.id,
      metadata: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        folder
      },
      ip: req.ip
    }).catch(err => logger.warn({ error: err.message }, 'Failed to audit file upload'));

    res.status(201).json({
      success: true,
      file: fileResult,
      downloadUrl: signedUrl
    });
  } catch (error) {
    logger.warn({ error: error.message }, 'File upload rejected');
    res.status(400).json({ message: error.message || 'Error al procesar el archivo' });
  }
};

/**
 * Authorized download of a Payment Receipt
 */
exports.getPaymentReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';

    const payment = await Payment.findByPk(id);
    if (!payment || !payment.receiptUrl) {
      return res.status(404).json({ message: 'Comprobante de pago no encontrado' });
    }

    // Tenant check
    if (!isSuperAdmin) {
      const isSameOrg = req.user.organizationId && payment.organizationId === req.user.organizationId;
      
      // If user is patient, verify patient ownership
      let isOwnerPatient = false;
      if (req.user.role === 'PATIENT' && payment.patientId) {
        const patient = await Patient.findOne({ where: { userId: req.user.id } });
        if (patient && patient.id === payment.patientId) {
          isOwnerPatient = true;
        }
      }

      if (!isSameOrg && !isOwnerPatient) {
        return res.status(403).json({ message: 'No tienes autorización para ver este comprobante' });
      }
    }

    // If stored as storage key or URL
    let storageKey = payment.receiptUrl;
    if (storageKey.startsWith('/uploads/')) {
      // Legacy upload fallback: check legacy directory or map to filename
      const legacyPath = path.resolve(__dirname, '../../uploads', storageKey.replace('/uploads/', ''));
      if (fs.existsSync(legacyPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return fs.createReadStream(legacyPath).pipe(res);
      }
    }

    // Stream from secure storage
    return streamFileSecurely(res, storageKey, `recibo_${payment.id}.pdf`);
  } catch (error) {
    logger.error({ error: error.message }, 'Get payment receipt error');
    res.status(500).json({ message: 'Error al obtener el comprobante' });
  }
};

/**
 * Generate time-limited signed URL for a file
 */
exports.generateSignedUrl = async (req, res) => {
  try {
    const { storageKey, expiresInSeconds } = req.body;
    if (!storageKey) {
      return res.status(400).json({ message: 'storageKey es requerido' });
    }

    const isSuperAdmin = req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN';
    const keyParts = storageKey.split('/');

    if (keyParts[0] === 'tenants' && keyParts.length >= 2) {
      const fileOrgId = keyParts[1];
      if (!isSuperAdmin && fileOrgId !== 'system' && req.user.organizationId !== fileOrgId) {
        return res.status(403).json({ message: 'No puedes firmar URLs de otra organización' });
      }
    }

    const signedUrl = fileStorageService.generateSignedUrl(storageKey, {
      expiresInSeconds: expiresInSeconds || 3600,
      organizationId: req.user?.organizationId
    });

    res.json({ signedUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
