'use strict';

const helmet = require('helmet');
const appConfig = require('../config/app.config');

/**
 * Builds robust Content-Security-Policy (CSP) directives tailored for
 * Angular SPA, Socket.io / WebRTC video signaling, and API security.
 *
 * @param {object} config - Application configuration object.
 * @returns {object} Directives dictionary for Helmet CSP.
 */
function buildCspDirectives(config = appConfig) {
  const allowedOrigins = Array.isArray(config?.server?.allowedOrigins)
    ? config.server.allowedOrigins
    : [];
  const isDevOrTest = Boolean(config?.isDevelopment || config?.isTest);

  // Connection targets: self, websockets, plus all configured allowed origins
  const connectSrc = ["'self'", 'ws:', 'wss:', ...allowedOrigins];
  if (isDevOrTest) {
    if (!connectSrc.includes('http://localhost:*')) connectSrc.push('http://localhost:*');
    if (!connectSrc.includes('ws://localhost:*')) connectSrc.push('ws://localhost:*');
  }

  // Scripts: self, jsdelivr (bootstrap-icons/dependencies), and dev-only eval for Angular source maps
  const scriptSrc = ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'];
  if (isDevOrTest) {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    objectSrc: ["'none'"],
    scriptSrc,
    scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
    connectSrc,
    mediaSrc: ["'self'", 'blob:', 'mediastream:'],
    // Upgrade insecure requests only in production/staging environments
    upgradeInsecureRequests: isDevOrTest ? null : []
  };

  return directives;
}

/**
 * Creates Helmet options configured with enterprise-grade security headers:
 * - Content-Security-Policy (CSP)
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: SAMEORIGIN
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Cross-Origin-Resource-Policy: cross-origin
 * - Cross-Origin-Opener-Policy: same-origin
 *
 * @param {object} config - Application configuration object.
 * @returns {object} Helmet configuration dictionary.
 */
function createHelmetOptions(config = appConfig) {
  const isProd = Boolean(config?.isProduction);

  return {
    contentSecurityPolicy: {
      directives: buildCspDirectives(config)
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: isProd
    },
    frameguard: {
      action: 'sameorigin'
    },
    xContentTypeOptions: true,
    xXssProtection: true
  };
}

/**
 * Express middleware returning Helmet configured with hardened security policies.
 *
 * @param {object} customConfig - Optional custom configuration for testing.
 * @returns {Function} Express middleware handler.
 */
function securityHeadersMiddleware(customConfig = appConfig) {
  return helmet(createHelmetOptions(customConfig));
}

module.exports = {
  buildCspDirectives,
  createHelmetOptions,
  securityHeadersMiddleware
};
