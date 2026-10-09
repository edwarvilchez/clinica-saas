/**
 * ==============================================================================
 * JEST TEST SUITE: MULTI-TENANT ATTACK VECTORS & IDOR PENETRATION SUITE
 * ==============================================================================
 * @file        multiTenantAttack.test.js
 * @description Exhaustive security tests simulating active cross-tenant attacks:
 *              - Cross-tenant Read / Write / Update / Delete attempts
 *              - Body tampering (injecting organizationId of another tenant)
 *              - IDOR via UUID harvesting across clinical and financial resources
 *              - Raw SQL injection attempting to bypass tenant scoping and RLS
 * ==============================================================================
 */

const { v4: uuidv4 } = require('uuid');
const context = require('../../utils/context');
const { setTenantContext } = require('../../utils/tenantRls');
const {
  User,
  Organization,
  Patient,
  Doctor,
  Appointment,
  MedicalRecord,
  Payment,
  Role,
  sequelize
} = require('../../models');

describe('🚨 FASE 31: Multi-Tenant Active Attack & IDOR Penetration Suite', () => {
  let orgA;
  let orgB;
  let doctorUserA;
  let doctorUserB;
  let doctorA;
  let doctorB;
  let patientA;
  let patientB;
  let medicalRecordA;
  let medicalRecordB;
  let appointmentA;
  let appointmentB;
  let paymentA;
  let paymentB;

  beforeAll(async () => {
    await sequelize.authenticate();
    await setTenantContext(sequelize, { isSuperAdmin: true });

    const doctorRole = await Role.findOne({ where: { name: 'DOCTOR' } }) ||
                       await Role.create({ name: 'DOCTOR' });

    // Setup User A & Org A
    doctorUserA = await User.create({
      id: uuidv4(),
      username: `attacker_doctor_a_${Date.now()}`,
      email: `attacker_a_${Date.now()}@alpha.com`,
      password: 'StrongAttackPass123!',
      roleId: doctorRole.id,
      isActive: true
    });

    orgA = await Organization.create({
      id: uuidv4(),
      name: `Tenant Alpha Hospital ${Date.now()}`,
      type: 'CLINIC',
      ownerId: doctorUserA.id,
      subscriptionStatus: 'ACTIVE'
    });
    await doctorUserA.update({ organizationId: orgA.id });

    doctorA = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserA.id,
      licenseNumber: `LIC-A-${Date.now()}`,
      organizationId: orgA.id
    });

    // Setup User B & Org B
    doctorUserB = await User.create({
      id: uuidv4(),
      username: `victim_doctor_b_${Date.now()}`,
      email: `victim_b_${Date.now()}@beta.com`,
      password: 'StrongAttackPass123!',
      roleId: doctorRole.id,
      isActive: true
    });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Tenant Beta Clinic ${Date.now()}`,
      type: 'CLINIC',
      ownerId: doctorUserB.id,
      subscriptionStatus: 'ACTIVE'
    });
    await doctorUserB.update({ organizationId: orgB.id });

    doctorB = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserB.id,
      licenseNumber: `LIC-B-${Date.now()}`,
      organizationId: orgB.id
    });

    // Create Patient A in Org A
    patientA = await Patient.create({
      id: uuidv4(),
      userId: doctorUserA.id,
      documentId: `V-10${Math.floor(Math.random() * 899999 + 100000)}`,
      organizationId: orgA.id
    });

    // Create Patient B in Org B
    patientB = await Patient.create({
      id: uuidv4(),
      userId: doctorUserB.id,
      documentId: `V-20${Math.floor(Math.random() * 899999 + 100000)}`,
      organizationId: orgB.id
    });

    // Create Appointment A & B
    appointmentA = await Appointment.create({
      id: uuidv4(),
      patientId: patientA.id,
      doctorId: doctorA.id,
      date: new Date(),
      status: 'Confirmed',
      reason: 'Confidential Consultation Alpha',
      organizationId: orgA.id
    });

    appointmentB = await Appointment.create({
      id: uuidv4(),
      patientId: patientB.id,
      doctorId: doctorB.id,
      date: new Date(),
      status: 'Confirmed',
      reason: 'Secret VIP Consultation Beta',
      organizationId: orgB.id
    });

    // Create MedicalRecord A & B
    medicalRecordA = await MedicalRecord.create({
      id: uuidv4(),
      patientId: patientA.id,
      doctorId: doctorA.id,
      diagnosis: 'Alpha Diagnosis Note',
      treatment: 'Standard Protocol Alpha',
      organizationId: orgA.id
    });

    medicalRecordB = await MedicalRecord.create({
      id: uuidv4(),
      patientId: patientB.id,
      doctorId: doctorB.id,
      diagnosis: 'Classified Beta Condition',
      treatment: 'Confidential Therapy Beta',
      organizationId: orgB.id
    });

    // Create Payment A & B
    paymentA = await Payment.create({
      id: uuidv4(),
      patientId: patientA.id,
      amount: 150.00,
      currency: 'USD',
      status: 'Paid',
      concept: 'Alpha Medical Fee',
      organizationId: orgA.id
    });

    paymentB = await Payment.create({
      id: uuidv4(),
      patientId: patientB.id,
      amount: 5000.00,
      currency: 'USD',
      status: 'Paid',
      concept: 'Beta Executive Surgery',
      organizationId: orgB.id
    });
  });

  afterAll(async () => {
    await setTenantContext(sequelize, { isSuperAdmin: true });
    try {
      if (paymentA) await Payment.destroy({ where: { id: paymentA.id }, force: true });
      if (paymentB) await Payment.destroy({ where: { id: paymentB.id }, force: true });
      if (medicalRecordA) await MedicalRecord.destroy({ where: { id: medicalRecordA.id }, force: true });
      if (medicalRecordB) await MedicalRecord.destroy({ where: { id: medicalRecordB.id }, force: true });
      if (appointmentA) await Appointment.destroy({ where: { id: appointmentA.id }, force: true });
      if (appointmentB) await Appointment.destroy({ where: { id: appointmentB.id }, force: true });
      if (patientA) await Patient.destroy({ where: { id: patientA.id }, force: true });
      if (patientB) await Patient.destroy({ where: { id: patientB.id }, force: true });
      if (doctorA) await Doctor.destroy({ where: { id: doctorA.id }, force: true });
      if (doctorB) await Doctor.destroy({ where: { id: doctorB.id }, force: true });
      if (orgA) await Organization.destroy({ where: { id: orgA.id }, force: true });
      if (orgB) await Organization.destroy({ where: { id: orgB.id }, force: true });
      if (doctorUserA) await User.destroy({ where: { id: doctorUserA.id }, force: true });
      if (doctorUserB) await User.destroy({ where: { id: doctorUserB.id }, force: true });
    } catch (_) {}
  });

  describe('1. Active Read Attack Vectors (Cross-Tenant Eavesdropping)', () => {
    test('🚨 Tenant A attacker CANNOT read Patient B even knowing the UUID', async () => {
      await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: doctorUserA.id }, async () => {
        const stolenPatient = await Patient.findByPk(patientB.id);
        expect(stolenPatient).toBeNull();

        const searchWhere = await Patient.findOne({ where: { id: patientB.id } });
        expect(searchWhere).toBeNull();
      });
    });

    test('🚨 Tenant A attacker CANNOT read MedicalRecord B diagnosis or treatment', async () => {
      await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: doctorUserA.id }, async () => {
        const stolenRecord = await MedicalRecord.findByPk(medicalRecordB.id);
        expect(stolenRecord).toBeNull();

        const allRecords = await MedicalRecord.findAll();
        const recordIds = allRecords.map(r => r.id);
        expect(recordIds).not.toContain(medicalRecordB.id);
      });
    });

    test('🚨 Tenant A attacker CANNOT read Payment / Invoice B amount', async () => {
      await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: doctorUserA.id }, async () => {
        const stolenPayment = await Payment.findByPk(paymentB.id);
        expect(stolenPayment).toBeNull();
      });
    });
  });

  describe('2. Active Modification & Hijacking Attacks', () => {
    test('🚨 Tenant A attacker CANNOT update Patient B records', async () => {
      await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: doctorUserA.id }, async () => {
        const [updatedCount] = await Patient.update(
          { phone: '+58414-9999999' },
          { where: { id: patientB.id } }
        );
        expect(updatedCount).toBe(0);
      });

      // Verify unhacked under tenant B context
      await context.storage.run({ organizationId: orgB.id, role: 'DOCTOR', userId: doctorUserB.id }, async () => {
        const victim = await Patient.findByPk(patientB.id);
        expect(victim.phone).not.toBe('+58414-9999999');
      });
    });

    test('🚨 Tenant A attacker CANNOT delete MedicalRecord B', async () => {
      await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: doctorUserA.id }, async () => {
        const deletedCount = await MedicalRecord.destroy({
          where: { id: medicalRecordB.id }
        });
        expect(deletedCount).toBe(0);
      });

      // Verify record B persists
      await context.storage.run({ organizationId: orgB.id, role: 'DOCTOR', userId: doctorUserB.id }, async () => {
        const record = await MedicalRecord.findByPk(medicalRecordB.id);
        expect(record).not.toBeNull();
      });
    });
  });

  describe('3. Body Tampering Attack (organizationId Forgery)', () => {
    test('🚨 Reject creation attempt forged with victim organizationId B', async () => {
      await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: doctorUserA.id }, async () => {
        await expect(
          Patient.create({
            id: uuidv4(),
            userId: doctorUserA.id,
            documentId: `V-99${Math.floor(Math.random() * 899999 + 100000)}`,
            organizationId: orgB.id // Malicious injection of victim org
          })
        ).rejects.toThrow(/Cross-tenant insertion blocked/i);
      });
    });

    test('🚨 Reject update attempting to mutate own record into victim organization B', async () => {
      await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: doctorUserA.id }, async () => {
        await expect(
          Patient.update(
            { organizationId: orgB.id },
            { where: { id: patientA.id } }
          )
        ).rejects.toThrow(/Modifying organizationId is strictly forbidden/i);
      });
    });
  });

  describe('4. Raw SQL Attack Vectors (RLS Enforcement)', () => {
    test('🚨 Raw SQL query with Tenant A session cannot read Tenant B patients', async () => {
      await sequelize.transaction(async (t) => {
        try {
          await sequelize.query('SET LOCAL ROLE clinica_app_user', { transaction: t });
        } catch (_) {}

        await setTenantContext(sequelize, {
          organizationId: orgA.id,
          isSuperAdmin: false,
          transaction: t
        });

        const [results] = await sequelize.query(
          `SELECT id, "documentId", "organizationId"::text as org_id FROM "Patients" WHERE id = '${patientB.id}';`,
          { transaction: t }
        );

        expect(results.length).toBe(0);
      });
    });

    test('🚨 Raw SQL query with Tenant A session cannot update Tenant B appointments', async () => {
      await sequelize.transaction(async (t) => {
        try {
          await sequelize.query('SET LOCAL ROLE clinica_app_user', { transaction: t });
        } catch (_) {}

        await setTenantContext(sequelize, {
          organizationId: orgA.id,
          isSuperAdmin: false,
          transaction: t
        });

        await sequelize.query(
          `UPDATE "Appointments" SET status = 'Cancelled' WHERE id = '${appointmentB.id}';`,
          { transaction: t }
        );
      });

      // Verify unchanged under superadmin inspection
      await setTenantContext(sequelize, { isSuperAdmin: true });
      const appointmentCheck = await Appointment.findByPk(appointmentB.id);
      expect(appointmentCheck.status).toBe('Confirmed');
    });
  });
});
