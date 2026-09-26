/**
 * ==============================================================================
 * JEST SUITE: TENANT POSTGRESQL TEMPLATE ORCHESTRATOR
 * ==============================================================================
 * @file        tenantOrchestrator.test.js
 * @description Unit, integration, and regression tests for atomic PostgreSQL database
 *              cloning using CREATE DATABASE ... TEMPLATE syntax.
 * ==============================================================================
 */

const tenantOrchestrator = require('../../services/tenantOrchestrator.service');

describe('⚡ PostgreSQL TEMPLATE Tenant Database Orchestrator', () => {

  describe('1. Unit Tests: Database Name Sanitization & Slugification', () => {
    test('Sanitización correcta de nombres con acentos y caracteres especiales', () => {
      const sanitized = tenantOrchestrator.sanitizeDbName('Clínica San Francisco 2026!');
      expect(sanitized).toBe('tenant_clinica_san_francisco_2026_db');
    });

    test('Manejo de nombres de hospital con espacios múltiples y guiones', () => {
      const sanitized = tenantOrchestrator.sanitizeDbName('   Centro  Médico -  Occidente   ');
      expect(sanitized).toBe('tenant_centro_medico_occidente_db');
    });

    test('Lanzamiento de excepción si el nombre del tenant está vacío', () => {
      expect(() => {
        tenantOrchestrator.sanitizeDbName('');
      }).toThrow('El nombre de la clínica/tenant es inválido');
    });
  });

  describe('2. Integration & Regression Tests: Atomic Provisioning & Idempotency', () => {
    test('Aprovisionamiento de nueva base de datos o detección de existencia', async () => {
      const result = await tenantOrchestrator.provisionTenantDatabase({
        tenantName: 'Clínica Demo Jest',
        ownerEmail: 'demo@clinicasaas.com',
        planType: 'CLINIC'
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.databaseName).toBe('tenant_clinica_demo_jest_db');
      expect(typeof result.executionTimeMs).toBe('number');
    });

    test('Regresión: Idempotencia en invocación repetida sin duplicidad de error', async () => {
      const resultRepeat = await tenantOrchestrator.provisionTenantDatabase({
        tenantName: 'Clínica Demo Jest',
        ownerEmail: 'demo@clinicasaas.com',
        planType: 'CLINIC'
      });

      expect(resultRepeat.success).toBe(true);
      expect(resultRepeat.alreadyExisted).toBe(true);
      expect(resultRepeat.databaseName).toBe('tenant_clinica_demo_jest_db');
    });
  });
});
