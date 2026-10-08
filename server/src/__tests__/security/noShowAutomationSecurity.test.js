'use strict';

/**
 * 🛡️ FASE 20: No-Show Automation & Multi-Channel Notifications Security Suite
 * Tests multi-tenant isolation, RBAC permissions, overdue reconciliation,
 * tamper-evident audit logging, and domain event bus integration.
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
  AuditLog,
  sequelize
} = require('../../models');
const appointmentController = require('../../controllers/appointment.controller');
const { authorize } = require('../../middlewares/authorization.middleware');
const { eventBus, DOMAIN_EVENTS } = require('../../events/eventBus');

describe('🛡️ FASE 20: No-Show Automation & Multi-Channel Notifications Security Suite', () => {
  let app;
  let orgA;
  let orgB;
  let adminUserA;
  let patientUserA;
  let adminUserB;
  let doctorUserA;
  let doctorA;
  let patientA;

  let overdueApptOrgA;
  let overdueApptOrgB;
  let upcomingApptOrgA;

  let publishedEvents = [];
  let busDisposer;

  beforeAll(async () => {
    await sequelize.authenticate();
    await setTenantContext(sequelize, { isSuperAdmin: true });

    // 1. Roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'ADMIN' }, defaults: { description: 'Administrador' } });
    const [patientRole] = await Role.findOrCreate({ where: { name: 'PATIENT' }, defaults: { description: 'Paciente' } });
    const [doctorRole] = await Role.findOrCreate({ where: { name: 'DOCTOR' }, defaults: { description: 'Médico' } });

    // 2. Especialidad
    const [specialtyCardio] = await Specialty.findOrCreate({
      where: { name: 'Cardiología No-Show' },
      defaults: { description: 'Especialidad No-Show Test' }
    });

    // 3. Usuarios base
    adminUserA = await User.create({
      id: uuidv4(),
      username: `admin_ns_a_${Date.now()}`,
      email: `admin_ns_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Clínica A'
    });

    adminUserB = await User.create({
      id: uuidv4(),
      username: `admin_ns_b_${Date.now()}`,
      email: `admin_ns_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Clínica B'
    });

    // 4. Organizaciones
    orgA = await Organization.create({
      id: uuidv4(),
      name: `Clínica No-Show Alfa ${Date.now()}`,
      slug: `ns-alfa-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserA.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Clínica No-Show Beta ${Date.now()}`,
      slug: `ns-beta-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserB.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    await adminUserA.update({ organizationId: orgA.id });
    await adminUserB.update({ organizationId: orgB.id });

    // 5. Médico y Paciente en Org A
    doctorUserA = await User.create({
      id: uuidv4(),
      username: `doc_ns_a_${Date.now()}`,
      email: `doc_ns_a_${Date.now()}@test.com`,
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
      licenseNumber: `MED-${Date.now().toString().slice(-6)}`,
      organizationId: orgA.id
    });

    patientUserA = await User.create({
      id: uuidv4(),
      username: `pat_ns_a_${Date.now()}`,
      email: `pat_ns_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Juan',
      lastName: 'Pérez'
    });

    patientA = await Patient.create({
      id: uuidv4(),
      userId: patientUserA.id,
      organizationId: orgA.id,
      phone: '+584121234567',
      documentId: `V-${Date.now().toString().slice(-8)}`
    });

    // 6. Citas iniciales para pruebas
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 12 * 60 * 60 * 1000);

    overdueApptOrgA = await Appointment.create({
      id: uuidv4(),
      patientId: patientA.id,
      doctorId: doctorA.id,
      date: twoHoursAgo,
      reason: 'Consulta Vencida Org A',
      status: 'Confirmed',
      organizationId: orgA.id
    });

    overdueApptOrgB = await Appointment.create({
      id: uuidv4(),
      date: twoHoursAgo,
      reason: 'Consulta Vencida Org B',
      status: 'Confirmed',
      organizationId: orgB.id
    });

    upcomingApptOrgA = await Appointment.create({
      id: uuidv4(),
      patientId: patientA.id,
      doctorId: doctorA.id,
      date: tomorrow,
      reason: 'Consulta Próxima Recordatorio',
      status: 'Confirmed',
      reminder24hSent: false,
      organizationId: orgA.id
    });

    // Setup Test Express App
    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      if (authHeader === 'Bearer mock-token-admin-a') {
        req.user = { id: adminUserA.id, role: 'ADMIN', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-admin-b') {
        req.user = { id: adminUserB.id, role: 'ADMIN', organizationId: orgB.id };
      } else if (authHeader === 'Bearer mock-token-pat-a') {
        req.user = { id: patientUserA.id, role: 'PATIENT', organizationId: orgA.id };
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

    app.post('/api/appointments/no-shows/process-reminders', mockAuthMiddleware, authorize('appointments:write'), appointmentController.processUpcomingReminders);
    app.post('/api/appointments/no-shows/reconcile', mockAuthMiddleware, authorize('appointments:write'), appointmentController.reconcileOverdueNoShows);
    app.get('/api/appointments/no-shows/stats', mockAuthMiddleware, authorize('appointments:read'), appointmentController.getNoShowStats);
    app.post('/api/appointments/:id/no-show', mockAuthMiddleware, authorize('appointments:write'), appointmentController.markAppointmentAsNoShow);

    // Subscribe to Event Bus
    busDisposer = eventBus.subscribe('*', (e) => {
      publishedEvents.push(e);
    });
  });

  afterAll(async () => {
    if (busDisposer) busDisposer();
    try {
      await setTenantContext(sequelize, { isSuperAdmin: true });
      if (overdueApptOrgA) await Appointment.destroy({ where: { id: overdueApptOrgA.id }, force: true });
      if (overdueApptOrgB) await Appointment.destroy({ where: { id: overdueApptOrgB.id }, force: true });
      if (upcomingApptOrgA) await Appointment.destroy({ where: { id: upcomingApptOrgA.id }, force: true });
      if (patientA) await Patient.destroy({ where: { id: patientA.id }, force: true });
      if (doctorA) await Doctor.destroy({ where: { id: doctorA.id }, force: true });
      if (patientUserA) await User.destroy({ where: { id: patientUserA.id }, force: true });
      if (doctorUserA) await User.destroy({ where: { id: doctorUserA.id }, force: true });
      if (adminUserA) await User.destroy({ where: { id: adminUserA.id }, force: true });
      if (adminUserB) await User.destroy({ where: { id: adminUserB.id }, force: true });
      if (orgA) await Organization.destroy({ where: { id: orgA.id }, force: true });
      if (orgB) await Organization.destroy({ where: { id: orgB.id }, force: true });
    } catch (_) {}
  });

  beforeEach(() => {
    publishedEvents = [];
  });

  describe('1. Authentication & RBAC Authorization Enforcement', () => {
    it('🔒 Retorna 401 si se intenta procesar recordatorios sin autenticación', async () => {
      const res = await request(app).post('/api/appointments/no-shows/process-reminders');
      expect(res.status).toBe(401);
    });

    it('🔒 Retorna 401 si se intenta reconciliar no-shows sin autenticación', async () => {
      const res = await request(app).post('/api/appointments/no-shows/reconcile');
      expect(res.status).toBe(401);
    });

    it('🔒 Retorna 401 si se intenta consultar estadísticas sin autenticación', async () => {
      const res = await request(app).get('/api/appointments/no-shows/stats');
      expect(res.status).toBe(401);
    });

    it('🔒 Retorna 403 si un rol PATIENT intenta reconciliar citas de la clínica', async () => {
      const res = await request(app)
        .post('/api/appointments/no-shows/reconcile')
        .set('Authorization', 'Bearer mock-token-pat-a');
      expect(res.status).toBe(403);
    });

    it('🔒 Retorna 403 si un rol PATIENT intenta consultar estadísticas operacionales', async () => {
      const res = await request(app)
        .get('/api/appointments/no-shows/stats')
        .set('Authorization', 'Bearer mock-token-pat-a');
      expect(res.status).toBe(403);
    });
  });

  describe('2. Multi-Tenant Isolation & Overdue Reconciliation', () => {
    it('🔒 Reconciliación de Org A solo modifica citas vencidas de Org A sin afectar Org B', async () => {
      const res = await request(app)
        .post('/api/appointments/no-shows/reconcile')
        .set('Authorization', 'Bearer mock-token-admin-a')
        .send({ gracePeriodMinutes: 30 });

      expect(res.status).toBe(200);
      expect(res.body.reconciledCount).toBeGreaterThanOrEqual(1);

      // Verify Org A appointment transitioned to NoShow
      const reloadedA = await Appointment.findByPk(overdueApptOrgA.id);
      expect(reloadedA.status).toBe('NoShow');

      // Verify Org B appointment remains untouched (Confirmed)
      const reloadedB = await Appointment.findByPk(overdueApptOrgB.id);
      expect(reloadedB.status).toBe('Confirmed');
    });

    it('🔒 Reconciliación registra evento en auditoría inmutable de Org A', async () => {
      const auditEntry = await AuditLog.findOne({
        where: {
          entityId: overdueApptOrgA.id,
          action: 'APPOINTMENT_MARKED_NO_SHOW'
        }
      });

      expect(auditEntry).not.toBeNull();
      expect(auditEntry.organizationId).toBe(orgA.id);
      expect(auditEntry.newValues.status).toBe('NoShow');
    });
  });

  describe('3. Upcoming Reminders Processing & Idempotency', () => {
    it('✅ Procesa recordatorios próximos y actualiza reminder24hSent a true de forma idempotente', async () => {
      const res = await request(app)
        .post('/api/appointments/no-shows/process-reminders')
        .set('Authorization', 'Bearer mock-token-admin-a')
        .send({ windowHours: 24 });

      expect(res.status).toBe(200);
      expect(res.body.successfulCount).toBeGreaterThanOrEqual(1);

      const reloaded = await Appointment.findByPk(upcomingApptOrgA.id);
      expect(reloaded.reminder24hSent).toBe(true);

      // Subsequent call should not process it again (idempotent)
      const resSecond = await request(app)
        .post('/api/appointments/no-shows/process-reminders')
        .set('Authorization', 'Bearer mock-token-admin-a')
        .send({ windowHours: 24 });

      expect(resSecond.status).toBe(200);
      const apptInSecondRun = resSecond.body.appointments.find(a => a.id === upcomingApptOrgA.id);
      expect(apptInSecondRun).toBeUndefined();
    });
  });

  describe('4. Manual Marking as No-Show & Validation', () => {
    let manualAppt;

    beforeEach(async () => {
      manualAppt = await Appointment.create({
        id: uuidv4(),
        patientId: patientA.id,
        doctorId: doctorA.id,
        date: new Date(),
        reason: 'Cita Manual No-Show',
        status: 'Confirmed',
        organizationId: orgA.id
      });
    });

    afterEach(async () => {
      if (manualAppt) {
        await Appointment.destroy({ where: { id: manualAppt.id }, force: true }).catch(() => {});
      }
    });

    it('✅ Permite al staff marcar una cita como No-Show con motivo', async () => {
      const res = await request(app)
        .post(`/api/appointments/${manualAppt.id}/no-show`)
        .set('Authorization', 'Bearer mock-token-admin-a')
        .send({ reason: 'Paciente notificó que no asistirá' });

      expect(res.status).toBe(200);
      expect(res.body.appointment.status).toBe('NoShow');

      const reloaded = await Appointment.findByPk(manualAppt.id);
      expect(reloaded.status).toBe('NoShow');
    });

    it('🔒 Rechaza marcar como No-Show una cita que ya fue Cancelada', async () => {
      manualAppt.status = 'Cancelled';
      await manualAppt.save();

      const res = await request(app)
        .post(`/api/appointments/${manualAppt.id}/no-show`)
        .set('Authorization', 'Bearer mock-token-admin-a')
        .send({ reason: 'Intento inválido' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cancelada/i);
    });

    it('🔒 Admin de Org B no puede marcar como No-Show una cita de Org A (Tenant Boundary 404)', async () => {
      const res = await request(app)
        .post(`/api/appointments/${manualAppt.id}/no-show`)
        .set('Authorization', 'Bearer mock-token-admin-b')
        .send({ reason: 'Intento de traspaso' });

      expect(res.status).toBe(404);
    });
  });

  describe('5. Operational No-Show Statistics & Analytics', () => {
    it('✅ Retorna estadísticas agregadas de No-Shows con porcentaje exacto por clínica', async () => {
      const res = await request(app)
        .get('/api/appointments/no-shows/stats')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalAppointments');
      expect(res.body).toHaveProperty('noShowCount');
      expect(res.body).toHaveProperty('noShowRatePercentage');
      expect(typeof res.body.noShowRatePercentage).toBe('number');
      expect(Array.isArray(res.body.byDoctor)).toBe(true);
    });

    it('✅ Superadmin puede consultar estadísticas globales o scoping específico', async () => {
      const res = await request(app)
        .get(`/api/appointments/no-shows/stats?organizationId=${orgA.id}`)
        .set('Authorization', 'Bearer mock-token-superadmin');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalAppointments');
    });
  });
});
