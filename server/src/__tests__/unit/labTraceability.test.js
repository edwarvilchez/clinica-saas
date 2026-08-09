/**
 * ==============================================================================
 * JEST SUITE: MEDICUSVE LAB ORDERS & SAMPLE TRACEABILITY ENGINE
 * ==============================================================================
 * @file        labTraceability.test.js
 * @description Unit, integration, and regression tests for express lab orders,
 *              sample barcode generation, and sample status lifecycle tracking.
 * ==============================================================================
 */

const sequelize = require('../../config/db.config');
const { LabResult, Patient, User, Role } = require('../../models');
const labResultController = require('../../controllers/labResult.controller');

describe('🧪 Medicusve Laboratory Express Orders & Sample Traceability Engine', () => {

  let testPatient;
  let testUser;
  let createdLabOrder;

  beforeAll(async () => {
    await sequelize.sync();

    const [patientRole] = await Role.findOrCreate({
      where: { name: 'PATIENT' },
      defaults: { name: 'PATIENT', description: 'Patient Role' }
    });

    testUser = await User.create({
      username: 'lab.patient.test',
      email: 'lab.patient.test@medicusve.com',
      password: 'MedicusvePatient123!',
      firstName: 'María',
      lastName: 'Delgado',
      roleId: patientRole.id
    });

    testPatient = await Patient.create({
      userId: testUser.id,
      documentId: 'V-77665544',
      phone: '+58424-9988776'
    });
  });

  afterAll(async () => {
    if (createdLabOrder) await LabResult.destroy({ where: { id: createdLabOrder.id }, force: true });
    if (testPatient) await Patient.destroy({ where: { id: testPatient.id }, force: true });
    if (testUser) await User.destroy({ where: { id: testUser.id }, force: true });
  });

  describe('1. Unit & Integration Tests: Express Lab Order & Barcode Generation', () => {
    test('Creación de orden express asigna código de barras de muestra (LAB-YYYY-XXXXXX)', async () => {
      const req = {
        body: {
          patientId: testPatient.id,
          testName: 'Perfil 20 Completo',
          referenceRange: 'Normocítico',
          price: 45.00
        }
      };
      let resJson;
      let statusCode;
      const res = {
        json: (data) => { resJson = data; },
        status: (code) => { statusCode = code; return res; }
      };

      await labResultController.createExpressOrder(req, res);

      expect(statusCode).toBe(201);
      expect(resJson.sampleBarcode).toBeDefined();
      expect(resJson.sampleBarcode).toMatch(/^LAB-\d{4}-\d{6}$/);
      expect(resJson.labOrder.sampleStatus).toBe('ORDERED');

      createdLabOrder = resJson.labOrder;
    });

    test('Rechazo de creación si falta el ID de paciente o nombre de la prueba', async () => {
      const req = {
        body: { testName: 'Hemograma' }
      };
      let statusCode;
      const res = {
        json: () => {},
        status: (code) => { statusCode = code; return res; }
      };

      await labResultController.createExpressOrder(req, res);
      expect(statusCode).toBe(400);
    });
  });

  describe('2. Integration Tests: Sample Status Lifecycle Transitions', () => {
    test('Transición de estado a SAMPLE_COLLECTED asigna fecha de recolección', async () => {
      const req = {
        params: { id: createdLabOrder.id },
        body: { sampleStatus: 'SAMPLE_COLLECTED' }
      };
      let resJson;
      const res = {
        json: (data) => { resJson = data; },
        status: () => res
      };

      await labResultController.updateSampleStatus(req, res);

      expect(resJson.labOrder.sampleStatus).toBe('SAMPLE_COLLECTED');
      expect(resJson.labOrder.collectionDate).toBeDefined();
    });

    test('Transición final a COMPLETED adjunta resultado clínico y actualiza status principal', async () => {
      const req = {
        params: { id: createdLabOrder.id },
        body: {
          sampleStatus: 'COMPLETED',
          resultValue: 'Glicemia: 90 mg/dL (Normal)'
        }
      };
      let resJson;
      const res = {
        json: (data) => { resJson = data; },
        status: () => res
      };

      await labResultController.updateSampleStatus(req, res);

      expect(resJson.labOrder.sampleStatus).toBe('COMPLETED');
      expect(resJson.labOrder.status).toBe('Completed');
      expect(resJson.labOrder.resultValue).toBe('Glicemia: 90 mg/dL (Normal)');
    });
  });

  describe('3. Regression Tests: Invalid Status String Enforcement', () => {
    test('Rechazo de estados de muestra inválidos no definidos en el enum', async () => {
      const req = {
        params: { id: createdLabOrder.id },
        body: { sampleStatus: 'ESTADO_INVALIDO' }
      };
      let statusCode;
      const res = {
        json: () => {},
        status: (code) => { statusCode = code; return res; }
      };

      await labResultController.updateSampleStatus(req, res);

      expect(statusCode).toBe(400);
    });
  });
});
