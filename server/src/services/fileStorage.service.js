'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * 🔒 Dangerous extensions strictly blocked from upload
 */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.php', '.phtml', '.php5',
  '.js', '.mjs', '.cjs', '.vbs', '.py', '.pl', '.jar', '.scr',
  '.html', '.htm', '.xhtml', '.svg', '.dll', '.so', '.dylib'
]);

/**
 * 📋 Allowed MIME types for medical and billing attachments
 */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
]);

/**
 * 🔍 Magic numbers (file signatures) for content validation
 */
const MAGIC_NUMBERS = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/png': [0x89, 0x50, 0x4E, 0x47],       // .PNG
  'image/jpeg': [0xFF, 0xD8, 0xFF],            // JPEG SOI
  'image/jpg': [0xFF, 0xD8, 0xFF],
  'image/webp': [0x52, 0x49, 0x46, 0x46],      // RIFF
  // ZIP / OpenXML (Office documents: xlsx, docx)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4B, 0x03, 0x04]
};

class FileStorageService {
  constructor() {
    // Private storage directory outside public web root
    this.baseDir = process.env.STORAGE_DIR
      ? path.resolve(process.env.STORAGE_DIR)
      : path.resolve(__dirname, '../../storage/secure');

    this.signingSecret = process.env.FILE_SIGNING_SECRET || process.env.JWT_SECRET || 'clinica_secure_file_signing_secret_2026';
    this.defaultExpirySeconds = 3600; // 1 hour

    this.ensureBaseDirectory();
  }

  /**
   * Ensures the root storage directory exists
   */
  ensureBaseDirectory() {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
        logger.info({ baseDir: this.baseDir }, '📁 Secure private file storage directory initialized');
      }
    } catch (err) {
      logger.error({ error: err.message }, 'Failed to initialize secure storage directory');
    }
  }

  /**
   * Validates file buffer magic bytes against declared MIME type.
   * Prevents disguised executable uploads (e.g. malware.exe renamed to receipt.pdf).
   * 
   * @param {Buffer} buffer 
   * @param {string} mimeType 
   * @returns {boolean}
   */
  validateMagicBytes(buffer, mimeType) {
    if (!buffer || buffer.length < 4) return false;

    // Plain text / CSV files don't have fixed magic headers
    if (mimeType === 'text/csv' || mimeType === 'application/vnd.ms-excel') {
      return true;
    }

    const expectedHeader = MAGIC_NUMBERS[mimeType];
    if (!expectedHeader) {
      // If MIME type is in allowed set but no magic header registered, allow with caution
      return ALLOWED_MIME_TYPES.has(mimeType);
    }

    for (let i = 0; i < expectedHeader.length; i++) {
      if (buffer[i] !== expectedHeader[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sanitizes and verifies path to prevent Directory Traversal attacks (../)
   * 
   * @param {string} candidatePath 
   * @returns {string} Absolute normalized safe path
   */
  sanitizePath(candidatePath) {
    if (!candidatePath || typeof candidatePath !== 'string') {
      throw new Error('Security Error: Invalid path');
    }

    // Explicit path traversal and null byte guard
    if (candidatePath.includes('..') || candidatePath.includes('\0')) {
      throw new Error('Security Error: Path traversal attempt blocked');
    }

    const absolute = path.resolve(this.baseDir, candidatePath);

    if (!absolute.startsWith(this.baseDir)) {
      throw new Error('Security Error: Path traversal attempt blocked');
    }

    return absolute;
  }

  /**
   * Saves a file safely into the private tenant-isolated storage
   * 
   * @param {Object} params
   * @param {Buffer} params.buffer - File buffer
   * @param {string} params.originalname - Original client filename
   * @param {string} params.mimetype - Declared MIME type
   * @param {string} params.organizationId - Tenant UUID
   * @param {string} [params.folder='documents'] - Subfolder category ('receipts', 'labs', 'records')
   * @returns {Promise<Object>} File metadata descriptor
   */
  async saveFile({ buffer, originalname, mimetype, organizationId = 'system', folder = 'documents' }) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid file buffer');
    }

    // 1. Validate MIME type against allowed whitelist
    const cleanMime = (mimetype || '').toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
      throw new Error(`File type not allowed: ${cleanMime}. Permitted types: PDF, PNG, JPG, JPEG, WEBP, CSV, XLSX`);
    }

    // 2. Validate Extension against blocked list
    const ext = path.extname(originalname || '').toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new Error(`File extension blocked for security reasons: ${ext}`);
    }

    // 3. Binary Magic Bytes Validation
    const isMagicValid = this.validateMagicBytes(buffer, cleanMime);
    if (!isMagicValid) {
      throw new Error('File integrity error: File content signature does not match declared MIME type');
    }

    // 4. Generate Safe UUID-based filename (Never use original filename on disk)
    const safeExt = ext || (cleanMime === 'application/pdf' ? '.pdf' : '.bin');
    const safeFilename = `${uuidv4()}${safeExt}`;
    const safeFolder = folder.replace(/[^a-zA-Z0-9_\-]/g, '');
    const safeOrgId = (organizationId || 'system').replace(/[^a-zA-Z0-9_\-]/g, '');

    // Target Storage Key: tenants/{orgId}/{folder}/{safeFilename}
    const storageKey = `tenants/${safeOrgId}/${safeFolder}/${safeFilename}`;
    const targetPath = this.sanitizePath(storageKey);

    // Ensure directory exists
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file securely
    await fs.promises.writeFile(targetPath, buffer);

    logger.debug({
      storageKey,
      organizationId: safeOrgId,
      mimeType: cleanMime,
      sizeBytes: buffer.length
    }, '🔒 File securely stored in private tenant storage');

    return {
      storageKey,
      filename: safeFilename,
      originalName: originalname,
      mimeType: cleanMime,
      size: buffer.length,
      organizationId: safeOrgId
    };
  }

  /**
   * Retrieves a readable stream for a stored file
   * 
   * @param {string} storageKey 
   * @returns {fs.ReadStream}
   */
  getFileStream(storageKey) {
    const fullPath = this.sanitizePath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }
    return fs.createReadStream(fullPath);
  }

  /**
   * Retrieves file buffer and metadata
   * 
   * @param {string} storageKey 
   * @returns {Promise<{ buffer: Buffer, mimeType: string, size: number }>}
   */
  async getFileBuffer(storageKey) {
    const fullPath = this.sanitizePath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }

    const buffer = await fs.promises.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();

    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.csv') mimeType = 'text/csv';

    return {
      buffer,
      mimeType,
      size: buffer.length
    };
  }

  /**
   * Safely deletes a file from storage
   * 
   * @param {string} storageKey 
   * @returns {Promise<boolean>}
   */
  async deleteFile(storageKey) {
    try {
      const fullPath = this.sanitizePath(storageKey);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (err) {
      logger.warn({ error: err.message, storageKey }, 'Failed to delete file from storage');
      return false;
    }
  }

  /**
   * Generates a time-limited cryptographically signed URL (HMAC-SHA256)
   * Allows secure temporary file viewing without leaking permanent URLs.
   * 
   * @param {string} storageKey 
   * @param {Object} options
   * @param {number} [options.expiresInSeconds=3600] - Expiration duration in seconds
   * @param {string} [options.organizationId] - Tenant ID restriction
   * @returns {string} Relative signed URL
   */
  generateSignedUrl(storageKey, { expiresInSeconds = 3600, organizationId = null } = {}) {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const orgPart = organizationId || '';

    const payload = `${storageKey}:${expiresAt}:${orgPart}`;
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');

    const params = new URLSearchParams({
      key: storageKey,
      expires: String(expiresAt),
      sig: signature
    });

    if (organizationId) {
      params.append('org', organizationId);
    }

    return `/api/files/download?${params.toString()}`;
  }

  /**
   * Verifies the cryptographic HMAC-SHA256 signature and expiration of a signed URL.
   * 
   * @param {string} storageKey 
   * @param {string|number} expiresAt 
   * @param {string} signature 
   * @param {string|null} organizationId 
   * @returns {boolean} True if signature is valid and timestamp has not expired
   */
  verifySignedUrl(storageKey, expiresAt, signature, organizationId = null) {
    if (!storageKey || !expiresAt || !signature) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = parseInt(expiresAt, 10);

    // 1. Check expiration
    if (isNaN(exp) || exp < now) {
      return false;
    }

    // 2. Recompute HMAC and verify
    const orgPart = organizationId || '';
    const payload = `${storageKey}:${exp}:${orgPart}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
}

module.exports = new FileStorageService();
