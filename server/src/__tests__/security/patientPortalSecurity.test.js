'use strict';

/**
 * 🛡️ FASE 23: Patient Portal Security, Anti-IDOR & Self-Service Suite
 * Tests multi-tenant isolation, strict anti-IDOR checks, least-privilege RBAC,
 * clinical report confidentiality (verified lab results only), digital health card,
 * tamper-proof profile modifications, append-only audit logging, and domain event bus integration.
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
  Role,
  Specialty,
  Appointment,
  LabResult,
  MedicalRecord,
  Prescription,
  Payment,
  AuditLog,
  sequelize
} = require('../../models');
const portalController = require('../../controllers/patientPortal.controller');
const { authorize } = require('../../middlewares/authorization.middleware');
const { eventBus, DOMAIN_EVENTS } = require('../../events/eventBus');

describe('🛡️ FASE 23: Patient Portal Security & Anti-IDOR Suite', () => {
  let app;
  let orgA;
  let orgB;
  let adminUserA;
  let adminUserB;
  let doctorUserA;
  let doctorA;
  let patientUserA;
  let patientA;
  let patientUserA2;
  let patientA2;
  let patientUserB;
  let patientB;
  let superadminUser;
  let specialtyCardio;

  beforeAll(async () => {
    await sequelize.authenticate();
    await setTenantContext(sequelize, { isSuperAdmin: true });

    // 1. Roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'ADMIN' }, defaults: { description: 'Administrador' } });
    const [patientRole] = await Role.findOrCreate({ where: { name: 'PATIENT' }, defaults: { description: 'Paciente' } });
    const [doctorRole] = await Role.findOrCreate({ where: { name: 'DOCTOR' }, defaults: { description: 'Médico' } });
    const [superAdminRole] = await Role.findOrCreate({ where: { name: 'SUPERADMIN' }, defaults: { description: 'Super Admin' } });

    // 2. Specialty
    const [cardio] = await Specialty.findOrCreate({
      where: { name: 'Cardiología Portal Test' },
      defaults: { description: 'Especialidad Portal Test' }
    });
    specialtyCardio = cardio;

    // 3. Super Admin User for audit logging foreign key reference
    superadminUser = await User.create({
      id: uuidv4(),
      username: `sadmin_portal_${Date.now()}`,
      email: `sadmin_portal_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: superAdminRole.id,
      isActive: true,
      firstName: 'Super',
      lastName: 'Admin'
    });

    // 4. Organization A & Admin A
    adminUserA = await User.create({
      id: uuidv4(),
      username: `admin_portal_a_${Date.now()}`,
      email: `admin_portal_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Portal Alfa'
    });

    orgA = await Organization.create({
      id: uuidv4(),
      name: `Clínica Portal Alfa ${Date.now()}`,
      slug: `portal-alfa-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserA.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });
    await adminUserA.update({ organizationId: orgA.id });

    // 5. Organization B & Admin B
    adminUserB = await User.create({
      id: uuidv4(),
      username: `admin_portal_b_${Date.now()}`,
      email: `admin_portal_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Portal Beta'
    });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Clínica Portal Beta ${Date.now()}`,
      slug: `portal-beta-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserB.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });
    await adminUserB.update({ organizationId: orgB.id });

    // 6. Doctor in Org A
    doctorUserA = await User.create({
      id: uuidv4(),
      username: `doc_portal_a_${Date.now()}`,
      email: `doc_portal_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Carlos',
      lastName: 'Mendoza'
    });

    doctorA = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserA.id,
      specialtyId: specialtyCardio.id,
      licenseNumber: `MED-PORTAL-${Date.now().toString().slice(-6)}`,
      organizationId: orgA.id
    });

    // 7. Patient A (Org A)
    patientUserA = await User.create({
      id: uuidv4(),
      username: `pat_portal_a_${Date.now()}`,
      email: `pat_portal_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Ana',
      lastName: 'González'
    });

    patientA = await Patient.create({
      id: uuidv4(),
      userId: patientUserA.id,
      organizationId: orgA.id,
      phone: '+584129990101',
      documentId: `V-${Date.now().toString().slice(-8)}`,
      medicalRecordNumber: `HC-ALFA-${Date.now().toString().slice(-6)}`,
      bloodType: 'O+',
      allergies: 'Penicilina',
      hasInsurance: true,
      insuranceProvider: 'Seguros Mercantil',
      policyNumber: 'POL-998877',
      coverageStatus: 'ACTIVE',
      familyInfo: [{ name: 'Juan González', relationship: 'Esposo', phone: '+584129990109' }]
    });

    // 8. Patient A2 (Org A - Intra-Tenant Anti-IDOR check)
    patientUserA2 = await User.create({
      id: uuidv4(),
      username: `pat_portal_a2_${Date.now()}`,
      email: `pat_portal_a2_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Marcos',
      lastName: 'Peña'
    });

    patientA2 = await Patient.create({
      id: uuidv4(),
      userId: patientUserA2.id,
      organizationId: orgA.id,
      phone: '+584129990102',
      documentId: `V-${(Date.now() + 1).toString().slice(-8)}`,
      medicalRecordNumber: `HC-ALFA-${(Date.now() + 1).toString().slice(-6)}`,
      bloodType: 'A+',
      allergies: 'Ninguna'
    });

    // 9. Patient B (Org B - Cross-Tenant check)
    patientUserB = await User.create({
      id: uuidv4(),
      username: `pat_portal_b_${Date.now()}`,
      email: `pat_portal_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgB.id,
      isActive: true,
      firstName: 'Beatriz',
      lastName: 'López'
    });

    patientB = await Patient.create({
      id: uuidv4(),
      userId: patientUserB.id,
      organizationId: orgB.id,
      phone: '+584129990103',
      documentId: `V-${(Date.now() + 2).toString().slice(-8)}`,
      medicalRecordNumber: `HC-BETA-${(Date.now() + 2).toString().slice(-6)}`,
      bloodType: 'B-'
    });

    // 10. Express App Setup with simulated Auth
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
      } else if (authHeader === 'Bearer mock-token-admin-a') {
        req.user = { id: adminUserA.id, role: 'ADMIN', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-superadmin') {
        req.user = { id: superadminUser.id, role: 'SUPERADMIN', organizationId: null };
      }
      next();
    });

    const mockAuthMiddleware = (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Acceso no autorizado' });
      }
      next();
    };

    app.get('/api/portal/profile', mockAuthMiddleware, authorize('portal:read'), portalController.getProfile);
    app.put('/api/portal/profile', mockAuthMiddleware, authorize('portal:write'), portalController.updateProfile);
    app.get('/api/portal/appointments', mockAuthMiddleware, authorize('portal:read'), portalController.getAppointments);
    app.post('/api/portal/appointments', mockAuthMiddleware, authorize('portal:write'), portalController.bookAppointment);
    app.post('/api/portal/appointments/:id/cancel', mockAuthMiddleware, authorize('portal:write'), portalController.cancelAppointment);
    app.get('/api/portal/lab-results', mockAuthMiddleware, authorize('portal:read'), portalController.getLabResults);
    app.get('/api/portal/prescriptions', mockAuthMiddleware, authorize('portal:read'), portalController.getPrescriptions);
    app.get('/api/portal/payments', mockAuthMiddleware, authorize('portal:read'), portalController.getPayments);
    app.get('/api/portal/health-card', mockAuthMiddleware, authorize('portal:read'), portalController.getHealthCard);
  });

  afterAll(async () => {
    try {
      await setTenantContext(sequelize, { isSuperAdmin: true });
      await Prescription.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await MedicalRecord.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await LabResult.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Payment.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Appointment.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Patient.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Doctor.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Organization.destroy({ where: { id: [orgA?.id, orgB?.id] }, force: true });
      await User.destroy({
        where: {
          id: [
            adminUserA?.id,
            adminUserB?.id,
            doctorUserA?.id,
            patientUserA?.id,
            patientUserA2?.id,
            patientUserB?.id,
            superadminUser?.id
          ].filter(Boolean)
        },
        force: true
      });
      if (specialtyCardio) await Specialty.destroy({ where: { id: specialtyCardio.id } });
    } catch (e) {
      // Append-only audit trigger prevents deletion of audit logs; ignore cascade warnings
    }
  });

  beforeEach(() => {
    eventBus.clearHistory();
  });

  describe('1. Authentication & Role Scoping', () => {
    it('debe rechazar solicitudes anónimas con 401 Unauthorized', async () => {
      const res = await request(app).get('/api/portal/profile');
      expect(res.status).toBe(401);
    });

    it('debe retornar 404 si un usuario sin registro de paciente accede a su perfil', async () => {
      const res = await request(app)
        .get('/api/portal/profile')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Perfil de paciente no encontrado/i);
    });
  });

  describe('2. Anti-IDOR Demographic Profile Isolation & Tamper Proofing', () => {
    it('debe devolver únicamente el perfil del paciente autenticado', async () => {
      const resA = await request(app)
        .get('/api/portal/profile')
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(resA.status).toBe(200);
      expect(resA.body.id).toBe(patientA.id);
      expect(resA.body.firstName).toBe('Ana');
      expect(resA.body.bloodType).toBe('O+');

      const resB = await request(app)
        .get('/api/portal/profile')
        .set('Authorization', 'Bearer mock-token-pat-b');

      expect(resB.status).toBe(200);
      expect(resB.body.id).toBe(patientB.id);
      expect(resB.body.firstName).toBe('Beatriz');
      expect(resB.body.bloodType).toBe('B-');
    });

    it('debe permitir actualizar campos demográficos no sensibles', async () => {
      const res = await request(app)
        .put('/api/portal/profile')
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({
          phone: '+584121112233',
          address: 'Urbanización Los Palos Grandes, Caracas',
          allergies: 'Penicilina, Sulfas'
        });

      expect(res.status).toBe(200);
      expect(res.body.profile.phone).toBe('+584121112233');
      expect(res.body.profile.allergies).toBe('Penicilina, Sulfas');

      // Verify in DB
      const updated = await Patient.findByPk(patientA.id);
      expect(updated.phone).toBe('+584121112233');
      expect(updated.allergies).toBe('Penicilina, Sulfas');
    });

    it('debe prevenir manipulación de identificadores clínicos críticos (anti-tampering)', async () => {
      const originalMRN = patientA.medicalRecordNumber;
      const originalDocId = patientA.documentId;

      const res = await request(app)
        .put('/api/portal/profile')
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({
          medicalRecordNumber: 'HACKED-999999',
          documentId: 'V-00000000',
          userId: uuidv4(),
          organizationId: orgB.id
        });

      expect(res.status).toBe(200);
      const reloaded = await Patient.findByPk(patientA.id);
      expect(reloaded.medicalRecordNumber).toBe(originalMRN);
      expect(reloaded.documentId).toBe(originalDocId);
      expect(reloaded.organizationId).toBe(orgA.id);
    });
  });

  describe('3. Appointments Self-Management & Anti-IDOR Cancellation', () => {
    let apptA;
    let apptA2;

    beforeAll(async () => {
      // Future appointment for Patient A
      apptA = await Appointment.create({
        patientId: patientA.id,
        doctorId: doctorA.id,
        date: new Date(Date.now() + 86400000 * 2), // in 2 days
        reason: 'Chequeo Preventivo Alfa',
        status: 'Confirmed',
        organizationId: orgA.id
      });

      // Future appointment for Patient A2
      apptA2 = await Appointment.create({
        patientId: patientA2.id,
        doctorId: doctorA.id,
        date: new Date(Date.now() + 86400000 * 3), // in 3 days
        reason: 'Chequeo Preventivo A2',
        status: 'Confirmed',
        organizationId: orgA.id
      });
    });

    it('debe listar solo las citas correspondientes al paciente autenticado', async () => {
      const res = await request(app)
        .get('/api/portal/appointments')
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(200);
      expect(res.body.appointments.length).toBeGreaterThanOrEqual(1);
      const apptIds = res.body.appointments.map(a => a.id);
      expect(apptIds).toContain(apptA.id);
      expect(apptIds).not.toContain(apptA2.id); // Anti-IDOR check
    });

    it('debe permitir al paciente agendar una nueva cita válida', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 5); // in 5 days
      const res = await request(app)
        .post('/api/portal/appointments')
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({
          doctorId: doctorA.id,
          date: futureDate.toISOString(),
          reason: 'Consulta General'
        });

      expect(res.status).toBe(201);
      expect(res.body.appointment.patientId).toBe(patientA.id);
      expect(res.body.appointment.status).toBe('Confirmed');

      // Verify domain event published
      const events = eventBus.getRecentEvents().filter(e => e.eventName === DOMAIN_EVENTS.PORTAL_APPOINTMENT_BOOKED);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].payload.patientId).toBe(patientA.id);
    });

    it('debe rechazar agendamiento en horario conflictivo con 409 Conflict', async () => {
      // Try to book at the exact same time as apptA
      const res = await request(app)
        .post('/api/portal/appointments')
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({
          doctorId: doctorA.id,
          date: apptA.date,
          reason: 'Conflicto intencional'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/no está disponible/i);
    });

    it('debe rechazar agendamiento con fecha en el pasado con 400 Bad Request', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const res = await request(app)
        .post('/api/portal/appointments')
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({
          doctorId: doctorA.id,
          date: pastDate.toISOString(),
          reason: 'Cita en el pasado'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/debe ser futura/i);
    });

    it('debe denegar con 403 si el paciente A intenta cancelar la cita del paciente A2 (Anti-IDOR)', async () => {
      const res = await request(app)
        .post(`/api/portal/appointments/${apptA2.id}/cancel`)
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({ reason: 'Intento malicioso de cancelar cita ajena' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/no puedes cancelar citas de otros pacientes/i);

      // Verify status in DB remained Confirmed
      const reloaded = await Appointment.findByPk(apptA2.id);
      expect(reloaded.status).toBe('Confirmed');
    });

    it('debe denegar con 404 cross-tenant si un paciente de Org B intenta cancelar cita de Org A', async () => {
      const res = await request(app)
        .post(`/api/portal/appointments/${apptA2.id}/cancel`)
        .set('Authorization', 'Bearer mock-token-pat-b')
        .send({ reason: 'Ataque entre clínicas' });

      expect(res.status).toBe(404);
    });

    it('debe permitir al paciente cancelar su propia cita', async () => {
      const res = await request(app)
        .post(`/api/portal/appointments/${apptA.id}/cancel`)
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({ reason: 'Imprevisto de trabajo' });

      expect(res.status).toBe(200);
      expect(res.body.appointment.status).toBe('Cancelled');

      const reloaded = await Appointment.findByPk(apptA.id);
      expect(reloaded.status).toBe('Cancelled');

      // Verify domain event
      const cancelEvents = eventBus.getRecentEvents().filter(e => e.eventName === DOMAIN_EVENTS.PORTAL_APPOINTMENT_CANCELLED);
      expect(cancelEvents.length).toBeGreaterThanOrEqual(1);
      expect(cancelEvents[0].payload.appointmentId).toBe(apptA.id);
    });

    it('debe rechazar cancelar una cita ya cancelada con 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/portal/appointments/${apptA.id}/cancel`)
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({ reason: 'Repetir cancelación' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/ya se encuentra cancelada/i);
    });

    it('debe rechazar cancelar una cita ya completada con 400 Bad Request', async () => {
      const completedAppt = await Appointment.create({
        patientId: patientA.id,
        doctorId: doctorA.id,
        date: new Date(Date.now() - 86400000 * 5),
        reason: 'Consulta finalizada',
        status: 'Completed',
        organizationId: orgA.id
      });

      const res = await request(app)
        .post(`/api/portal/appointments/${completedAppt.id}/cancel`)
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({ reason: 'Cancelar cita pasada' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/que ya ha sido completada/i);
    });
  });

  describe('4. Clinical Data Confidentiality: Verified Lab Results & Prescriptions', () => {
    let completedLabA;
    let pendingLabA;
    let labB;
    let medRecA;
    let prescA;

    beforeAll(async () => {
      // Completed verified lab result for Patient A
      completedLabA = await LabResult.create({
        patientId: patientA.id,
        testName: 'Perfil Lipídico Completo',
        resultValue: 'Colesterol Total: 185 mg/dL, HDL: 52 mg/dL, Triglicéridos: 120 mg/dL',
        referenceRange: 'Colesterol < 200 mg/dL',
        status: 'Completed',
        organizationId: orgA.id
      });

      // Pending (unverified) lab result for Patient A
      pendingLabA = await LabResult.create({
        patientId: patientA.id,
        testName: 'Hemograma en Proceso',
        resultValue: 'En análisis por laboratorio',
        status: 'Pending',
        organizationId: orgA.id
      });

      // Lab result for Patient B
      labB = await LabResult.create({
        patientId: patientB.id,
        testName: 'Glicemia Basal Beta',
        resultValue: '90 mg/dL',
        status: 'Completed',
        organizationId: orgB.id
      });

      // Medical Record & Active Prescription for Patient A
      medRecA = await MedicalRecord.create({
        patientId: patientA.id,
        doctorId: doctorA.id,
        diagnosis: 'Hipertensión arterial esencial estadio 1',
        treatment: 'Losartán Potásico 50mg',
        organizationId: orgA.id
      });

      prescA = await Prescription.create({
        medicalRecordId: medRecA.id,
        drugName: 'Losartán Potásico',
        dosage: '50mg',
        frequency: 'Cada 24 horas',
        duration: '30 días',
        instructions: 'Tomar en las mañanas con agua',
        status: 'active',
        organizationId: orgA.id
      });
    });

    it('debe exponer únicamente resultados de laboratorio Completados y Verificados (Anti-IDOR)', async () => {
      const res = await request(app)
        .get('/api/portal/lab-results')
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(200);
      const resultIds = res.body.results.map(r => r.id);

      // Must contain verified completed lab
      expect(resultIds).toContain(completedLabA.id);
      // Must NOT contain pending/draft lab
      expect(resultIds).not.toContain(pendingLabA.id);
      // Must NOT contain Patient B lab (Anti-IDOR)
      expect(resultIds).not.toContain(labB.id);
    });

    it('debe listar solo recetas activas vinculadas a las consultas del paciente', async () => {
      const res = await request(app)
        .get('/api/portal/prescriptions')
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const p = res.body.find(x => x.id === prescA.id);
      expect(p).toBeDefined();
      expect(p.drugName).toBe('Losartán Potásico');
      expect(p.MedicalRecord.patientId).toBe(patientA.id);
      expect(p.MedicalRecord.Doctor.User.firstName).toBe('Carlos');
    });
  });

  describe('5. Financial Receipts & Billing Anti-IDOR', () => {
    let paymentA;
    let paymentB;

    beforeAll(async () => {
      paymentA = await Payment.create({
        patientId: patientA.id,
        amount: 60.00,
        amountBs: 2160.00,
        method: 'Punto de Venta',
        currency: 'USD',
        status: 'Paid',
        concept: 'Consulta Cardiología',
        reference: `REC-A-${Date.now()}`,
        organizationId: orgA.id
      });

      paymentB = await Payment.create({
        patientId: patientB.id,
        amount: 80.00,
        amountBs: 2880.00,
        method: 'Transferencia',
        currency: 'USD',
        status: 'Paid',
        concept: 'Consulta Ginecológica Beta',
        reference: `REC-B-${Date.now()}`,
        organizationId: orgB.id
      });
    });

    it('debe mostrar únicamente los recibos de pago del paciente autenticado', async () => {
      const res = await request(app)
        .get('/api/portal/payments')
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(200);
      const paymentIds = res.body.payments.map(p => p.id);
      expect(paymentIds).toContain(paymentA.id);
      expect(paymentIds).not.toContain(paymentB.id); // Strict Anti-IDOR
    });
  });

  describe('6. Digital Health Card / Health Passport', () => {
    it('debe consolidar información médica vital y prescripciones activas', async () => {
      const res = await request(app)
        .get('/api/portal/health-card')
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(200);
      expect(res.body.cardId).toBe(patientA.id);
      expect(res.body.patientName).toBe('Ana González');
      expect(res.body.bloodType).toBe('O+');
      expect(res.body.insurance.hasInsurance).toBe(true);
      expect(res.body.insurance.provider).toBe('Seguros Mercantil');
      expect(res.body.activePrescriptionsCount).toBeGreaterThanOrEqual(1);
      expect(res.body.emergencyContact).toBeDefined();
      expect(res.body.issuedAt).toBeDefined();
    });
  });

  describe('7. Tamper-Evident Audit Logging', () => {
    it('debe registrar eventos de auditoría para accesos y modificaciones en el portal', async () => {
      // Query recent audit logs for patient A
      const logs = await AuditLog.findAll({
        where: {
          entityId: patientA.id,
          action: 'PORTAL_PROFILE_ACCESSED'
        },
        order: [['timestamp', 'DESC']],
        limit: 5
      });

      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].entity).toBe('Patient');
      expect(logs[0].organizationId).toBe(orgA.id);
    });
  });
});
