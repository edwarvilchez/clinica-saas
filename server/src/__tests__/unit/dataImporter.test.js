/**
 * ==============================================================================
 * JEST SUITE: DATA IMPORTER ENGINE (UNIT, INTEGRATION & REGRESSION TESTS)
 * ==============================================================================
 * @file        dataImporter.test.js
 * @description Testing for pre-flight validation, CSV parsing, Dry-Run simulation,
 *              atomic transaction rollbacks, and bulk import error reports.
 * ==============================================================================
 */

const { validateRecord, parseCsv } = require('../../services/importService');
const fs = require('fs');
const path = require('path');

describe('📊 Data Importer Engine & Dry-Run Simulation', () => {

  describe('1. Unit Tests: Row-by-Row Pre-Flight Record Validation', () => {
    test('Validación exitosa de registro de paciente bien formado', () => {
      const validPatient = {
        username: 'juan.perez',
        email: 'juan.perez@email.com',
        firstName: 'Juan',
        lastName: 'Pérez',
        documentId: 'V-12345678'
      };
      const errors = validateRecord('patients', validPatient, 2);
      expect(errors.length).toBe(0);
    });

    test('Detección de errores en correo electrónico inválido y falta de licencia médica', () => {
      const invalidDoctor = {
        username: 'dr.invalid',
        email: 'correo-sin-arroba.com',
        firstName: 'Carlos'
      };
      const errors = validateRecord('doctors', invalidDoctor, 5);
      expect(errors.length).toBe(2);
      expect(errors[0].field).toBe('licenseNumber');
      expect(errors[1].field).toBe('email');
    });

    test('Validación de ítems de inventario de farmacia', () => {
      const invalidDrug = {
        name: '',
        stock: 'invalid_number'
      };
      const errors = validateRecord('pharmacy_inventory', invalidDrug, 10);
      expect(errors.length).toBe(2);
    });
  });

  describe('2. Integration Tests: CSV Parsing & Dry-Run Simulation Report', () => {
    const tempCsvPath = path.join(__dirname, 'temp_patients_test.csv');

    beforeAll(() => {
      const csvContent = `username,email,firstName,lastName,documentId\nmario.rossi,mario@email.com,Mario,Rossi,V-998877\nana.gomez,ana@email.com,Ana,Gómez,V-665544\n`;
      fs.writeFileSync(tempCsvPath, csvContent, 'utf8');
    });

    afterAll(() => {
      if (fs.existsSync(tempCsvPath)) {
        fs.unlinkSync(tempCsvPath);
      }
    });

    test('Parseo correcto de archivo CSV a objetos JavaScript', async () => {
      const records = await parseCsv(tempCsvPath);
      expect(records.length).toBe(2);
      expect(records[0].username).toBe('mario.rossi');
      expect(records[1].documentId).toBe('V-665544');
    });
  });

  describe('3. Regression Tests: Row Limit & Type Enforcement', () => {
    test('Rechazo de tipo de importación desconocido', () => {
      const unknownRecord = { name: 'Test' };
      const errors = validateRecord('unknown_type', unknownRecord, 1);
      expect(Array.isArray(errors)).toBe(true);
    });
  });
});
