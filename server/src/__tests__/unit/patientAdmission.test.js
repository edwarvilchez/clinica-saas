/**
 * ==============================================================================
 * JEST SUITE: MEDICUSVE PATIENT EXPRESS ADMISSION & INSURANCE COVERAGE
 * ==============================================================================
 * @file        patientAdmission.test.js
 * @description Unit, integration, and regression tests for express patient
 *              onboarding and insurance coverage verification in Medicusve.
 * ==============================================================================
 */

const sequelize = require('../../config/db.config');
const { Patient, User, Role } = require('../../models');
const patientController = require('../../controllers/patient.controller');

describe('🏥 Medicusve Patient Express Admission & Insurance Engine', () => {
  let testPatient;
  let testUser;

  beforeAll(async () => {
    await sequelize.sync();

    const [patientRole] = await Role.findOrCreate({
      where: { name: 'PATIENT' },
      defaults: { name: 'PATIENT', description: 'Patient Role' }
    });

    testUser = await User.create({
      username: 'admision.test',
      email: 'admision.test@medicusve.com',
      password: 'MedicusvePatient123!',
      firstName: 'Roberto',
      lastName: 'Blanco',
      roleId: patientRole.id
    });

    testPatient = await Patient.create({
      userId: testUser.id,
      documentId: 'V-88776655',
      phone: '+58412-5554433',
      insuranceProvider: 'Seguros Mercantil',
      policyNumber: 'POL-9988-INS',
      coverageType: 'INSURANCE',
      copayPercentage: 20.00,
      coverageStatus: 'ACTIVE'
    });
    testPatient.User = testUser;
  });

  afterAll(async () => {
    if (testPatient) await Patient.destroy({ where: { id: testPatient.id }, force: true });
    if (testUser) await User.destroy({ where: { id: testUser.id }, force: true });
  });

  describe('1. Unit & Integration Tests: Express Admission & Ticket Assignment', () => {
    test('Admisión express asigna número de ticket y responde exitosamente', async () => {
      const req = {
        user: { id: testUser.id, organizationId: null },
        body: {
          documentId: 'V-88776655',
          firstName: 'Roberto',
          lastName: 'Blanco'
        }
      };
      let resJson;
      let statusCode;
      const res = {
        json: (data) => { resJson = data; },
        status: (code) => { statusCode = code; return res; }
      };

      await patientController.expressAdmission(req, res);

      expect(statusCode).toBe(201);
      expect(resJson.ticketNumber).toBeDefined();
      expect(resJson.ticketNumber).toMatch(/^TICKET-\d{3}$/);
      expect(resJson.patient.name).toBe('Roberto Blanco');
    });

    test('Rechazo de admisión express si falta el número de cédula/DNI', async () => {
      const req = {
        user: { id: testUser.id },
        body: { firstName: 'Sin', lastName: 'Cedula' }
      };
      let statusCode;
      const res = {
        json: () => {},
        status: (code) => { statusCode = code; return res; }
      };

      await patientController.expressAdmission(req, res);
      expect(statusCode).toBe(400);
    });
  });

  describe('2. Integration Tests: Insurance Coverage Verification & Copay Calculation', () => {
    test('Cálculo correcto de copago (20%) y cobertura de seguro (80%) para consulta de $100', async () => {
      const req = {
        params: { id: testPatient.id },
        body: { totalConsultationCost: 100 }
      };
      let resJson;
      const res = {
        json: (data) => { resJson = data; },
        status: () => res
      };

      await patientController.verifyInsuranceCoverage(req, res);

      expect(resJson).toBeDefined();
      expect(resJson.isApproved).toBe(true);
      expect(resJson.financialBreakdown.patientAmountToPay).toBe('20.00');
      expect(resJson.financialBreakdown.insuranceAmountCovered).toBe('80.00');
      expect(resJson.financialBreakdown.copayPercentage).toBe('20%');
    });
  });

  describe('3. Regression Tests: Particular Patient (SELF_PAY) Copay Enforcement', () => {
    test('Pacientes particulares (SELF_PAY) pagan el 100% de la consulta sin cobertura', async () => {
      await testPatient.update({ coverageType: 'SELF_PAY', insuranceProvider: 'Particular' });

      const req = {
        params: { id: testPatient.id },
        body: { totalConsultationCost: 150 }
      };
      let resJson;
      const res = {
        json: (data) => { resJson = data; },
        status: () => res
      };

      await patientController.verifyInsuranceCoverage(req, res);

      expect(resJson.isApproved).toBe(false);
      expect(resJson.financialBreakdown.patientAmountToPay).toBe('150.00');
      expect(resJson.financialBreakdown.insuranceAmountCovered).toBe('0.00');
      expect(resJson.financialBreakdown.copayPercentage).toBe('100%');
    });
  });
});
