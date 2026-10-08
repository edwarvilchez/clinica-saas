'use strict';

/**
 * 🛡️ FASE 25: Communications & WhatsApp Provider Abstraction Security Suite
 * Tests provider decoupling (Twilio, Meta Cloud, UltraMsg, Simulation),
 * RBAC authorization, multi-tenant isolation, template dispatch,
 * webhook status normalization (DELIVERED, READ, FAILED), and tamper-evident audit logging.
 */

const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { setTenantContext } = require('../../utils/tenantRls');
const {
  User,
  Organization,
  Doctor,
  Role,
  Specialty,
  CommunicationLog,
  AuditLog,
  sequelize
} = require('../../models');
const communicationsController = require('../../controllers/communications.controller');
const { authorize } = require('../../middlewares/authorization.middleware');
const { eventBus, DOMAIN_EVENTS } = require('../../events/eventBus');
const { providerFactory } = require('../../services/communications/providers/WhatsAppProviderFactory');
const communicationsService = require('../../services/communications/communications.service');

describe('🛡️ FASE 25: Communications & WhatsApp Provider Decoupling Suite', () => {
  let app;
  let orgA;
  let orgB;
  let adminUserA;
  let adminUserB;
  let doctorUserA;
  let doctorA;
  let doctorUserB;
  let doctorB;
  let patientUserA;
  let nurseUserA;
  let superadminUser;
  let specialtyCardio;

  beforeAll(async () => {
    await sequelize.authenticate();
    await setTenantContext(sequelize, { isSuperAdmin: true });

    await CommunicationLog.sync();

    // 1. Roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'ADMIN' }, defaults: { description: 'Administrador' } });
    const [patientRole] = await Role.findOrCreate({ where: { name: 'PATIENT' }, defaults: { description: 'Paciente' } });
    const [doctorRole] = await Role.findOrCreate({ where: { name: 'DOCTOR' }, defaults: { description: 'Médico' } });
    const [nurseRole] = await Role.findOrCreate({ where: { name: 'NURSE' }, defaults: { description: 'Enfermera' } });
    const [superAdminRole] = await Role.findOrCreate({ where: { name: 'SUPERADMIN' }, defaults: { description: 'Super Admin' } });

    // 2. Specialty
    const [cardio] = await Specialty.findOrCreate({
      where: { name: 'Cardiología Comms Test' },
      defaults: { description: 'Especialidad Comms Test' }
    });
    specialtyCardio = cardio;

    // 3. Superadmin
    superadminUser = await User.create({
      id: uuidv4(),
      username: `sadmin_comms_${Date.now()}`,
      email: `sadmin_comms_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: superAdminRole.id,
      isActive: true,
      firstName: 'Super',
      lastName: 'Admin'
    });

    // 4. Organizations
    adminUserA = await User.create({
      id: uuidv4(),
      username: `admin_comms_a_${Date.now()}`,
      email: `admin_comms_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Comms Alfa'
    });

    orgA = await Organization.create({
      id: uuidv4(),
      name: `Clínica Comms Alfa ${Date.now()}`,
      slug: `comms-alfa-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserA.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });
    await adminUserA.update({ organizationId: orgA.id });

    adminUserB = await User.create({
      id: uuidv4(),
      username: `admin_comms_b_${Date.now()}`,
      email: `admin_comms_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Comms Beta'
    });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Clínica Comms Beta ${Date.now()}`,
      slug: `comms-beta-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserB.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });
    await adminUserB.update({ organizationId: orgB.id });

    // 5. Doctor in Org A
    doctorUserA = await User.create({
      id: uuidv4(),
      username: `doc_comms_a_${Date.now()}`,
      email: `doc_comms_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Alonso',
      lastName: 'Quijano'
    });

    doctorA = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserA.id,
      specialtyId: specialtyCardio.id,
      licenseNumber: `MED-COMMS-${Date.now().toString().slice(-6)}`,
      organizationId: orgA.id
    });

    // 6. Doctor in Org B
    doctorUserB = await User.create({
      id: uuidv4(),
      username: `doc_comms_b_${Date.now()}`,
      email: `doc_comms_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgB.id,
      isActive: true,
      firstName: 'Sancho',
      lastName: 'Panza'
    });

    doctorB = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserB.id,
      specialtyId: specialtyCardio.id,
      licenseNumber: `MED-COMMS-B-${Date.now().toString().slice(-6)}`,
      organizationId: orgB.id
    });

    // 7. Nurse & Patient (Unauthorized roles)
    nurseUserA = await User.create({
      id: uuidv4(),
      username: `nurse_comms_a_${Date.now()}`,
      email: `nurse_comms_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: nurseRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Dulce',
      lastName: 'Nea'
    });

    patientUserA = await User.create({
      id: uuidv4(),
      username: `pat_comms_a_${Date.now()}`,
      email: `pat_comms_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Pedro',
      lastName: 'Pérez'
    });

    // 8. Express App Setup with simulated Auth
    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      if (authHeader === 'Bearer mock-token-doc-a') {
        req.user = { id: doctorUserA.id, doctorId: doctorA.id, role: 'DOCTOR', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-doc-b') {
        req.user = { id: doctorUserB.id, doctorId: doctorB.id, role: 'DOCTOR', organizationId: orgB.id };
      } else if (authHeader === 'Bearer mock-token-admin-a') {
        req.user = { id: adminUserA.id, role: 'ADMIN', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-admin-b') {
        req.user = { id: adminUserB.id, role: 'ADMIN', organizationId: orgB.id };
      } else if (authHeader === 'Bearer mock-token-nurse-a') {
        req.user = { id: nurseUserA.id, role: 'NURSE', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-pat-a') {
        req.user = { id: patientUserA.id, role: 'PATIENT', organizationId: orgA.id };
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

    // Public Webhook Endpoint
    app.post('/api/communications/webhook/:provider', communicationsController.handleWebhook);

    // Protected Endpoints
    app.post('/api/communications/send', mockAuthMiddleware, authorize('communications:write'), communicationsController.sendMessage);
    app.get('/api/communications/logs', mockAuthMiddleware, authorize('communications:read'), communicationsController.getLogs);
    app.get('/api/communications/stats', mockAuthMiddleware, authorize('communications:read'), communicationsController.getStats);
  });

  afterAll(async () => {
    try {
      await setTenantContext(sequelize, { isSuperAdmin: true });
      await CommunicationLog.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Doctor.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Organization.destroy({ where: { id: [orgA?.id, orgB?.id] }, force: true });
      await User.destroy({
        where: {
          id: [
            adminUserA?.id,
            adminUserB?.id,
            doctorUserA?.id,
            doctorUserB?.id,
            patientUserA?.id,
            nurseUserA?.id,
            superadminUser?.id
          ].filter(Boolean)
        },
        force: true
      });
      if (specialtyCardio) await Specialty.destroy({ where: { id: specialtyCardio.id } });
    } catch (e) {
      // Ignore append-only audit trigger on cascade
    }
  });

  beforeEach(() => {
    eventBus.clearHistory();
  });

  describe('1. RBAC & Role Authorization', () => {
    it('debe rechazar llamadas anónimas a envío de mensajes con 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/communications/send')
        .send({ to: '+584129990001', message: 'Hola' });

      expect(res.status).toBe(401);
    });

    it('debe rechazar a rol PATIENT con 403 Forbidden para envío de mensajes', async () => {
      const res = await request(app)
        .post('/api/communications/send')
        .set('Authorization', 'Bearer mock-token-pat-a')
        .send({ to: '+584129990001', message: 'Intento de spam' });

      expect(res.status).toBe(403);
    });

    it('debe rechazar a rol NURSE con 403 Forbidden para consulta de logs masivos', async () => {
      const res = await request(app)
        .get('/api/communications/logs')
        .set('Authorization', 'Bearer mock-token-nurse-a');

      expect(res.status).toBe(403);
    });

    it('debe permitir a DOCTOR y ADMIN enviar notificaciones', async () => {
      const res = await request(app)
        .post('/api/communications/send')
        .set('Authorization', 'Bearer mock-token-doc-a')
        .send({
          to: '+584129990001',
          message: 'Estimado paciente, por favor acudir con exámenes previos.'
        });

      expect(res.status).toBe(200);
      expect(res.body.result.success).toBe(true);
      expect(res.body.result.provider).toBe('SIMULATION');
    });
  });

  describe('2. Provider Factory & Gateway Polymorphism', () => {
    it('debe contener los 4 adaptadores registrados en el factory (SIMULATION, TWILIO, META_CLOUD, ULTRAMSG)', () => {
      const providers = providerFactory.getAvailableProviders();
      expect(providers).toContain('SIMULATION');
      expect(providers).toContain('TWILIO');
      expect(providers).toContain('META_CLOUD');
      expect(providers).toContain('ULTRAMSG');
    });

    it('debe despachar mediante el proveedor explícitamente solicitado', async () => {
      const simProvider = providerFactory.getProvider('SIMULATION');
      expect(simProvider.getName()).toBe('SIMULATION');

      const res = await request(app)
        .post('/api/communications/send')
        .set('Authorization', 'Bearer mock-token-admin-a')
        .send({
          to: '+584129990002',
          message: 'Mensaje de prueba con proveedor SIMULATION',
          providerName: 'SIMULATION'
        });

      expect(res.status).toBe(200);
      expect(res.body.result.provider).toBe('SIMULATION');
    });

    it('debe recurrir a fallback SIMULATION si se solicita un proveedor desconocido', async () => {
      const fallbackProvider = providerFactory.getProvider('UNKNOWN_GATEWAY');
      expect(fallbackProvider.getName()).toBe('SIMULATION');
    });
  });

  describe('3. Clinical Notification Templates Desacopladas', () => {
    it('sendAppointmentConfirmation genera mensaje con Google Calendar y registra log', async () => {
      const res = await communicationsService.sendAppointmentConfirmation({
        to: '+584129991111',
        patientName: 'Carlos Fuentes',
        doctorName: 'Alonso Quijano',
        date: 'Lunes, 12 de Octubre de 2026',
        time: '09:00 AM',
        appointmentId: uuidv4(),
        organizationId: orgA.id,
        actorUserId: adminUserA.id
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('SENT');

      const log = await CommunicationLog.findByPk(res.logId);
      expect(log.messageType).toBe('APPOINTMENT_CONFIRMATION');
      expect(log.content).toContain('Google Calendar');
      expect(log.organizationId).toBe(orgA.id);
    });

    it('sendWaitlistOffer genera oferta con enlace de aceptación de 15 minutos', async () => {
      const entryId = uuidv4();
      const offerToken = 'test-token-12345';

      const res = await communicationsService.sendWaitlistOffer({
        to: '+584129992222',
        patientName: 'María Vargas',
        doctorName: 'Alonso Quijano',
        date: 'Martes, 13 de Octubre de 2026',
        time: '11:30 AM',
        entryId,
        offerToken,
        organizationId: orgA.id,
        actorUserId: adminUserA.id
      });

      expect(res.success).toBe(true);
      const log = await CommunicationLog.findByPk(res.logId);
      expect(log.messageType).toBe('WAITLIST_OFFER');
      expect(log.content).toContain('15 minutos');
      expect(log.content).toContain(offerToken);
    });
  });

  describe('4. Multi-Tenant Log Isolation & Anti-IDOR', () => {
    let logOrgA;
    let logOrgB;

    beforeAll(async () => {
      const resA = await communicationsService.sendMessage({
        to: '+584120000001',
        message: 'Mensaje exclusivo Clínica Alfa',
        organizationId: orgA.id,
        actorUserId: adminUserA.id
      });
      logOrgA = await CommunicationLog.findByPk(resA.logId);

      const resB = await communicationsService.sendMessage({
        to: '+584120000002',
        message: 'Mensaje exclusivo Clínica Beta',
        organizationId: orgB.id,
        actorUserId: adminUserB.id
      });
      logOrgB = await CommunicationLog.findByPk(resB.logId);
    });

    it('un administrador de Org A solo debe ver los logs de su propia organización', async () => {
      const res = await request(app)
        .get('/api/communications/logs')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      const logIds = res.body.logs.map(l => l.id);
      expect(logIds).toContain(logOrgA.id);
      expect(logIds).not.toContain(logOrgB.id); // Strict tenant isolation
    });

    it('un administrador de Org B no debe ver los mensajes de Org A', async () => {
      const res = await request(app)
        .get('/api/communications/logs')
        .set('Authorization', 'Bearer mock-token-admin-b');

      expect(res.status).toBe(200);
      const logIds = res.body.logs.map(l => l.id);
      expect(logIds).toContain(logOrgB.id);
      expect(logIds).not.toContain(logOrgA.id);
    });
  });

  describe('5. Webhook Inbound Callbacks & Normalization', () => {
    let pendingMessage;

    beforeEach(async () => {
      const dispatch = await communicationsService.sendMessage({
        to: '+584127778899',
        message: 'Mensaje de prueba para webhook status',
        organizationId: orgA.id,
        actorUserId: adminUserA.id
      });
      pendingMessage = await CommunicationLog.findByPk(dispatch.logId);
    });

    it('debe procesar callback de simulación y actualizar estatus a DELIVERED emitiendo evento', async () => {
      const webhookPayload = {
        messageId: pendingMessage.providerMessageId,
        status: 'delivered',
        timestamp: new Date().toISOString()
      };

      const res = await request(app)
        .post('/api/communications/webhook/simulation')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.outcome.processed).toBe(true);
      expect(res.body.outcome.newStatus).toBe('DELIVERED');

      // Verify in DB
      const updated = await CommunicationLog.findByPk(pendingMessage.id);
      expect(updated.status).toBe('DELIVERED');

      // Verify domain event
      const events = eventBus.getRecentEvents().filter(e => e.eventName === DOMAIN_EVENTS.COMMUNICATION_DELIVERED);
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('debe procesar callback de Meta Cloud API normalizando estados anidados', async () => {
      const metaPayload = {
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: pendingMessage.providerMessageId,
                      status: 'read',
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      recipient_id: '584127778899'
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      const res = await request(app)
        .post('/api/communications/webhook/meta_cloud')
        .send(metaPayload);

      expect(res.status).toBe(200);
      expect(res.body.outcome.processed).toBe(true);
      expect(res.body.outcome.newStatus).toBe('READ');

      const updated = await CommunicationLog.findByPk(pendingMessage.id);
      expect(updated.status).toBe('READ');
    });

    it('debe procesar callback de Twilio normalizando MessageStatus a DELIVERED', async () => {
      const twilioPayload = {
        MessageSid: pendingMessage.providerMessageId,
        MessageStatus: 'delivered',
        To: 'whatsapp:+584127778899'
      };

      const res = await request(app)
        .post('/api/communications/webhook/twilio')
        .send(twilioPayload);

      expect(res.status).toBe(200);
      expect(res.body.outcome.processed).toBe(true);
      expect(res.body.outcome.newStatus).toBe('DELIVERED');
    });
  });

  describe('6. Delivery Statistics & Analytics', () => {
    it('debe retornar métricas consolidadas con tasa de entrega y desglose por proveedor', async () => {
      const res = await request(app)
        .get('/api/communications/stats')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalMessages');
      expect(res.body).toHaveProperty('delivered');
      expect(res.body).toHaveProperty('deliveryRatePercentage');
      expect(res.body).toHaveProperty('breakdownByProvider');
      expect(res.body).toHaveProperty('availableProviders');
      expect(res.body.availableProviders.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('7. Tamper-Evident Audit Logging', () => {
    it('debe registrar eventos inmutables en AuditLog para mensajes enviados', async () => {
      const logs = await AuditLog.findAll({
        where: {
          organizationId: orgA.id,
          action: 'COMMUNICATION_SENT'
        },
        order: [['timestamp', 'DESC']],
        limit: 5
      });

      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].entity).toBe('CommunicationLog');
    });
  });
});
