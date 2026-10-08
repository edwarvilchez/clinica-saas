'use strict';

const request = require('supertest');
const express = require('express');
const { isOriginAllowed, createCorsOptions, corsMiddleware } = require('../../middlewares/cors.middleware');

describe('🛡️ FASE 5: CORS Hardening & Dynamic Origin Isolation Suite', () => {
  let app;

  beforeAll(() => {
    app = express();
    // Test app with test configuration
    app.use(corsMiddleware({
      isDevelopment: true,
      isTest: true,
      server: {
        allowedOrigins: ['http://localhost:4200', 'https://staging.clinica.com', 'https://app.clinica.com']
      }
    }));

    app.get('/api/test-cors', (req, res) => {
      res.json({ message: 'CORS check successful', secure: true });
    });

    app.post('/api/test-cors-action', express.json(), (req, res) => {
      res.json({ action: 'executed', payload: req.body });
    });
  });

  describe('1. Explicit Allowlist Validation', () => {
    test('🔒 Allows requests from explicitly permitted origins with credentials enabled', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', 'http://localhost:4200');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.body.secure).toBe(true);
    });

    test('🔒 Allows HTTPS production origin defined in allowlist', async () => {
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', 'https://app.clinica.com');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://app.clinica.com');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    test('🔒 Allows non-browser requests without Origin header (curl, mobile apps, health checks)', async () => {
      const res = await request(app)
        .get('/api/test-cors');

      expect(res.status).toBe(200);
      expect(res.body.secure).toBe(true);
    });
  });

  describe('2. Malicious and Untrusted Origin Blocking', () => {
    test('🔒 Strictly rejects untrusted origins with 403 Forbidden', async () => {
      const untrustedOrigin = 'https://malicious-attacker-site.com';
      const res = await request(app)
        .get('/api/test-cors')
        .set('Origin', untrustedOrigin);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CORS_ORIGIN_DENIED');
      // Must NOT reflect the untrusted origin in Allow-Origin
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('🔒 Blocks state-changing POST requests from unauthorized origins before executing controller', async () => {
      const res = await request(app)
        .post('/api/test-cors-action')
        .set('Origin', 'https://evil-phishing-domain.net')
        .send({ sensitiveAction: 'deletePatientData' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CORS_ORIGIN_DENIED');
      expect(res.body.action).toBeUndefined(); // Controller was never executed
    });

    test('🔒 Blocks preflight OPTIONS requests from unauthorized origins', async () => {
      const res = await request(app)
        .options('/api/test-cors')
        .set('Origin', 'https://evil-site.org')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CORS_ORIGIN_DENIED');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('🔒 Successfully handles valid preflight OPTIONS requests for allowed origins', async () => {
      const res = await request(app)
        .options('/api/test-cors')
        .set('Origin', 'https://app.clinica.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('https://app.clinica.com');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('3. Production vs Development Origin Separation', () => {
    let prodApp;

    beforeAll(() => {
      prodApp = express();
      // Strict production setup: isDevelopment = false, isTest = false
      prodApp.use(corsMiddleware({
        isDevelopment: false,
        isTest: false,
        server: {
          allowedOrigins: ['https://app.clinica.com']
        }
      }));

      prodApp.get('/api/production-resource', (req, res) => {
        res.json({ production: true });
      });
    });

    test('🔒 Production mode BLOCKS localhost even if it was acceptable in development', async () => {
      const res = await request(prodApp)
        .get('/api/production-resource')
        .set('Origin', 'http://localhost:4200');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CORS_ORIGIN_DENIED');
    });

    test('🔒 Production mode ALLOWS configured production origin', async () => {
      const res = await request(prodApp)
        .get('/api/production-resource')
        .set('Origin', 'https://app.clinica.com');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://app.clinica.com');
    });

    test('🔒 Production mode rejects subdomain prefix/suffix spoofing attempts', async () => {
      const spoof1 = 'https://app.clinica.com.attacker.com';
      const spoof2 = 'https://notapp.clinica.com';

      const res1 = await request(prodApp)
        .get('/api/production-resource')
        .set('Origin', spoof1);
      expect(res1.status).toBe(403);

      const res2 = await request(prodApp)
        .get('/api/production-resource')
        .set('Origin', spoof2);
      expect(res2.status).toBe(403);
    });
  });

  describe('4. isOriginAllowed Unit Verification', () => {
    test('Correctly identifies allowed and disallowed origins', () => {
      const allowed = ['https://clinica.com', 'https://staging.clinica.com'];

      // Production / strict mode
      expect(isOriginAllowed('https://clinica.com', allowed, false)).toBe(true);
      expect(isOriginAllowed('https://staging.clinica.com', allowed, false)).toBe(true);
      expect(isOriginAllowed('http://localhost:4200', allowed, false)).toBe(false);
      expect(isOriginAllowed('https://evil.com', allowed, false)).toBe(false);
      expect(isOriginAllowed(undefined, allowed, false)).toBe(true); // server-to-server

      // Dev mode
      expect(isOriginAllowed('http://localhost:4200', allowed, true)).toBe(true);
      expect(isOriginAllowed('http://127.0.0.1:4200', allowed, true)).toBe(true);
      expect(isOriginAllowed('http://localhost:3000', allowed, true)).toBe(true);
      expect(isOriginAllowed('https://evil.com', allowed, true)).toBe(false);
    });
  });
});
