'use strict';

const request = require('supertest');
const express = require('express');
const healthService = require('../../services/health.service');
const healthRoutes = require('../../routes/health.routes');
const { requestIdMiddleware, requestLoggingMiddleware } = require('../../middlewares/observability.middleware');

describe('🛡️ FASE 10: Rigorous Health Checks & Orchestrator Probes Security Suite', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use(requestLoggingMiddleware);

    // Mount on standard /health and API /api/health paths
    app.use('/health', healthRoutes);
    app.use('/api/health', healthRoutes);
  });

  // =========================================================================
  // 1. LIVENESS PROBE (PROCESS & EVENT LOOP HEALTH)
  // =========================================================================
  describe('1. Liveness Probe (GET /health/live & /api/health/live)', () => {
    test('🔒 /health/live retorna 200 UP con uptime y métricas de memoria', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.service).toBe('clinica-saas-server');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.memory).toBeDefined();
      expect(typeof res.body.memory.heapUsedMB).toBe('number');
      expect(typeof res.body.memory.rssMB).toBe('number');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    test('🔒 /api/health/live responde idéntico bajo ruta API', async () => {
      const res = await request(app).get('/api/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // =========================================================================
  // 2. READINESS PROBE (HEALTHY STATE)
  // =========================================================================
  describe('2. Readiness Probe (GET /health/ready) - Estado Saludable', () => {
    test('🔒 /health/ready retorna 200 READY con ping a PostgreSQL y Storage verificado', async () => {
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('READY');
      expect(res.body.isReady).toBe(true);

      // Database check
      expect(res.body.checks.database).toBeDefined();
      expect(res.body.checks.database.status).toBe('UP');
      expect(typeof res.body.checks.database.latencyMs).toBe('number');
      expect(res.body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);

      // Storage check
      expect(res.body.checks.storage).toBeDefined();
      expect(res.body.checks.storage.status).toBe('UP');
      expect(res.body.checks.storage.driver).toBeDefined();

      // Cache / Redis check (DISABLED or UP)
      expect(res.body.checks.cache).toBeDefined();
      expect(['UP', 'DISABLED']).toContain(res.body.checks.cache.status);
    });

    test('🔒 /api/health/ready propaga X-Request-ID y responde 200 READY', async () => {
      const customId = 'orchestrator-k8s-probe-1002';
      const res = await request(app)
        .get('/api/health/ready')
        .set('X-Request-ID', customId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customId);
      expect(res.body.isReady).toBe(true);
    });
  });

  // =========================================================================
  // 3. READINESS PROBE - FAILURE SIMULATION (503 SERVICE UNAVAILABLE)
  // =========================================================================
  describe('3. Readiness Probe - Detección de Fallas Críticas (HTTP 503)', () => {
    test('🚨 Retorna 503 NOT_READY si la base de datos PostgreSQL no responde (simulando corte de conexión)', async () => {
      // Mock checkDatabaseHealth failure
      const originalDbCheck = healthService.checkDatabaseHealth;
      healthService.checkDatabaseHealth = jest.fn().mockResolvedValue({
        status: 'DOWN',
        latencyMs: 3000,
        error: 'SequelizeConnectionRefusedError: connect ECONNREFUSED 127.0.0.1:5432'
      });

      try {
        const res = await request(app).get('/health/ready');

        expect(res.status).toBe(503);
        expect(res.body.status).toBe('NOT_READY');
        expect(res.body.isReady).toBe(false);
        expect(res.body.checks.database.status).toBe('DOWN');
        expect(res.body.checks.database.error).toContain('ECONNREFUSED');
      } finally {
        healthService.checkDatabaseHealth = originalDbCheck;
      }
    });

    test('🚨 Retorna 503 NOT_READY si el almacenamiento de archivos falla en permisos de I/O', async () => {
      // Mock checkStorageHealth failure
      const originalStorageCheck = healthService.checkStorageHealth;
      healthService.checkStorageHealth = jest.fn().mockResolvedValue({
        status: 'DOWN',
        driver: 'local',
        error: 'EACCES: permission denied, access /secure/storage'
      });

      try {
        const res = await request(app).get('/health/ready');

        expect(res.status).toBe(503);
        expect(res.body.status).toBe('NOT_READY');
        expect(res.body.isReady).toBe(false);
        expect(res.body.checks.storage.status).toBe('DOWN');
      } finally {
        healthService.checkStorageHealth = originalStorageCheck;
      }
    });
  });

  // =========================================================================
  // 4. SUMMARY / BACKWARD COMPATIBLE ROUTE
  // =========================================================================
  describe('4. Resumen Consolidado (GET /health y /api/health)', () => {
    test('🔒 /api/health retorna resumen consolidado de liveness y readiness', async () => {
      const res = await request(app).get('/api/health');

      expect([200, 503]).toContain(res.status);
      expect(res.body.status).toBeDefined();
      expect(res.body.service).toBe('clinica-saas-server');
      expect(res.body.readiness).toBeDefined();
      expect(res.body.readiness.checks).toBeDefined();
    });
  });
});
