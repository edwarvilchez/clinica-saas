'use strict';

const request = require('supertest');
const express = require('express');
const {
  buildCspDirectives,
  createHelmetOptions,
  securityHeadersMiddleware
} = require('../../middlewares/securityHeaders.middleware');

describe('🛡️ FASE 5: Security Headers & Content-Security-Policy (CSP) Suite', () => {
  describe('1. CSP Directives Configuration', () => {
    it('🔒 Builds Angular-compliant CSP directives for development/test environment', () => {
      const config = {
        isDevelopment: true,
        isTest: true,
        isProduction: false,
        server: {
          allowedOrigins: ['http://localhost:4200', 'https://staging.clinica.com']
        }
      };

      const directives = buildCspDirectives(config);

      expect(directives.defaultSrc).toContain("'self'");
      expect(directives.scriptSrc).toContain("'self'");
      expect(directives.scriptSrc).toContain("'unsafe-inline'");
      expect(directives.scriptSrc).toContain("'unsafe-eval'");
      expect(directives.scriptSrc).toContain('https://cdn.jsdelivr.net');

      expect(directives.styleSrc).toContain("'self'");
      expect(directives.styleSrc).toContain("'unsafe-inline'");
      expect(directives.styleSrc).toContain('https://cdn.jsdelivr.net');
      expect(directives.styleSrc).toContain('https://fonts.googleapis.com');

      expect(directives.fontSrc).toContain("'self'");
      expect(directives.fontSrc).toContain('data:');
      expect(directives.fontSrc).toContain('https://cdn.jsdelivr.net');
      expect(directives.fontSrc).toContain('https://fonts.gstatic.com');

      expect(directives.imgSrc).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:', 'https:']));
      expect(directives.mediaSrc).toEqual(expect.arrayContaining(["'self'", 'blob:', 'mediastream:']));

      expect(directives.connectSrc).toContain("'self'");
      expect(directives.connectSrc).toContain('ws:');
      expect(directives.connectSrc).toContain('wss:');
      expect(directives.connectSrc).toContain('https://staging.clinica.com');

      expect(directives.frameAncestors).toContain("'self'");
      expect(directives.objectSrc).toContain("'none'");
      // Development should NOT enforce upgrade-insecure-requests on localhost
      expect(directives.upgradeInsecureRequests).toBeNull();
    });

    it('🔒 Builds hardened CSP directives for production environment', () => {
      const config = {
        isDevelopment: false,
        isTest: false,
        isProduction: true,
        server: {
          allowedOrigins: ['https://app.clinicasaas.com']
        }
      };

      const directives = buildCspDirectives(config);

      // In production, unsafe-eval MUST be omitted
      expect(directives.scriptSrc).not.toContain("'unsafe-eval'");
      expect(directives.scriptSrc).toContain("'self'");
      expect(directives.scriptSrc).toContain('https://cdn.jsdelivr.net');

      // Production enforces upgrade-insecure-requests
      expect(directives.upgradeInsecureRequests).toEqual([]);

      // Allowed origins properly wired to connectSrc
      expect(directives.connectSrc).toContain('https://app.clinicasaas.com');
      expect(directives.connectSrc).not.toContain('http://localhost:*');
    });
  });

  describe('2. Helmet Configuration Structure', () => {
    it('🔒 Produces valid helmet configuration adhering to Phase 5 specifications', () => {
      const config = {
        isProduction: true,
        server: { allowedOrigins: ['https://app.clinicasaas.com'] }
      };

      const options = createHelmetOptions(config);

      expect(options.contentSecurityPolicy).toBeDefined();
      expect(options.referrerPolicy).toEqual({ policy: 'strict-origin-when-cross-origin' });
      expect(options.crossOriginResourcePolicy).toEqual({ policy: 'cross-origin' });
      expect(options.crossOriginOpenerPolicy).toEqual({ policy: 'same-origin' });
      expect(options.frameguard).toEqual({ action: 'sameorigin' });
      expect(options.xContentTypeOptions).toBe(true);
      expect(options.hsts).toMatchObject({
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      });
    });
  });

  describe('3. HTTP Response Headers via Middleware', () => {
    let app;

    beforeAll(() => {
      app = express();
      app.use(securityHeadersMiddleware({
        isDevelopment: true,
        isTest: true,
        isProduction: false,
        server: {
          allowedOrigins: ['http://localhost:4200']
        }
      }));

      app.get('/api/test-headers', (req, res) => {
        res.json({ status: 'ok', secure: true });
      });
    });

    it('🔒 Emits Content-Security-Policy header with expected directives', async () => {
      const res = await request(app).get('/api/test-headers');

      expect(res.status).toBe(200);
      const csp = res.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('https://cdn.jsdelivr.net');
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).toContain('blob:');
      expect(csp).toContain('mediastream:');
    });

    it('🔒 Emits X-Content-Type-Options: nosniff header', async () => {
      const res = await request(app).get('/api/test-headers');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('🔒 Emits X-Frame-Options: SAMEORIGIN header to prevent Clickjacking', async () => {
      const res = await request(app).get('/api/test-headers');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('🔒 Emits Referrer-Policy: strict-origin-when-cross-origin header', async () => {
      const res = await request(app).get('/api/test-headers');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('🔒 Emits Cross-Origin-Resource-Policy: cross-origin header', async () => {
      const res = await request(app).get('/api/test-headers');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it('🔒 Emits Cross-Origin-Opener-Policy: same-origin header', async () => {
      const res = await request(app).get('/api/test-headers');
      expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    });

    it('🔒 Does not leak X-Powered-By header', async () => {
      const res = await request(app).get('/api/test-headers');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});
