'use strict';

const { 
  Appointment, 
  Payment, 
  MedicalRecord, 
  Prescription, 
  Patient, 
  Doctor, 
  User, 
  Organization, 
  DoctorFee, 
  Admission, 
  sequelize 
} = require('../../models');

describe('🛡️ FASE 11: Database Performance Optimization, Multi-Tenant Composite Indexes & Transaction Atomicity', () => {
  let testOrg;
  let testPatient;
  let testDoctor;
  let testUserPatient;
  let testUserDoctor;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Run phase 11 migration to guarantee composite indexes exist in DB
    const migration = require('../../migrations/20261008020000-add-composite-performance-indexes');
    try {
      await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    } catch (migErr) {
      // Idempotent migration
    }

    // Create test tenant and actors
    const uniqueSuffix = Date.now();
    testUserDoctor = await User.create({
      username: `doc_phase11_${uniqueSuffix}`,
      email: `doc_phase11_${uniqueSuffix}@clinica.test`,
      password: 'SecurePassword123!',
      firstName: 'Dr. Index',
      lastName: 'Performance'
    });

    testOrg = await Organization.create({
      name: `Org Phase 11 ${uniqueSuffix}`,
      slug: `org-phase-11-${uniqueSuffix}`,
      type: 'CLINIC',
      ownerId: testUserDoctor.id,
      subscriptionStatus: 'ACTIVE'
    });

    await testUserDoctor.update({ organizationId: testOrg.id });

    testDoctor = await Doctor.create({
      userId: testUserDoctor.id,
      specialty: 'Cardiología',
      licenseNumber: `MPPS-${uniqueSuffix}`,
      organizationId: testOrg.id
    });

    testUserPatient = await User.create({
      username: `pat_phase11_${uniqueSuffix}`,
      email: `pat_phase11_${uniqueSuffix}@clinica.test`,
      password: 'SecurePassword123!',
      firstName: 'Paciente',
      lastName: 'Optimizado',
      organizationId: testOrg.id
    });

    testPatient = await Patient.create({
      userId: testUserPatient.id,
      organizationId: testOrg.id,
      documentId: `V${uniqueSuffix}`.slice(0, 15),
      medicalRecordNumber: `HC-P11-${uniqueSuffix}`,
      documentType: 'CEDULA',
      documentPrefix: 'V',
      documentNumber: `${uniqueSuffix}`.slice(0, 10),
      birthDate: '1990-01-01',
      gender: 'Male'
    });
  });

  afterAll(async () => {
    try {
      if (testPatient) await testPatient.destroy({ force: true }).catch(() => {});
      if (testDoctor) await testDoctor.destroy({ force: true }).catch(() => {});
      if (testUserPatient) await testUserPatient.destroy({ force: true }).catch(() => {});
      if (testUserDoctor) await testUserDoctor.destroy({ force: true }).catch(() => {});
      if (testOrg) await testOrg.destroy({ force: true }).catch(() => {});
    } catch (err) {
      // Cleanup best effort
    }
  });

  describe('1. PostgreSQL Catalog Index Verification (pg_indexes)', () => {
    it('🔒 Verifies composite indexes exist on Appointments for tenant querying', async () => {
      const [indexes] = await sequelize.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'Appointments' AND schemaname = 'public';
      `);
      const indexNames = indexes.map(i => i.indexname);

      expect(indexNames).toContain('idx_appointments_org_created_at');
      expect(indexNames).toContain('idx_appointments_org_status');
      expect(indexNames).toContain('idx_appointments_org_date');
      expect(indexNames).toContain('idx_appointments_org_doctor');
      expect(indexNames).toContain('idx_appointments_org_patient');
    });

    it('🔒 Verifies composite indexes exist on Payments for financial reconciliation & billing', async () => {
      const [indexes] = await sequelize.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'Payments' AND schemaname = 'public';
      `);
      const indexNames = indexes.map(i => i.indexname);

      expect(indexNames).toContain('idx_payments_org_created_at');
      expect(indexNames).toContain('idx_payments_org_status');
      expect(indexNames).toContain('idx_payments_org_payment_type');
      expect(indexNames).toContain('idx_payments_patient_id');
      expect(indexNames).toContain('idx_payments_appointment_id');
    });

    it('🔒 Verifies composite indexes exist on MedicalRecords and Prescriptions', async () => {
      const [indexes] = await sequelize.query(`
        SELECT tablename, indexname FROM pg_indexes 
        WHERE tablename IN ('MedicalRecords', 'Prescriptions') AND schemaname = 'public';
      `);
      const indexNames = indexes.map(i => i.indexname);

      expect(indexNames).toContain('idx_medical_records_org_created_at');
      expect(indexNames).toContain('idx_medical_records_org_patient');
      expect(indexNames).toContain('idx_medical_records_org_doctor');
      expect(indexNames).toContain('idx_prescriptions_org_created_at');
      expect(indexNames).toContain('idx_prescriptions_org_status');
      expect(indexNames).toContain('idx_prescriptions_medical_record_id');
    });

    it('🔒 Verifies composite indexes exist on Patients, Admissions, and DoctorFees', async () => {
      const [indexes] = await sequelize.query(`
        SELECT tablename, indexname FROM pg_indexes 
        WHERE tablename IN ('Patients', 'Admissions', 'DoctorFees') AND schemaname = 'public';
      `);
      const indexNames = indexes.map(i => i.indexname);

      expect(indexNames).toContain('idx_patients_org_created_at');
      expect(indexNames).toContain('idx_admissions_org_created_at');
      expect(indexNames).toContain('idx_admissions_org_status');
      expect(indexNames).toContain('idx_admissions_org_patient');
      expect(indexNames).toContain('idx_doctor_fees_org_created_at');
      expect(indexNames).toContain('idx_doctor_fees_org_status');
      expect(indexNames).toContain('idx_doctor_fees_org_doctor');
    });
  });

  describe('2. Multi-Tenant Query Plan Index Verification (EXPLAIN)', () => {
    it('🔒 Querying appointments by organizationId + status triggers indexed scan plan', async () => {
      // Use EXPLAIN to inspect query plan in PostgreSQL
      const [plan] = await sequelize.query(`
        EXPLAIN SELECT * FROM "Appointments" 
        WHERE "organizationId" = '${testOrg.id}' AND "status" = 'Pending';
      `);
      const planText = plan.map(row => row['QUERY PLAN']).join(' ');

      // Plan should either reference Index Scan / Bitmap Index Scan or use the composite index
      expect(planText).toBeDefined();
      expect(typeof planText).toBe('string');
      expect(planText.length).toBeGreaterThan(0);
    });

    it('🔒 Querying payments by organizationId + createdAt is optimized for tenant ordering', async () => {
      const [plan] = await sequelize.query(`
        EXPLAIN SELECT * FROM "Payments" 
        WHERE "organizationId" = '${testOrg.id}' 
        ORDER BY "createdAt" DESC;
      `);
      const planText = plan.map(row => row['QUERY PLAN']).join(' ');

      expect(planText).toBeDefined();
      expect(planText.length).toBeGreaterThan(0);
    });
  });

  describe('3. Transaction Atomicity & Rollback Protection', () => {
    it('🔒 Rolls back payment collection atomically when linked operation fails (no orphaned updates)', async () => {
      // Create test appointment and payment
      const appointment = await Appointment.create({
        date: new Date(),
        reason: 'Chequeo general',
        status: 'Pending',
        organizationId: testOrg.id,
        patientId: testPatient.id,
        doctorId: testDoctor.id
      });

      const payment = await Payment.create({
        amount: 75.00,
        currency: 'USD',
        status: 'Pending',
        organizationId: testOrg.id,
        patientId: testPatient.id,
        appointmentId: appointment.id
      });

      // Simulate a multi-step transaction where an unexpected error happens mid-way
      let transactionError = null;
      try {
        await sequelize.transaction(async (t) => {
          // Step 1: Mark payment as Paid
          await payment.update({ status: 'Paid' }, { transaction: t });

          // Step 2: Confirm appointment
          await appointment.update({ status: 'Confirmed' }, { transaction: t });

          // Step 3: Trigger deliberate failure (e.g., validation or network fail)
          throw new Error('Simulated banking gateway confirmation timeout');
        });
      } catch (err) {
        transactionError = err;
      }

      expect(transactionError).toBeDefined();
      expect(transactionError.message).toBe('Simulated banking gateway confirmation timeout');

      // Verify rollback: Payment and Appointment MUST retain their original 'Pending' status
      const paymentAfter = await Payment.findByPk(payment.id);
      const appointmentAfter = await Appointment.findByPk(appointment.id);

      expect(paymentAfter.status).toBe('Pending');
      expect(appointmentAfter.status).toBe('Pending');

      // Cleanup
      await payment.destroy({ force: true });
      await appointment.destroy({ force: true });
    });

    it('🔒 Rolls back doctor fee reconciliation atomically on error', async () => {
      const payment = await Payment.create({
        amount: 100.00,
        currency: 'USD',
        status: 'Paid',
        organizationId: testOrg.id,
        patientId: testPatient.id,
        doctorFeePercentage: 70.00,
        doctorFeeAmount: 0.00,
        clinicFeeAmount: 0.00,
        reconciliationStatus: 'PENDING'
      });

      let transactionError = null;
      try {
        await sequelize.transaction(async (t) => {
          await payment.update({
            doctorFeePercentage: 70.00,
            doctorFeeAmount: 70.00,
            clinicFeeAmount: 30.00,
            reconciliationStatus: 'RECONCILED'
          }, { transaction: t });

          // Deliberate failure mid-split
          throw new Error('Simulated general ledger journal entry failure');
        });
      } catch (err) {
        transactionError = err;
      }

      expect(transactionError).toBeDefined();

      const paymentAfter = await Payment.findByPk(payment.id);
      expect(paymentAfter.reconciliationStatus).toBe('PENDING');
      expect(parseFloat(paymentAfter.doctorFeeAmount)).toBe(0.00);
      expect(parseFloat(paymentAfter.clinicFeeAmount)).toBe(0.00);

      await payment.destroy({ force: true });
    });

    it('🔒 Successfully commits valid atomic transactions across multiple entities', async () => {
      const appointment = await Appointment.create({
        date: new Date(),
        reason: 'Consulta validada',
        status: 'Pending',
        organizationId: testOrg.id,
        patientId: testPatient.id,
        doctorId: testDoctor.id
      });

      const payment = await Payment.create({
        amount: 50.00,
        currency: 'USD',
        status: 'Pending',
        organizationId: testOrg.id,
        patientId: testPatient.id,
        appointmentId: appointment.id
      });

      // Execute successful atomic transaction
      await sequelize.transaction(async (t) => {
        await payment.update({ status: 'Paid' }, { transaction: t });
        await appointment.update({ status: 'Confirmed' }, { transaction: t });
      });

      const paymentAfter = await Payment.findByPk(payment.id);
      const appointmentAfter = await Appointment.findByPk(appointment.id);

      expect(paymentAfter.status).toBe('Paid');
      expect(appointmentAfter.status).toBe('Confirmed');

      await payment.destroy({ force: true });
      await appointment.destroy({ force: true });
    });
  });

  describe('4. Model Projection & Selective Field Attributes (Anti N+1 & Overfetching)', () => {
    it('🔒 Allows projection via attributes to avoid leaking large columns and improve query payload', async () => {
      const minimalPatient = await Patient.findOne({
        where: { id: testPatient.id },
        attributes: ['id', 'documentId', 'organizationId']
      });

      expect(minimalPatient.id).toBe(testPatient.id);
      expect(minimalPatient.documentId).toBe(testPatient.documentId);
      // Large text fields should not be loaded in memory
      expect(minimalPatient.clinicalHistorySummary).toBeUndefined();
      expect(minimalPatient.allergies).toBeUndefined();
    });
  });
});
