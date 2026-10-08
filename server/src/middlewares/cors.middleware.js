'use strict';

const cors = require('cors');
const appConfig = require('../config/app.config');

/**
 * Evaluates whether an incoming Origin is permitted under the active CORS policy.
 * 
 * @param {string|undefined} origin - The Origin header from the incoming request.
 * @param {string[]} allowedOrigins - The list of explicitly configured origins.
 * @param {boolean} isDevelopment - Flag indicating if dev/test local relaxed checks apply.
 * @returns {boolean} True if origin is allowed, false otherwise.
 */
function isOriginAllowed(origin, allowedOrigins = [], isDevelopment = false) {
  // Same-origin, mobile native apps, curl, server-to-server or health-check monitors send no Origin header
  if (!origin) {
    return true;
  }

  // Exact match against explicitly configured allowlist
  if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
    return true;
  }

  // In development and test environments, allow standard localhost / 127.0.0.1 ports
  if (isDevelopment) {
    const devLocalRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    if (devLocalRegex.test(origin)) {
      return true;
    }
  }

  return false;
}

/**
 * Creates Express CORS configuration options.
 *
 * @param {object} config - App configuration object.
 * @returns {object} CORS options for cors middleware.
 */
function createCorsOptions(config = appConfig) {
  const allowedOrigins = config?.server?.allowedOrigins || [];
  const isDev = Boolean(config?.isDevelopment || config?.isTest);

  return {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins, isDev)) {
        return callback(null, true);
      }

      const corsError = new Error(`CORS policy violation: Origin '${origin}' is not permitted.`);
      corsError.name = 'CorsSecurityError';
      corsError.status = 403;
      return callback(corsError, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-auth-token',
      'x-org-id',
      'Accept',
      'X-Request-ID'
    ],
    exposedHeaders: ['x-auth-token', 'X-Request-ID'],
    maxAge: 86400, // 24 hours preflight cache
    optionsSuccessStatus: 204
  };
}

/**
 * Express middleware wrapper that intercepts CORS policy rejections
 * and responds immediately with 403 Forbidden to prevent downstream execution.
 */
function corsMiddleware(customConfig = appConfig) {
  const corsHandler = cors(createCorsOptions(customConfig));

  return (req, res, next) => {
    corsHandler(req, res, (err) => {
      if (err) {
        return res.status(403).json({
          error: 'CORS_ORIGIN_DENIED',
          message: 'Cross-Origin Request Blocked: Origin is not permitted by CORS policy.',
          origin: req.headers.origin || null
        });
      }
      next();
    });
  };
}

module.exports = {
  isOriginAllowed,
  createCorsOptions,
  corsMiddleware
};
