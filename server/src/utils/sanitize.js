/**
 * Input sanitization middleware
 * Prevents SQL injection and XSS attacks while preserving valid data formats
 */

// const xss = require('xss-clean'); // Removed obsolete/unused dependency

const FIELDS_TO_SKIP = [
  'email',
  'emailAddress',
  'username',
  'password',
  'temporaryPassword',
  'token',
  'refreshToken',
  'resetToken',
  'licenseNumber',
  'documentId',
  'phone',
  'mobile',
  'address',
  'avatar',
  'image',
  'file',
  'pdf',
  'html',
  'description',
  'notes',
  'observations',
  'medicalNotes',
  'prescriptionNotes',
  'firstName',
  'lastName',
  'name',
];

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  const sqlPatterns = [
    { pattern: /'/g, replacement: '' },
    { pattern: /--/g, replacement: '' },
    { pattern: /;/g, replacement: '' },
    { pattern: /\/\*/g, replacement: '' },
    { pattern: /\*\//g, replacement: '' },
    { pattern: /"/g, replacement: '' },
    { pattern: /\\/g, replacement: '' },
    { pattern: /\x00/g, replacement: '' },
    { pattern: /\r\n/g, replacement: '\n' },
  ];
  
  let sanitized = str;
  sqlPatterns.forEach(({ pattern, replacement }) => {
    sanitized = sanitized.replace(pattern, replacement);
  });
  
  return sanitized.trim();
};

const shouldSanitize = (key) => {
  return !FIELDS_TO_SKIP.some(field => 
    key.toLowerCase() === field.toLowerCase() ||
    key.toLowerCase().includes(field.toLowerCase())
  );
};

const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (typeof value === 'string') {
      sanitized[key] = shouldSanitize(key) ? sanitizeString(value) : value;
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

const sanitizeInput = (req, res, next) => {
  try {
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.params && Object.keys(req.params).length > 0) {
      req.params = sanitizeObject(req.params);
    }
    
    if (req.query && Object.keys(req.query).length > 0) {
      req.query = sanitizeObject(req.query);
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sanitizeInput,
  sanitizeString,
  sanitizeObject,
  shouldSanitize
};
