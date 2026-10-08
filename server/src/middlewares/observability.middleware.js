'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Sensitive fields to redact recursively from any object (Zero PHI & Credentials)
 */
const SENSITIVE_KEY_REGEX = /^(password|newpassword|currentpassword|token|refreshtoken|temptoken|resettoken|twofactorsecret|recoverycodes|authorization|cookie|creditcard|cvv|documentid|dni|medicalrecordnumber|diagnosis|clinicalhistorysummary|allergies|notes)$/i;

/**
 * Recursively deep-redacts sensitive fields in objects/arrays.
 * 
 * @param {*} data - Input object or primitive
 * @param {WeakSet} [seen=new WeakSet()] - Circular reference protection
 * @returns {*} Sanitized object copy
 */
function redactPhiAndCredentials(data, seen = new WeakSet()) {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data;
  }

  // Handle circular references safely
  if (seen.has(data)) {
    return '[CIRCULAR]';
  }
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map(item => redactPhiAndCredentials(item, seen));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactPhiAndCredentials(value, seen);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * 🏷️ X-Request-ID Generator & Propagator Middleware
 * Extracts incoming X-Request-ID or generates a fresh high-entropy UUID v4.
 * Attaches to req.id and emits X-Request-ID in HTTP response headers.
 */
function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];

  // Validate format if provided by upstream proxy/client (UUID or alphanumeric 1-64 chars)
  const isValidIncoming = typeof incomingId === 'string' &&
    /^[a-zA-Z0-9_-]{1,64}$/.test(incomingId.trim());

  const requestId = isValidIncoming ? incomingId.trim() : crypto.randomUUID();

  req.id = requestId;
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}

/**
 * 📊 Structured HTTP Observability & Request Logging Middleware
 * Captures request duration, status, client metadata and user context.
 * Emits zero PHI structured JSON logs via Pino.
 */
function requestLoggingMiddleware(req, res, next) {
  const startHr = process.hrtime.bigint();

  // Attach child logger scoped to this specific requestId
  req.log = logger.child({ requestId: req.id });

  // Hook into response completion
  res.on('finish', () => {
    // Skip logging health checks in non-debug mode to avoid log noise
    if (req.path === '/api/health' && res.statusCode === 200 && process.env.NODE_ENV === 'production') {
      return;
    }

    const durationNano = process.hrtime.bigint() - startHr;
    const durationMs = Number(durationNano / 1000000n);

    // Extract user & organization context without PHI
    const userId = req.user?.id || null;
    const userRole = req.user?.role || req.user?.Role?.name || null;
    const organizationId = req.organizationId || req.user?.organizationId || null;

    const logPayload = {
      requestId: req.id,
      method: req.method,
      route: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs,
      ip: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null,
      userId,
      role: userRole,
      organizationId
    };

    const message = `${req.method} ${logPayload.route} ${res.statusCode} (${durationMs}ms)`;

    if (res.statusCode >= 500) {
      logger.error(logPayload, message);
    } else if (res.statusCode >= 400) {
      logger.warn(logPayload, message);
    } else {
      logger.info(logPayload, message);
    }
  });

  next();
}

module.exports = {
  requestIdMiddleware,
  requestLoggingMiddleware,
  redactPhiAndCredentials
};
