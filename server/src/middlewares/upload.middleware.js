'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload folders exist
const ensureDir = (dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.warn(`⚠️ Could not create directory ${dir}:`, err.message);
  }
};

/**
 * Factory to create multer instance with options (disk or memory storage)
 */
const createUpload = (options = {}) => {
  let storage;

  if (options.useMemory || options.memory) {
    storage = multer.memoryStorage();
  } else {
    const dest = options.dest || 'uploads/';
    ensureDir(dest);

    storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, dest),
      filename: (req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9.\-\_]/g, '_');
        cb(null, `${Date.now()}-${safe}`);
      }
    });
  }

  const fileFilter = (req, file, cb) => {
    if (options.allowedTypes) {
      if (options.allowedTypes.includes(file.mimetype)) return cb(null, true);
      return cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
    }
    cb(null, true);
  };

  return multer({
    storage,
    limits: { fileSize: options.maxSize || 10 * 1024 * 1024 },
    fileFilter
  });
};

const secureMemoryUpload = createUpload({
  useMemory: true,
  maxSize: 10 * 1024 * 1024
});

module.exports = { createUpload, secureMemoryUpload };
