/**
 * ==============================================================================
 * JEST SUITE: MEDICUSVE CREWAI AUTONOMOUS AGENTS (DEV & SECURITY AUDITOR)
 * ==============================================================================
 * @file        crewaiEngine.test.js
 * @description Unit, integration, and regression tests for automated module
 *              scaffolding and HIPAA/RLS security auditing in Medicusve.
 * ==============================================================================
 */

const crewaiCopilot = require('../../utils/crewaiCopilot.service');

describe('🤖 Medicusve CrewAI Autonomous Agents (Dev & Security Auditor)', () => {

  describe('1. Unit Tests: Developer Agent Module Scaffolding', () => {
    test('Generación exitosa de código de manifiesto y rutas para un nuevo módulo Medicusve', async () => {
      const scaffold = await crewaiCopilot.generateModuleScaffold(
        'odontology',
        'Módulo de Odontología Medicusve',
        'Gestión de piezas dentales e historial odontológico',
        ['base', 'medical_records']
      );

      expect(scaffold).toBeDefined();
      expect(scaffold.success).toBe(true);
      expect(scaffold.moduleSlug).toBe('odontology');
      expect(scaffold.manifestCode).toContain("name: 'Módulo de Odontología Medicusve'");
      expect(scaffold.manifestCode).toContain("category: 'Medicusve/Custom'");
      expect(scaffold.routesCode).toContain("module: 'odontology'");
    });

    test('Lanzamiento de error si el slug o nombre del módulo está ausente', async () => {
      await expect(crewaiCopilot.generateModuleScaffold('', '')).rejects.toThrow('Nombre y slug del módulo son requeridos');
    });
  });

  describe('2. Integration Tests: Security Auditor Agent RLS & Compliance Evaluation', () => {
    test('Auditoría de matriz de seguridad con 100% de cumplimiento en Medicusve', async () => {
      const mockManifest = { name: 'Módulo Odontología', version: '1.0.0' };
      const validPermissions = [
        { role: 'DOCTOR', model: 'OdontologyRecord', perm_read: true, perm_write: true },
        { role: 'PATIENT', model: 'OdontologyRecord', perm_read: true, perm_write: false }
      ];

      const report = await crewaiCopilot.auditSecurityMatrix(mockManifest, validPermissions);

      expect(report.passed).toBe(true);
      expect(report.complianceScore).toBe(100);
      expect(report.violations.length).toBe(0);
      expect(report.auditedBy).toContain('Medicusve Safeguard');
    });
  });

  describe('3. Regression Tests: HIPAA / RLS Security Violations Detection', () => {
    test('Detección y rechazo de violación HIPAA (Permiso de escritura no autorizado a Paciente)', async () => {
      const mockManifest = { name: 'Módulo Laboratorio', version: '1.0.0' };
      const invalidPermissions = [
        { role: 'PATIENT', model: 'MedicalRecord', perm_read: true, perm_write: true } // VIOLATION!
      ];

      const report = await crewaiCopilot.auditSecurityMatrix(mockManifest, invalidPermissions);

      expect(report.passed).toBe(false);
      expect(report.complianceScore).toBeLessThan(100);
      expect(report.violations[0]).toContain('Violación de HIPAA/Medicusve');
    });
  });
});
