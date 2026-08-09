/**
 * ==============================================================================
 * JEST SUITE: ODOO-STYLE ENGINE (UNIT, INTEGRATION & REGRESSION TESTS)
 * ==============================================================================
 * @file        odooEngine.test.js
 * @description Comprehensive testing for manifest validation, dependency graphs,
 *              dynamic discovery, and Express route mounting.
 * ==============================================================================
 */

const manifestValidator = require('../../engine/manifestValidator');
const moduleLoader = require('../../engine/moduleLoader');
const express = require('express');
const request = require('supertest');

describe('⚙️ Odoo-Style Framework Engine', () => {

  describe('1. Unit Tests: Manifest Validation & Topological Dependency Sorting', () => {
    test('Validación de manifiesto válido con valores por defecto', () => {
      const rawManifest = {
        name: 'Test Addon',
        version: '1.2.0',
        summary: 'Módulo de prueba unitaria'
      };
      const validated = manifestValidator.validateManifest(rawManifest, '/tmp/test_addon');
      expect(validated.name).toBe('Test Addon');
      expect(validated.version).toBe('1.2.0');
      expect(validated.category).toBe('Uncategorized');
      expect(validated.depends).toEqual(['base']);
      expect(validated.installable).toBe(true);
    });

    test('Lanzamiento de error si faltan campos obligatorios en el manifiesto', () => {
      const invalidManifest = {
        version: '1.0.0'
      };
      expect(() => {
        manifestValidator.validateManifest(invalidManifest, '/tmp/invalid');
      }).toThrow('Missing required field "name"');
    });

    test('Ordenamiento topológico de dependencias sin ciclos', () => {
      const modulesMap = new Map();
      modulesMap.set('addon_c', { name: 'Addon C', depends: ['addon_b'] });
      modulesMap.set('addon_a', { name: 'Addon A', depends: ['base'] });
      modulesMap.set('addon_b', { name: 'Addon B', depends: ['addon_a'] });

      const sorted = manifestValidator.resolveDependencyGraph(modulesMap);
      expect(sorted).toEqual(['addon_a', 'addon_b', 'addon_c']);
    });
  });

  describe('2. Regression Tests: Detection of Circular & Missing Dependencies', () => {
    test('Detección y rechazo de dependencia circular (A -> B -> A)', () => {
      const circularMap = new Map();
      circularMap.set('addon_a', { name: 'Addon A', depends: ['addon_b'] });
      circularMap.set('addon_b', { name: 'Addon B', depends: ['addon_a'] });

      expect(() => {
        manifestValidator.resolveDependencyGraph(circularMap);
      }).toThrow('Circular dependency detected');
    });

    test('Detección y rechazo de módulos dependientes no instalados o faltantes', () => {
      const missingDepMap = new Map();
      missingDepMap.set('addon_x', { name: 'Addon X', depends: ['non_existent_addon'] });

      expect(() => {
        manifestValidator.resolveDependencyGraph(missingDepMap);
      }).toThrow('Missing required dependency module: "non_existent_addon"');
    });
  });

  describe('3. Integration Tests: Dynamic Addon Discovery & Express Route Mounting', () => {
    let app;

    beforeAll(() => {
      app = express();
    });

    test('Descubrimiento dinámico y montaje del módulo "sample_addon"', async () => {
      const report = await moduleLoader.loadAllModules(app);
      expect(report.totalLoaded).toBeGreaterThanOrEqual(1);
      expect(report.order).toContain('sample_addon');

      const res = await request(app).get('/api/v1/addons/sample_addon/ping');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.module).toBe('sample_addon');
    });
  });
});
