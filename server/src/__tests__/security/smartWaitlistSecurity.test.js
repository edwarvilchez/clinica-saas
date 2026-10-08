'use strict';

/**
 * 🛡️ FASE 21: Clinical Smart Waitlist & Automated Slot Reassignment Security Suite
 * Tests multi-tenant isolation, RBAC permissions, anti-IDOR protection,
 * priority queue sorting (URGENT > HIGH > MEDIUM > LOW), atomic offer acceptance,
 * stale offer expiration, tamper-evident audit logging, and domain event bus integration.
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
  WaitlistEntry,
  sequelize
} = require('../../models');
const waitlistController = require('../../controllers/waitlist.controller');
const { authorize } = require('../../middlewares/authorization.middleware');
const smartWaitlistService = require('../../services/smartWaitlist.service');
const notificationService = require('../../services/notification.service');
const { eventBus, DOMAIN_EVENTS } = require('../../events/eventBus');

describe('🛡️ FASE 21: Smart Waitlist Security & Priority Queue Suite', () => {
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
  let specialtyCardio;

  beforeAll(async () => {
    // Suppress email notification delivery during test runs
    jest.spyOn(notificationService, 'sendWaitlistOfferNotice').mockResolvedValue(true);

    await sequelize.authenticate();
    await setTenantContext(sequelize, { isSuperAdmin: true });

    // 1. Roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'ADMIN' }, defaults: { description: 'Administrador' } });
    const [patientRole] = await Role.findOrCreate({ where: { name: 'PATIENT' }, defaults: { description: 'Paciente' } });
    const [doctorRole] = await Role.findOrCreate({ where: { name: 'DOCTOR' }, defaults: { description: 'Médico' } });

    // 2. Specialty (INTEGER ID)
    const [cardio] = await Specialty.findOrCreate({
      where: { name: 'Cardiología Smart Waitlist' },
      defaults: { description: 'Especialidad Waitlist Test' }
    });
    specialtyCardio = cardio;

    // 3. Organizations
    adminUserA = await User.create({
      id: uuidv4(),
      username: `admin_wl_a_${Date.now()}`,
      email: `admin_wl_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Waitlist Alfa'
    });

    adminUserB = await User.create({
      id: uuidv4(),
      username: `admin_wl_b_${Date.now()}`,
      email: `admin_wl_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Waitlist Beta'
    });

    orgA = await Organization.create({
      id: uuidv4(),
      name: `Clínica Waitlist Alfa ${Date.now()}`,
      slug: `wl-alfa-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserA.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Clínica Waitlist Beta ${Date.now()}`,
      slug: `wl-beta-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserB.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    await adminUserA.update({ organizationId: orgA.id });
    await adminUserB.update({ organizationId: orgB.id });

    // 4. Doctor in Org A
    doctorUserA = await User.create({
      id: uuidv4(),
      username: `doc_wl_a_${Date.now()}`,
      email: `doc_wl_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Roberto',
      lastName: 'Sánchez'
    });

    doctorA = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserA.id,
      specialtyId: specialtyCardio.id,
      licenseNumber: `MED-WL-${Date.now().toString().slice(-6)}`,
      organizationId: orgA.id
    });

    // 5. Patient 1 in Org A
    patientUserA = await User.create({
      id: uuidv4(),
      username: `pat_wl_a_${Date.now()}`,
      email: `pat_wl_a_${Date.now()}@test.com`,
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
      phone: '+584129990001',
      documentId: `V-${Date.now().toString().slice(-8)}`
    });

    // 6. Patient 2 in Org A (for Intra-Tenant Anti-IDOR)
    patientUserA2 = await User.create({
      id: uuidv4(),
      username: `pat_wl_a2_${Date.now()}`,
      email: `pat_wl_a2_${Date.now()}@test.com`,
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
      phone: '+584129990003',
      documentId: `V-${(Date.now() + 2).toString().slice(-8)}`
    });

    // 7. Patient in Org B (for Cross-Tenant Isolation)
    patientUserB = await User.create({
      id: uuidv4(),
      username: `pat_wl_b_${Date.now()}`,
      email: `pat_wl_b_${Date.now()}@test.com`,
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
      phone: '+584129990002',
      documentId: `V-${(Date.now() + 1).toString().slice(-8)}`
    });

    // 8. Express App Setup with simulated Auth
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
      } else if (authHeader === 'Bearer mock-token-pat-a2') {
        req.user = { id: patientUserA2.id, role: 'PATIENT', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-pat-b') {
        req.user = { id: patientUserB.id, role: 'PATIENT', organizationId: orgB.id };
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

    app.get('/api/waitlist/stats', mockAuthMiddleware, authorize('waitlist:read'), waitlistController.getWaitlistStats);
    app.post('/api/waitlist/auto-match', mockAuthMiddleware, authorize('waitlist:write'), waitlistController.autoMatchSlot);
    app.get('/api/waitlist', mockAuthMiddleware, authorize('waitlist:read'), waitlistController.getWaitlist);
    app.post('/api/waitlist', mockAuthMiddleware, authorize('waitlist:create'), waitlistController.addToWaitlist);
    app.get('/api/waitlist/:id', mockAuthMiddleware, authorize('waitlist:read'), waitlistController.getWaitlistEntryById);
    app.post('/api/waitlist/:id/offer', mockAuthMiddleware, authorize('waitlist:write'), waitlistController.offerSlot);
    app.post('/api/waitlist/:id/accept', mockAuthMiddleware, authorize('waitlist:accept'), waitlistController.acceptOffer);
    app.post('/api/waitlist/:id/decline', mockAuthMiddleware, authorize('waitlist:accept'), waitlistController.declineOffer);
  });

  afterAll(async () => {
    try {
      await setTenantContext(sequelize, { isSuperAdmin: true });
      await WaitlistEntry.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Appointment.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Patient.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Doctor.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Organization.destroy({ where: { id: [orgA?.id, orgB?.id] }, force: true });
      await User.destroy({
        where: {
          id: [adminUserA?.id, adminUserB?.id, doctorUserA?.id, patientUserA?.id, patientUserA2?.id, patientUserB?.id].filter(Boolean)
        },
        force: true
      });
      if (specialtyCardio) await Specialty.destroy({ where: { id: specialtyCardio.id } });
    } catch (e) {
      // Ignore append-only audit log trigger on organization cascade
    }
  });

  beforeEach(() => {
    eventBus.clearHistory();
  });

  describe('1. RBAC & Authentication Enforcement', () => {
    it('debe rechazar solicitudes anónimas con 401 Unauthorized', async () => {
      const res = await request(app).get('/api/waitlist');
      expect(res.status).toBe(401);
    });

    it('debe denegar acceso a estadísticas para rol PATIENT con 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/waitlist/stats')
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(403);
    });

    it('debe permitir a ADMIN consultar estadísticas operacionales', async () => {
      const res = await request(app)
        .get('/api/waitlist/stats')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalEntries');
      expect(res.body).toHaveProperty('waitingCount');
      expect(res.body).toHaveProperty('priorityBreakdown');
    });

    it('debe impedir que un PATIENT emita una oferta de turno a otro candidato (403)', async () => {
      const dummyId = uuidv4();
      const res = await request(app)
        .post(`/api/waitlist/${dummyId}/offer`)
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({ slotDate: new Date() });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Patient Self-Registration & Anti-IDOR Enforcement', () => {
    let createdEntryA;

    it('debe permitir a un paciente agregarse a la lista de espera asociando su propio patientId automáticamente', async () => {
      const res = await request(app)
        .post('/api/waitlist')
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({
          doctorId: doctorA.id,
          specialtyId: specialtyCardio.id,
          notes: 'Dolor en el pecho ocasional'
        });

      expect(res.status).toBe(201);
      expect(res.body.patientId).toBe(patientA.id);
      expect(res.body.status).toBe('WAITING');
      expect(res.body.priority).toBe('MEDIUM'); // Default for patients
      createdEntryA = res.body;

      // Check event emitted in eventBus
      const recentEvents = eventBus.getRecentEvents();
      const event = recentEvents.find(e => e.eventName === DOMAIN_EVENTS.WAITLIST_ENTRY_CREATED);
      expect(event).toBeDefined();
      expect(event.payload.patientId).toBe(patientA.id);
    });

    it('debe impedir duplicados activos en espera para el mismo paciente y médico/especialidad (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/waitlist')
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({
          doctorId: doctorA.id,
          specialtyId: specialtyCardio.id
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/ya tiene una solicitud activa/i);
    });

    it('debe impedir que Paciente A2 consulte los datos de Paciente A dentro de la misma Org (Anti-IDOR 403)', async () => {
      const res = await request(app)
        .get(`/api/waitlist/${createdEntryA.id}`)
        .set('Authorization', 'Bearer mock-token-pat-a2');

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/no autorizado/i);
    });

    it('debe impedir que Paciente B de otra Org consulte la entrada de Paciente A (Tenant Isolation 404)', async () => {
      const res = await request(app)
        .get(`/api/waitlist/${createdEntryA.id}`)
        .set('Authorization', 'Bearer mock-token-pat-b');

      expect(res.status).toBe(404);
    });

    it('debe permitir al Paciente A consultar su propia entrada', async () => {
      const res = await request(app)
        .get(`/api/waitlist/${createdEntryA.id}`)
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createdEntryA.id);
    });
  });

  describe('3. Multi-Tenant Isolation', () => {
    let entryOrgA;
    let entryOrgB;

    beforeAll(async () => {
      entryOrgA = await WaitlistEntry.create({
        organizationId: orgA.id,
        patientId: patientA.id,
        specialtyId: specialtyCardio.id,
        priority: 'HIGH',
        status: 'WAITING'
      });

      entryOrgB = await WaitlistEntry.create({
        organizationId: orgB.id,
        patientId: patientB.id,
        specialtyId: specialtyCardio.id,
        priority: 'HIGH',
        status: 'WAITING'
      });
    });

    it('Admin de Org B no debe poder listar entradas de Org A', async () => {
      const res = await request(app)
        .get('/api/waitlist')
        .set('Authorization', 'Bearer mock-token-admin-b');

      expect(res.status).toBe(200);
      const ids = res.body.entries.map(e => e.id);
      expect(ids).toContain(entryOrgB.id);
      expect(ids).not.toContain(entryOrgA.id);
    });

    it('Admin de Org B no debe poder ver por ID una entrada de Org A (404 Tenant Isolation)', async () => {
      const res = await request(app)
        .get(`/api/waitlist/${entryOrgA.id}`)
        .set('Authorization', 'Bearer mock-token-admin-b');

      expect(res.status).toBe(404);
    });

    it('Admin de Org B no debe poder ofrecer turno a un paciente de Org A (404)', async () => {
      const res = await request(app)
        .post(`/api/waitlist/${entryOrgA.id}/offer`)
        .set('Authorization', 'Bearer mock-token-admin-b')
        .send({
          slotDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

      expect(res.status).toBe(404);
    });
  });

  describe('4. Smart Priority Queue Ordering (URGENT > HIGH > MEDIUM > LOW)', () => {
    let urgentEntry;
    let highEntry;
    let lowEntry;

    beforeAll(async () => {
      // Limpiar entradas previas de org A para probar orden estricto
      await WaitlistEntry.destroy({ where: { organizationId: orgA.id }, force: true });

      // Crear en orden inverso: LOW primero, luego HIGH, luego URGENT
      lowEntry = await WaitlistEntry.create({
        organizationId: orgA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        specialtyId: specialtyCardio.id,
        priority: 'LOW',
        status: 'WAITING'
      });

      highEntry = await WaitlistEntry.create({
        organizationId: orgA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        specialtyId: specialtyCardio.id,
        priority: 'HIGH',
        status: 'WAITING'
      });

      urgentEntry = await WaitlistEntry.create({
        organizationId: orgA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        specialtyId: specialtyCardio.id,
        priority: 'URGENT',
        status: 'WAITING'
      });
    });

    it('debe ordenar candidatos dando máxima prioridad a URGENT, seguido de HIGH y LOW', async () => {
      const candidates = await smartWaitlistService.findEligibleCandidates({
        organizationId: orgA.id,
        doctorId: doctorA.id,
        limit: 10
      });

      expect(candidates.length).toBe(3);
      expect(candidates[0].id).toBe(urgentEntry.id);
      expect(candidates[0].priority).toBe('URGENT');
      expect(candidates[1].id).toBe(highEntry.id);
      expect(candidates[1].priority).toBe('HIGH');
      expect(candidates[2].id).toBe(lowEntry.id);
      expect(candidates[2].priority).toBe('LOW');
    });
  });

  describe('5. Slot Offering, Interactive Acceptance & Atomic Conversion', () => {
    let testEntry;
    const targetDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 2 days in future

    beforeAll(async () => {
      testEntry = await WaitlistEntry.create({
        organizationId: orgA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        specialtyId: specialtyCardio.id,
        priority: 'URGENT',
        status: 'WAITING',
        notes: 'Urgencia por evaluación preoperatoria'
      });
    });

    it('Admin ofrece turno a un candidato en espera -> Transición a OFFERED y emisión de evento', async () => {
      const res = await request(app)
        .post(`/api/waitlist/${testEntry.id}/offer`)
        .set('Authorization', 'Bearer mock-token-admin-a')
        .send({
          slotDate: targetDate,
          expirationMinutes: 60
        });

      expect(res.status).toBe(200);
      expect(res.body.entry.status).toBe('OFFERED');
      expect(res.body.entry.offeredAppointmentDate).toBeDefined();
      expect(res.body.entry.offerExpiresAt).toBeDefined();

      // Check domain event in eventBus
      const recentEvents = eventBus.getRecentEvents();
      const event = recentEvents.find(e => e.eventName === DOMAIN_EVENTS.WAITLIST_OFFER_SENT);
      expect(event).toBeDefined();
      expect(event.payload.waitlistEntryId).toBe(testEntry.id);
    });

    it('Paciente A2 de la misma clínica no puede aceptar la oferta de Paciente A (Anti-IDOR 403)', async () => {
      const res = await request(app)
        .post(`/api/waitlist/${testEntry.id}/accept`)
        .set('Authorization', 'Bearer mock-token-pat-a2');

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/no puedes aceptar ofertas de otros pacientes/i);
    });

    it('Paciente B de otra clínica no puede aceptar la oferta (Tenant Isolation 404)', async () => {
      const res = await request(app)
        .post(`/api/waitlist/${testEntry.id}/accept`)
        .set('Authorization', 'Bearer mock-token-pat-b');

      expect(res.status).toBe(404);
    });

    it('Paciente A acepta la oferta exitosamente -> Conversión atómica a Cita médica confirmada', async () => {
      const res = await request(app)
        .post(`/api/waitlist/${testEntry.id}/accept`)
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(200);
      expect(res.body.entry.status).toBe('ACCEPTED');
      expect(res.body.entry.convertedAppointmentId).toBeDefined();
      expect(res.body.appointment).toBeDefined();
      expect(res.body.appointment.status).toBe('Confirmed');
      expect(res.body.appointment.patientId).toBe(patientA.id);
      expect(res.body.appointment.doctorId).toBe(doctorA.id);

      // Verify DB appointment exists
      const savedAppt = await Appointment.findByPk(res.body.appointment.id);
      expect(savedAppt).not.toBeNull();
      expect(savedAppt.status).toBe('Confirmed');

      // Verify domain events
      const recentEvents = eventBus.getRecentEvents();
      const acceptedEvent = recentEvents.find(e => e.eventName === DOMAIN_EVENTS.WAITLIST_OFFER_ACCEPTED);
      const scheduledEvent = recentEvents.find(e => e.eventName === DOMAIN_EVENTS.APPOINTMENT_SCHEDULED);
      expect(acceptedEvent).toBeDefined();
      expect(scheduledEvent).toBeDefined();
    });

    it('Re-intentar aceptar la oferta ya aceptada debe fallar con 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/waitlist/${testEntry.id}/accept`)
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no está disponible para aceptación/i);
    });
  });

  describe('6. Offer Expiration & Declination Handling', () => {
    let expiredEntry;
    let declineEntry;

    beforeEach(async () => {
      expiredEntry = await WaitlistEntry.create({
        organizationId: orgA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        specialtyId: specialtyCardio.id,
        priority: 'MEDIUM',
        status: 'OFFERED',
        offeredAppointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        offerExpiresAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
      });

      declineEntry = await WaitlistEntry.create({
        organizationId: orgA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        specialtyId: specialtyCardio.id,
        priority: 'MEDIUM',
        status: 'OFFERED',
        offeredAppointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        offerExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
      });
    });

    it('debe rechazar la aceptación de una oferta expirada con 400 y marcarla como EXPIRED', async () => {
      const res = await request(app)
        .post(`/api/waitlist/${expiredEntry.id}/accept`)
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/expirado/i);

      const refreshed = await WaitlistEntry.findByPk(expiredEntry.id);
      expect(refreshed.status).toBe('EXPIRED');
    });

    it('expireStaleOffers debe procesar y marcar ofertas vencidas masivamente', async () => {
      const result = await smartWaitlistService.expireStaleOffers({ organizationId: orgA.id });
      expect(result.expiredCount).toBeGreaterThanOrEqual(1);

      const check = await WaitlistEntry.findByPk(expiredEntry.id);
      expect(check.status).toBe('EXPIRED');
    });

    it('debe permitir a un paciente rechazar una oferta manteniendo o cancelando su solicitud', async () => {
      const res = await request(app)
        .post(`/api/waitlist/${declineEntry.id}/decline`)
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({
          reason: 'No disponible ese horario',
          keepInWaitlist: true
        });

      expect(res.status).toBe(200);
      expect(res.body.entry.status).toBe('WAITING');
      expect(res.body.entry.offeredAppointmentDate).toBeNull();

      const recentEvents = eventBus.getRecentEvents();
      const event = recentEvents.find(e => e.eventName === DOMAIN_EVENTS.WAITLIST_OFFER_DECLINED);
      expect(event).toBeDefined();
    });
  });

  describe('7. Automated Slot Reassignment (Auto-Match on Slot Release)', () => {
    let topCandidate;

    beforeAll(async () => {
      await WaitlistEntry.destroy({ where: { organizationId: orgA.id }, force: true });

      topCandidate = await WaitlistEntry.create({
        organizationId: orgA.id,
        patientId: patientA.id,
        doctorId: doctorA.id,
        specialtyId: specialtyCardio.id,
        priority: 'URGENT',
        status: 'WAITING'
      });
    });

    it('autoMatchOnSlotReleased debe seleccionar y ofrecer automáticamente el slot al candidato más urgente', async () => {
      const slotTime = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const matchResult = await smartWaitlistService.autoMatchOnSlotReleased({
        organizationId: orgA.id,
        doctorId: doctorA.id,
        specialtyId: specialtyCardio.id,
        slotDate: slotTime,
        expirationMinutes: 180
      });

      expect(matchResult.matched).toBe(true);
      expect(matchResult.candidateId).toBe(topCandidate.id);
      expect(matchResult.offered.status).toBe('OFFERED');

      const reloaded = await WaitlistEntry.findByPk(topCandidate.id);
      expect(reloaded.status).toBe('OFFERED');
    });
  });

  describe('8. Audit Logging & Compliance', () => {
    it('debe registrar eventos de auditoría inmutables para las operaciones de lista de espera', async () => {
      const logs = await AuditLog.findAll({
        where: {
          organizationId: orgA.id,
          entity: 'WaitlistEntry'
        }
      });

      expect(logs.length).toBeGreaterThan(0);
      const actions = logs.map(l => l.action);
      expect(actions).toEqual(expect.arrayContaining(['WAITLIST_OFFER_SENT', 'WAITLIST_OFFER_ACCEPTED']));
    });
  });
});
