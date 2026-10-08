'use strict';

/**
 * 🛡️ FASE 18 SECURITY TEST SUITE: Longitudinal Patient Timeline
 * 
 * Verifies:
 * 1. Authentication requirement (401 without token)
 * 2. Anti-IDOR protection (Patient cannot access another patient's timeline - 403)
 * 3. Clinical RBAC authorization (Doctor & Admin within tenant can access - 200)
 * 4. Multi-tenant isolation (Tenant B cannot see Tenant A's patient timeline - 404)
 * 5. Complete chronological aggregation (Appointments, Records, Prescriptions, Labs, Admissions, Payments)
 * 6. Granular category filtering (?type=...)
 */

const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { setTenantContext } = require('../../utils/tenantRls');
const {
  User,
  Organization,
  Patient,
  Doctor,
  Specialty,
  Appointment,
  MedicalRecord,
  Prescription,
  LabResult,
  Payment,
  Admission,
  Role,
  sequelize
} = require('../../models');
const patientController = require('../../controllers/patient.controller');

describe('🛡️ FASE 18: Timeline Longitudinal del Paciente & Anti-IDOR Security Suite', () => {
  let app;
  let orgA;
  let orgB;
  let doctorUserA;
  let doctorModelA;
  let patientUserA;
  let patientModelA;
  let patientUserB;
  let patientModelB;
  let adminUserB;

  let specialtyCardio;

  beforeAll(async () => {
    await sequelize.authenticate();
    await setTenantContext(sequelize, { isSuperAdmin: true });

    // 1. Roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'ADMIN' }, defaults: { description: 'Administrador' } });
    const [doctorRole] = await Role.findOrCreate({ where: { name: 'DOCTOR' }, defaults: { description: 'Médico' } });
    const [patientRole] = await Role.findOrCreate({ where: { name: 'PATIENT' }, defaults: { description: 'Paciente' } });

    // 2. Especialidad
    [specialtyCardio] = await Specialty.findOrCreate({
      where: { name: 'Cardiología Timeline' },
      defaults: { description: 'Cardiología' }
    });

    // 3. Usuarios Propietarios para Organizaciones
    const ownerA = await User.create({
      id: uuidv4(),
      username: `owner_a_${Date.now()}`,
      email: `owner_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true
    });

    const ownerB = await User.create({
      id: uuidv4(),
      username: `owner_b_${Date.now()}`,
      email: `owner_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true
    });

    // 4. Organizaciones
    orgA = await Organization.create({
      id: uuidv4(),
      name: `Clinica Timeline Alfa ${Date.now()}`,
      slug: `tl-alfa-${Date.now()}`,
      type: 'CLINIC',
      ownerId: ownerA.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Clinica Timeline Beta ${Date.now()}`,
      slug: `tl-beta-${Date.now()}`,
      type: 'CLINIC',
      ownerId: ownerB.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    await ownerA.update({ organizationId: orgA.id });
    await ownerB.update({ organizationId: orgB.id });

    // 5. Doctor Org A
    doctorUserA = await User.create({
      id: uuidv4(),
      username: `dr_tl_a_${Date.now()}`,
      email: `dr_tl_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Roberto',
      lastName: 'García'
    });

    doctorModelA = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserA.id,
      organizationId: orgA.id,
      licenseNumber: `MED-TL-${Date.now()}`,
      specialtyId: specialtyCardio.id
    });

    // 6. Paciente A (Org A)
    patientUserA = await User.create({
      id: uuidv4(),
      username: `pat_tl_a_${Date.now()}`,
      email: `pat_tl_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Carlos',
      lastName: 'Mendoza'
    });

    patientModelA = await Patient.create({
      id: uuidv4(),
      userId: patientUserA.id,
      organizationId: orgA.id,
      documentId: `V-${Date.now().toString().slice(-8)}`,
      medicalRecordNumber: `HC-TLA-${Date.now()}`,
      bloodType: 'O+',
      allergies: 'Penicilina'
    });

    // Paciente A2 (Org A - misma clínica, diferente usuario)
    const patientUserA2 = await User.create({
      id: uuidv4(),
      username: `pat_tl_a2_${Date.now()}`,
      email: `pat_a2_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Lucía',
      lastName: 'Pérez'
    });

    const patientModelA2 = await Patient.create({
      id: uuidv4(),
      userId: patientUserA2.id,
      organizationId: orgA.id,
      documentId: `V-${(Date.now() + 50).toString().slice(-8)}`,
      medicalRecordNumber: `HC-TLA2-${Date.now()}`
    });

    // 7. Paciente B (Org B)
    patientUserB = await User.create({
      id: uuidv4(),
      username: `pat_tl_b_${Date.now()}`,
      email: `pat_tl_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgB.id,
      isActive: true,
      firstName: 'María',
      lastName: 'Salas'
    });

    patientModelB = await Patient.create({
      id: uuidv4(),
      userId: patientUserB.id,
      organizationId: orgB.id,
      documentId: `V-${(Date.now() + 10).toString().slice(-8)}`,
      medicalRecordNumber: `HC-TLB-${Date.now()}`
    });

    adminUserB = ownerB;

    // 8. Crear Eventos Clínicos Longitudinales para Paciente A
    const t0 = new Date(Date.now() - 86400000 * 5); // Hace 5 días: Cita médica inicial
    const t1 = new Date(Date.now() - 86400000 * 4); // Hace 4 días: Pago de la consulta
    const t2 = new Date(Date.now() - 86400000 * 3); // Hace 3 días: Historia y receta
    const t3 = new Date(Date.now() - 86400000 * 2); // Hace 2 días: Examen de laboratorio
    const t4 = new Date(Date.now() - 86400000 * 1); // Hace 1 día: Admisión hospitalaria

    // Cita
    await Appointment.create({
      id: uuidv4(),
      organizationId: orgA.id,
      patientId: patientModelA.id,
      doctorId: doctorModelA.id,
      date: t0,
      status: 'Completed',
      type: 'In-Person',
      reason: 'Dolor torácico opresivo'
    });

    // Pago
    await Payment.create({
      id: uuidv4(),
      organizationId: orgA.id,
      patientId: patientModelA.id,
      amount: 80.00,
      amountBs: 2880.00,
      currency: 'USD',
      method: 'Punto de Venta',
      status: 'Paid',
      createdAt: t1
    });

    // Historia Médica con Receta
    const mr = await MedicalRecord.create({
      id: uuidv4(),
      organizationId: orgA.id,
      patientId: patientModelA.id,
      doctorId: doctorModelA.id,
      diagnosis: 'Hipertensión arterial estadio 2 (I10)',
      treatment: 'Iniciar esquema antihipertensivo',
      indications: 'Dieta hiposódica y control de presión',
      createdAt: t2
    });

    await Prescription.create({
      id: uuidv4(),
      organizationId: orgA.id,
      medicalRecordId: mr.id,
      drugName: 'Losartán Potásico',
      dosage: '50mg',
      frequency: 'Cada 12 horas',
      duration: '30 días',
      status: 'active',
      createdAt: t2
    });

    // Resultado de Laboratorio
    await LabResult.create({
      id: uuidv4(),
      organizationId: orgA.id,
      patientId: patientModelA.id,
      testName: 'Perfil Lipídico y Enzimas Cardíacas',
      resultValue: 'Troponina I negativa, Colesterol Total: 210 mg/dL',
      status: 'Completed',
      createdAt: t3
    });

    // Admisión Hospitalaria
    await Admission.create({
      id: uuidv4(),
      organizationId: orgA.id,
      patientId: patientModelA.id,
      attendingDoctorId: doctorModelA.id,
      admissionNumber: `ADM-${Date.now()}`,
      episodeNumber: `EP-${Date.now()}`,
      admissionType: 'HOSPITALIZATION',
      initialDiagnosis: 'Observación coronaria 24h',
      admissionDate: t4,
      status: 'ADMITTED',
      roomNumber: '204',
      bedNumber: 'B-204'
    });

    // Configurar Express App de prueba
    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      if (authHeader === 'Bearer mock-token-pat-a') {
        req.user = { id: patientUserA.id, role: 'PATIENT', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-pat-a2') {
        req.user = { id: patientUserA2.id, role: 'PATIENT', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-pat-b') {
        req.user = { id: patientUserB.id, role: 'PATIENT', organizationId: orgB.id };
      } else if (authHeader === 'Bearer mock-token-dr-a') {
        req.user = { id: doctorUserA.id, role: 'DOCTOR', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-admin-b') {
        req.user = { id: adminUserB.id, role: 'ADMIN', organizationId: orgB.id };
      } else if (authHeader === 'Bearer mock-token-superadmin') {
        req.user = { id: uuidv4(), role: 'SUPERADMIN', organizationId: null };
      }
      next();
    });

    const mockAuthMiddleware = (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Acceso no autorizado' });
      }
      next();
    };

    app.get('/api/patients/:id/timeline', mockAuthMiddleware, patientController.getPatientTimeline);
  });

  afterAll(async () => {
    try {
      await setTenantContext(sequelize, { isSuperAdmin: true });
      if (orgA) {
        await Admission.destroy({ where: { organizationId: orgA.id } });
        await LabResult.destroy({ where: { organizationId: orgA.id } });
        await Prescription.destroy({ where: { organizationId: orgA.id } });
        await MedicalRecord.destroy({ where: { organizationId: orgA.id } });
        await Payment.destroy({ where: { organizationId: orgA.id } });
        await Appointment.destroy({ where: { organizationId: orgA.id } });
        await Patient.destroy({ where: { organizationId: orgA.id } });
        await Doctor.destroy({ where: { organizationId: orgA.id } });
        await User.destroy({ where: { organizationId: orgA.id } });
        await Organization.destroy({ where: { id: orgA.id } });
      }
      if (orgB) {
        await Patient.destroy({ where: { organizationId: orgB.id } });
        await User.destroy({ where: { organizationId: orgB.id } });
        await Organization.destroy({ where: { id: orgB.id } });
      }
      if (specialtyCardio) {
        await Specialty.destroy({ where: { id: specialtyCardio.id } });
      }
    } catch (e) {
      console.error('Error cleaning test data:', e);
    }
  });

  // =========================================================================
  // 1. AUTHENTICATION & IDOR SECURITY CHECKS
  // =========================================================================
  describe('1. Autenticación & Protección Anti-IDOR', () => {
    it('🔒 Rechaza con 401 si no se envía cabecera de autenticación', async () => {
      const res = await request(app).get(`/api/patients/${patientModelA.id}/timeline`);
      expect(res.status).toBe(401);
    });

    it('✅ Permite al Paciente A consultar SU PROPIO timeline longitudinal', async () => {
      const res = await request(app)
        .get(`/api/patients/${patientModelA.id}/timeline`)
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(200);
      expect(res.body.patient.id).toBe(patientModelA.id);
      expect(res.body.patient.fullName).toBe('Carlos Mendoza');
      expect(res.body.patient.bloodType).toBe('O+');
      expect(res.body.patient.allergies).toBe('Penicilina');
    });

    it('🔒 Bloquea con 403 Forbidden cuando otro Paciente A2 de la misma clínica intenta consultar el timeline del Paciente A (Anti-IDOR)', async () => {
      const res = await request(app)
        .get(`/api/patients/${patientModelA.id}/timeline`)
        .set('Authorization', 'Bearer mock-token-pat-a2');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/permisos/i);
    });

    it('🛡️ Retorna 404 Not Found cuando un Paciente B de otra clínica intenta consultar el timeline del Paciente A (Anti-Enumeración Cross-Tenant)', async () => {
      const res = await request(app)
        .get(`/api/patients/${patientModelA.id}/timeline`)
        .set('Authorization', 'Bearer mock-token-pat-b');

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no encontrado/i);
    });
  });

  // =========================================================================
  // 2. CLINICAL RBAC & MULTI-TENANT ISOLATION
  // =========================================================================
  describe('2. RBAC Clínico & Aislamiento Multi-Tenant', () => {
    it('✅ Permite al Doctor de la clínica consultar el timeline del paciente', async () => {
      const res = await request(app)
        .get(`/api/patients/${patientModelA.id}/timeline`)
        .set('Authorization', 'Bearer mock-token-dr-a');

      expect(res.status).toBe(200);
      expect(res.body.patient.id).toBe(patientModelA.id);
      expect(res.body.timeline).toBeDefined();
    });

    it('🛡️ Retorna 404 Not Found cuando un Admin de otra clínica (Tenant B) intenta ver un paciente de Tenant A', async () => {
      const res = await request(app)
        .get(`/api/patients/${patientModelA.id}/timeline`)
        .set('Authorization', 'Bearer mock-token-admin-b');

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no encontrado/i);
    });

    it('🌐 Superadmin puede consultar el timeline de cualquier paciente de la plataforma', async () => {
      const res = await request(app)
        .get(`/api/patients/${patientModelA.id}/timeline`)
        .set('Authorization', 'Bearer mock-token-superadmin');

      expect(res.status).toBe(200);
      expect(res.body.patient.id).toBe(patientModelA.id);
    });
  });

  // =========================================================================
  // 3. LONGITUDINAL AGGREGATION & EVENT ORDERING
  // =========================================================================
  describe('3. Agregación Longitudinal y Orden Cronológico', () => {
    it('📋 Agrega todos los dominios clínicos en orden cronológico descendente', async () => {
      const res = await request(app)
        .get(`/api/patients/${patientModelA.id}/timeline`)
        .set('Authorization', 'Bearer mock-token-dr-a');

      expect(res.status).toBe(200);
      const { timeline, summary } = res.body;

      // 6 eventos totales: 1 Admission, 1 LabResult, 1 MedicalRecord, 1 Prescription, 1 Payment, 1 Appointment
      expect(timeline.length).toBe(6);
      expect(summary.totalEvents).toBe(6);
      expect(summary.admissionsCount).toBe(1);
      expect(summary.labResultsCount).toBe(1);
      expect(summary.medicalRecordsCount).toBe(1);
      expect(summary.prescriptionsCount).toBe(1);
      expect(summary.paymentsCount).toBe(1);
      expect(summary.appointmentsCount).toBe(1);

      // Verificación de orden descendente por fecha
      for (let i = 0; i < timeline.length - 1; i++) {
        const currentDate = new Date(timeline[i].date).getTime();
        const nextDate = new Date(timeline[i + 1].date).getTime();
        expect(currentDate).toBeGreaterThanOrEqual(nextDate);
      }

      // El evento más reciente debe ser la Admisión (t4)
      expect(timeline[0].type).toBe('ADMISSION');
      expect(timeline[0].title).toMatch(/Admisi.*n Hospitalaria/i);

      // El evento más antiguo debe ser la Cita inicial (t0)
      expect(timeline[timeline.length - 1].type).toBe('APPOINTMENT');
      expect(timeline[timeline.length - 1].description).toBe('Dolor torácico opresivo');
    });

    it('🔍 Permite filtrar eventos por tipo mediante parámetro query (?type=APPOINTMENT,PAYMENT)', async () => {
      const res = await request(app)
        .get(`/api/patients/${patientModelA.id}/timeline?type=APPOINTMENT,PAYMENT`)
        .set('Authorization', 'Bearer mock-token-dr-a');

      expect(res.status).toBe(200);
      const { timeline, summary } = res.body;

      // Debe incluir únicamente 2 eventos (1 Appointment y 1 Payment)
      expect(timeline.length).toBe(2);
      const eventTypes = timeline.map(e => e.type);
      expect(eventTypes).toContain('APPOINTMENT');
      expect(eventTypes).toContain('PAYMENT');
      expect(eventTypes).not.toContain('MEDICAL_RECORD');
      expect(eventTypes).not.toContain('LAB_RESULT');
      expect(eventTypes).not.toContain('ADMISSION');

      expect(summary.totalEvents).toBe(2);
      expect(summary.appointmentsCount).toBe(1);
      expect(summary.paymentsCount).toBe(1);
    });
  });
});
