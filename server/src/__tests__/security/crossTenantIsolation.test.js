'use strict';

/**
 * 🛡️ FASE 1 SECURITY TEST SUITE: Cross-Tenant Data Isolation & PostgreSQL RLS
 * Verifies that Tenant A CANNOT access, modify, delete, or inject data into Tenant B.
 */

const { v4: uuidv4 } = require('uuid');
const context = require('../../utils/context');
const { setTenantContext } = require('../../utils/tenantRls');
const {
  User,
  Organization,
  Patient,
  Appointment,
  MedicalRecord,
  Doctor,
  Role,
  sequelize
} = require('../../models');

describe('🛡️ FASE 1: Cross-Tenant Data Isolation & RLS Security Suite', () => {
  let orgA;
  let orgB;
  let userA;
  let userB;
  let doctorA;
  let patientA;
  let patientB;
  let appointmentA;
  let appointmentB;

  beforeAll(async () => {
    // 1. Authenticate DB connection
    await sequelize.authenticate();

    // 2. Ensure test RLS role and policy exist in database
    try {
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'clinica_app_user') THEN
            CREATE ROLE clinica_app_user NOSUPERUSER NOINHERIT;
          END IF;
        END $$;
        GRANT USAGE ON SCHEMA public TO clinica_app_user;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO clinica_app_user;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO clinica_app_user;
        ALTER TABLE "Patients" ENABLE ROW LEVEL SECURITY;
        ALTER TABLE "Patients" FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation_policy ON "Patients";
        CREATE POLICY tenant_isolation_policy ON "Patients"
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          current_setting('app.is_super_admin', true) = 'true'
          OR
          "organizationId"::text = NULLIF(current_setting('app.current_organization_id', true), '')
        )
        WITH CHECK (
          current_setting('app.is_super_admin', true) = 'true'
          OR
          "organizationId"::text = NULLIF(current_setting('app.current_organization_id', true), '')
        );
      `);
    } catch (e) {
      // Ignore if insufficient privilege to create role
    }

    // Set superadmin context for initial test fixture creation
    await setTenantContext(sequelize, { isSuperAdmin: true });

    // 3. Setup Doctor Role
    const doctorRole = await Role.findOne({ where: { name: 'DOCTOR' } }) || 
                       await Role.create({ name: 'DOCTOR' });

    // 3. Create Users first
    userA = await User.create({
      id: uuidv4(),
      username: `doctor_a_${Date.now()}`,
      email: `doctor_a_${Date.now()}@alpha.com`,
      password: 'SecurePass123!',
      roleId: doctorRole.id,
      isActive: true
    });

    userB = await User.create({
      id: uuidv4(),
      username: `doctor_b_${Date.now()}`,
      email: `doctor_b_${Date.now()}@beta.com`,
      password: 'SecurePass123!',
      roleId: doctorRole.id,
      isActive: true
    });

    // 4. Setup Distinct Organizations with ownerId
    orgA = await Organization.create({
      id: uuidv4(),
      name: `Clinica Alpha Test ${Date.now()}`,
      type: 'CLINIC',
      ownerId: userA.id,
      subscriptionStatus: 'ACTIVE'
    });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Clinica Beta Test ${Date.now()}`,
      type: 'CLINIC',
      ownerId: userB.id,
      subscriptionStatus: 'ACTIVE'
    });

    // Link users to their organizations
    await userA.update({ organizationId: orgA.id });
    await userB.update({ organizationId: orgB.id });

    doctorA = await Doctor.create({
      id: uuidv4(),
      userId: userA.id,
      licenseNumber: `MED-A-${Date.now()}`,
      organizationId: orgA.id
    });

    // 4. Setup Patients in separate organizations
    const patientUserA = await User.create({
      id: uuidv4(),
      username: `patient_a_${Date.now()}`,
      email: `patient_a_${Date.now()}@alpha.com`,
      password: 'SecurePass123!',
      organizationId: orgA.id
    });

    const patientUserB = await User.create({
      id: uuidv4(),
      username: `patient_b_${Date.now()}`,
      email: `patient_b_${Date.now()}@beta.com`,
      password: 'SecurePass123!',
      organizationId: orgB.id
    });

    patientA = await Patient.create({
      id: uuidv4(),
      userId: patientUserA.id,
      documentId: `DOC-A-${Date.now()}`,
      organizationId: orgA.id
    });

    patientB = await Patient.create({
      id: uuidv4(),
      userId: patientUserB.id,
      documentId: `DOC-B-${Date.now()}`,
      organizationId: orgB.id
    });

    // 5. Setup Appointments
    appointmentA = await Appointment.create({
      id: uuidv4(),
      patientId: patientA.id,
      doctorId: doctorA.id,
      date: new Date(),
      status: 'Confirmed',
      reason: 'Alpha General Consultation',
      organizationId: orgA.id
    });

    appointmentB = await Appointment.create({
      id: uuidv4(),
      patientId: patientB.id,
      doctorId: doctorA.id,
      date: new Date(),
      status: 'Confirmed',
      reason: 'Beta Secret Consultation',
      organizationId: orgB.id
    });
  });

  afterAll(async () => {
    // Cleanup test fixtures with superadmin privileges
    await setTenantContext(sequelize, { isSuperAdmin: true });
    try {
      if (appointmentA) await Appointment.destroy({ where: { id: appointmentA.id }, force: true });
      if (appointmentB) await Appointment.destroy({ where: { id: appointmentB.id }, force: true });
      if (patientA) await Patient.destroy({ where: { id: patientA.id }, force: true });
      if (patientB) await Patient.destroy({ where: { id: patientB.id }, force: true });
      if (doctorA) await Doctor.destroy({ where: { id: doctorA.id }, force: true });
      if (orgA) await Organization.destroy({ where: { id: orgA.id }, force: true });
      if (orgB) await Organization.destroy({ where: { id: orgB.id }, force: true });
      if (userA) await User.destroy({ where: { id: userA.id }, force: true });
      if (userB) await User.destroy({ where: { id: userB.id }, force: true });
    } catch (e) {
      // Ignore cleanup error
    }
  });

  // =========================================================================
  // 1. READ / SELECT ISOLATION
  // =========================================================================

  test('🔒 Tenant A CANNOT read Tenant B patients via ORM find', async () => {
    await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: userA.id }, async () => {
      // Find all patients in context of Tenant A
      const patients = await Patient.findAll();
      const patientIds = patients.map(p => p.id);

      expect(patientIds).toContain(patientA.id);
      expect(patientIds).not.toContain(patientB.id);

      // Attempt explicit query for Patient B by ID
      const directSearch = await Patient.findOne({ where: { id: patientB.id } });
      expect(directSearch).toBeNull();
    });
  });

  test('🔒 Tenant A CANNOT read Tenant B appointments', async () => {
    await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: userA.id }, async () => {
      const appointments = await Appointment.findAll();
      const appointmentIds = appointments.map(a => a.id);

      expect(appointmentIds).toContain(appointmentA.id);
      expect(appointmentIds).not.toContain(appointmentB.id);

      const directSearch = await Appointment.findOne({ where: { id: appointmentB.id } });
      expect(directSearch).toBeNull();
    });
  });

  // =========================================================================
  // 2. WRITE / UPDATE ISOLATION
  // =========================================================================

  test('🔒 Tenant A CANNOT update Tenant B patient data', async () => {
    await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: userA.id }, async () => {
      // Attempt to modify patient B's document ID from tenant A's context
      const [affectedRows] = await Patient.update(
        { documentId: 'HACKED_DOCUMENT_ID' },
        { where: { id: patientB.id } }
      );

      // 0 rows must be affected because tenant isolation scopes the query
      expect(affectedRows).toBe(0);
    });

    // Verify patient B remains unmodified under Tenant B's context
    await context.storage.run({ organizationId: orgB.id, role: 'DOCTOR', userId: userB.id }, async () => {
      const unhacked = await Patient.findByPk(patientB.id);
      expect(unhacked).not.toBeNull();
      expect(unhacked.documentId).not.toBe('HACKED_DOCUMENT_ID');
    });
  });

  test('🔒 Tenant A CANNOT modify or alter organizationId to escape boundary', async () => {
    await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: userA.id }, async () => {
      // Attempt to reassign patient A to organization B
      await expect(
        Patient.update(
          { organizationId: orgB.id },
          { where: { id: patientA.id } }
        )
      ).rejects.toThrow(/Modifying organizationId is strictly forbidden/i);
    });
  });

  // =========================================================================
  // 3. DELETE / DESTROY ISOLATION
  // =========================================================================

  test('🔒 Tenant A CANNOT delete Tenant B patient records', async () => {
    await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: userA.id }, async () => {
      // Attempt to delete patient B from Tenant A context
      const deletedRows = await Patient.destroy({ where: { id: patientB.id } });
      expect(deletedRows).toBe(0);
    });

    // Patient B must still exist under Tenant B's context
    await context.storage.run({ organizationId: orgB.id, role: 'DOCTOR', userId: userB.id }, async () => {
      const patientCheck = await Patient.findByPk(patientB.id);
      expect(patientCheck).not.toBeNull();
    });
  });

  // =========================================================================
  // 4. FORGED INJECTION / CREATE ISOLATION
  // =========================================================================

  test('🔒 Tenant A CANNOT create records forged with Tenant B organizationId', async () => {
    await context.storage.run({ organizationId: orgA.id, role: 'DOCTOR', userId: userA.id }, async () => {
      // Attempt to forge patient insertion into Org B
      await expect(
        Patient.create({
          id: uuidv4(),
          userId: userA.id,
          documentId: `FORGED-${Date.now()}`,
          organizationId: orgB.id // Mismatch with context orgA
        })
      ).rejects.toThrow(/Cross-tenant insertion blocked/i);
    });
  });

  // =========================================================================
  // 5. POSTGRESQL ROW LEVEL SECURITY (RLS) ENGINE VERIFICATION
  // =========================================================================

  test('🔒 PostgreSQL RLS blocks raw SQL queries from accessing Tenant B rows', async () => {
    // Execute inside a dedicated transaction with non-superuser role and Tenant A RLS session variable
    await sequelize.transaction(async (t) => {
      // Ensure RLS applies without superuser bypass
      await sequelize.query('SET LOCAL ROLE clinica_app_user', { transaction: t });

      await setTenantContext(sequelize, {
        organizationId: orgA.id,
        isSuperAdmin: false,
        transaction: t
      });

      // Raw unconstrained SQL query on Patients table
      const [results] = await sequelize.query(
        'SELECT id, "organizationId"::text as org_id FROM "Patients"',
        { transaction: t }
      );

      const foundOrgs = results.map(r => r.org_id);
      const foundIds = results.map(r => r.id);

      // Must find Tenant A's patient, MUST NOT find Tenant B's patient
      expect(foundIds).toContain(patientA.id);
      expect(foundIds).not.toContain(patientB.id);

      // All returned rows must strictly match Tenant A's organizationId
      for (const org of foundOrgs) {
        expect(org).toBe(orgA.id);
      }
    });
  });

  // =========================================================================
  // 6. SUPERADMIN CROSS-TENANT OVERVIEW VERIFICATION
  // =========================================================================

  test('✅ SUPERADMIN can view cross-tenant records when explicitly authorized', async () => {
    await context.storage.run({ role: 'SUPERADMIN', isSuperAdmin: true, userId: 'superadmin' }, async () => {
      await setTenantContext(sequelize, { isSuperAdmin: true });

      const allPatients = await Patient.findAll();
      const allPatientIds = allPatients.map(p => p.id);

      // Superadmin must see both tenants
      expect(allPatientIds).toContain(patientA.id);
      expect(allPatientIds).toContain(patientB.id);
    });
  });
});
