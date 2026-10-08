'use strict';

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const {
  requestIdMiddleware,
  requestLoggingMiddleware,
  redactPhiAndCredentials
} = require('../../middlewares/observability.middleware');

describe('🛡️ FASE 9: Logging Estructurado, Observabilidad & Cero PHI Security Suite', () => {
  let app;
  let loggedEvents = [];

  beforeAll(() => {
    // Express test app instrumented with Observability pipeline
    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use(requestLoggingMiddleware);

    // Mock routes
    app.get('/api/test-ok', (req, res) => {
      res.status(200).json({ ok: true, id: req.id });
    });

    app.get('/api/test-client-error', (req, res) => {
      res.status(404).json({ error: 'Recurso no encontrado' });
    });

    app.get('/api/test-server-error', (req, res) => {
      res.status(500).json({ error: 'Fallo interno simulado' });
    });

    // Authenticated context simulation route
    app.get('/api/test-authenticated', (req, res) => {
      req.user = {
        id: 'usr-secure-uuid-1234',
        role: 'DOCTOR',
        organizationId: 'org-tenant-uuid-5678'
      };
      res.status(200).json({ authenticated: true });
    });
  });

  // =========================================================================
  // 1. X-REQUEST-ID GENERATION & PROPAGATION
  // =========================================================================
  describe('1. X-Request-ID Generación y Propagación', () => {
    test('🔒 Genera un UUID v4 criptográfico si la petición no incluye X-Request-ID', async () => {
      const res = await request(app).get('/api/test-ok');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();

      const requestId = res.headers['x-request-id'];
      // Standard UUID v4 regex format
      expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(res.body.id).toBe(requestId);
    });

    test('🔒 Respeta y propaga un X-Request-ID válido provisto por cliente o API gateway', async () => {
      const customTraceId = 'gateway-trace-98765-production-edge';

      const res = await request(app)
        .get('/api/test-ok')
        .set('X-Request-ID', customTraceId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customTraceId);
      expect(res.body.id).toBe(customTraceId);
    });

    test('🔒 Genera nuevo UUID si el X-Request-ID provisto contiene caracteres inválidos o inseguros', async () => {
      const maliciousId = 'invalid<script>alert(1)</script>';

      const res = await request(app)
        .get('/api/test-ok')
        .set('X-Request-ID', maliciousId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).not.toBe(maliciousId);
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  // =========================================================================
  // 2. ZERO PHI & CREDENTIAL REDACTION
  // =========================================================================
  describe('2. Redacción Automática de PHI y Credenciales (Zero PHI in Logs)', () => {
    test('🔒 Redacta contraseñas, tokens y claves 2FA en objetos planos', () => {
      const sensitiveData = {
        username: 'dr_garcia',
        email: 'dr_garcia@clinica.com',
        password: 'SuperSecretPassword123!',
        newPassword: 'BrandNewPassword2026!',
        currentPassword: 'OldPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: '4e62e20abcdef123456...',
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
        recoveryCodes: ['ABCD-1234', 'EFGH-5678'],
        authorization: 'Bearer secret_token_value'
      };

      const redacted = redactPhiAndCredentials(sensitiveData);

      expect(redacted.username).toBe('dr_garcia');
      expect(redacted.email).toBe('dr_garcia@clinica.com');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.newPassword).toBe('[REDACTED]');
      expect(redacted.currentPassword).toBe('[REDACTED]');
      expect(redacted.token).toBe('[REDACTED]');
      expect(redacted.refreshToken).toBe('[REDACTED]');
      expect(redacted.twoFactorSecret).toBe('[REDACTED]');
      expect(redacted.recoveryCodes).toBe('[REDACTED]');
      expect(redacted.authorization).toBe('[REDACTED]');
    });

    test('🔒 Redacta datos de salud protegidos (PHI): diagnósticos, cédulas, historias clínicas y alergias', () => {
      const phiRecord = {
        patientName: 'Juan Pérez',
        documentId: 'V12345678',
        dni: '12345678',
        medicalRecordNumber: 'MED-9988',
        diagnosis: 'Hipertensión arterial estadio 2 con cardiopatía',
        clinicalHistorySummary: 'Cirugía de apéndice en 2018, asma severa',
        allergies: 'Penicilina, Sulfas',
        notes: 'Paciente refiere dolor torácico recurrente',
        appointmentDate: '2026-10-15T14:00:00Z'
      };

      const redacted = redactPhiAndCredentials(phiRecord);

      expect(redacted.patientName).toBe('Juan Pérez');
      expect(redacted.appointmentDate).toBe('2026-10-15T14:00:00Z');
      expect(redacted.documentId).toBe('[REDACTED]');
      expect(redacted.dni).toBe('[REDACTED]');
      expect(redacted.medicalRecordNumber).toBe('[REDACTED]');
      expect(redacted.diagnosis).toBe('[REDACTED]');
      expect(redacted.clinicalHistorySummary).toBe('[REDACTED]');
      expect(redacted.allergies).toBe('[REDACTED]');
      expect(redacted.notes).toBe('[REDACTED]');
    });

    test('🔒 Redacta estructuras profundamente anidadas y arreglos complejos', () => {
      const nestedPayload = {
        consultation: {
          id: 'cons-123',
          patient: {
            id: 'pat-456',
            documentId: 'V87654321',
            medicalHistory: {
              allergies: 'Ibuprofeno',
              diagnosis: 'Diabetes Mellitus Tipo 2'
            }
          },
          prescriptions: [
            {
              drug: 'Metformina 850mg',
              notes: 'Tomar cada 12 horas con las comidas'
            }
          ]
        }
      };

      const redacted = redactPhiAndCredentials(nestedPayload);

      expect(redacted.consultation.id).toBe('cons-123');
      expect(redacted.consultation.patient.id).toBe('pat-456');
      expect(redacted.consultation.patient.documentId).toBe('[REDACTED]');
      expect(redacted.consultation.patient.medicalHistory.allergies).toBe('[REDACTED]');
      expect(redacted.consultation.patient.medicalHistory.diagnosis).toBe('[REDACTED]');
      expect(redacted.consultation.prescriptions[0].drug).toBe('Metformina 850mg');
      expect(redacted.consultation.prescriptions[0].notes).toBe('[REDACTED]');
    });

    test('🔒 Maneja de forma segura referencias circulares sin desbordar la pila de llamadas (stack overflow)', () => {
      const circularObj = { name: 'Dr. Test', password: 'SecretPassword!' };
      circularObj.self = circularObj;

      const redacted = redactPhiAndCredentials(circularObj);

      expect(redacted.name).toBe('Dr. Test');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.self).toBe('[CIRCULAR]');
    });

    test('🔒 Configuración de Pino incluye lista exhaustiva de rutas de redacción (REDACTION_PATHS)', () => {
      expect(logger.REDACTION_PATHS).toBeDefined();
      expect(Array.isArray(logger.REDACTION_PATHS)).toBe(true);

      const requiredPaths = [
        'password',
        '*.password',
        'token',
        '*.token',
        'twoFactorSecret',
        'authorization',
        'documentId',
        'diagnosis'
      ];

      requiredPaths.forEach(path => {
        expect(logger.REDACTION_PATHS).toContain(path);
      });
    });
  });

  // =========================================================================
  // 3. STRUCTURED LOGGING PIPELINE INTEGRATION
  // =========================================================================
  describe('3. Integración del Pipeline de Observabilidad HTTP', () => {
    let originalInfo;
    let originalWarn;
    let originalError;
    let capturedLogs;

    beforeEach(() => {
      capturedLogs = [];
      originalInfo = logger.info;
      originalWarn = logger.warn;
      originalError = logger.error;

      logger.info = jest.fn((payload, msg) => {
        capturedLogs.push({ level: 'info', payload, msg });
      });
      logger.warn = jest.fn((payload, msg) => {
        capturedLogs.push({ level: 'warn', payload, msg });
      });
      logger.error = jest.fn((payload, msg) => {
        capturedLogs.push({ level: 'error', payload, msg });
      });
    });

    afterEach(() => {
      logger.info = originalInfo;
      logger.warn = originalWarn;
      logger.error = originalError;
    });

    test('🔒 Registra peticiones exitosas (200) con nivel INFO y métricas completas', async () => {
      const res = await request(app).get('/api/test-ok');

      expect(res.status).toBe(200);
      expect(logger.info).toHaveBeenCalled();

      const logEntry = capturedLogs.find(l => l.level === 'info' && l.payload?.route === '/api/test-ok');
      expect(logEntry).toBeDefined();
      expect(logEntry.payload.requestId).toBe(res.headers['x-request-id']);
      expect(logEntry.payload.method).toBe('GET');
      expect(logEntry.payload.status).toBe(200);
      expect(typeof logEntry.payload.durationMs).toBe('number');
      expect(logEntry.payload.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('🔒 Registra errores de cliente (404) con nivel WARN', async () => {
      const res = await request(app).get('/api/test-client-error');

      expect(res.status).toBe(404);
      expect(logger.warn).toHaveBeenCalled();

      const logEntry = capturedLogs.find(l => l.level === 'warn' && l.payload?.route === '/api/test-client-error');
      expect(logEntry).toBeDefined();
      expect(logEntry.payload.status).toBe(404);
      expect(logEntry.payload.requestId).toBe(res.headers['x-request-id']);
    });

    test('🔒 Registra errores de servidor (500) con nivel ERROR', async () => {
      const res = await request(app).get('/api/test-server-error');

      expect(res.status).toBe(500);
      expect(logger.error).toHaveBeenCalled();

      const logEntry = capturedLogs.find(l => l.level === 'error' && l.payload?.route === '/api/test-server-error');
      expect(logEntry).toBeDefined();
      expect(logEntry.payload.status).toBe(500);
      expect(logEntry.payload.requestId).toBe(res.headers['x-request-id']);
    });

    test('🔒 Vincula contexto de usuario y organización cuando la sesión está autenticada', async () => {
      const res = await request(app).get('/api/test-authenticated');

      expect(res.status).toBe(200);
      const logEntry = capturedLogs.find(l => l.payload?.route === '/api/test-authenticated');

      expect(logEntry).toBeDefined();
      expect(logEntry.payload.userId).toBe('usr-secure-uuid-1234');
      expect(logEntry.payload.role).toBe('DOCTOR');
      expect(logEntry.payload.organizationId).toBe('org-tenant-uuid-5678');
    });
  });
});
