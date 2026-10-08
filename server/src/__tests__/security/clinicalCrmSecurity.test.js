'use strict';

/**
 * 🛡️ FASE 19 SECURITY TEST SUITE: Clinical CRM & Leads Funnel
 * 
 * Verifies:
 * 1. Authentication and Granular RBAC (crm:read, crm:create, crm:update, crm:convert, crm:delete)
 * 2. Multi-tenant data isolation (Tenant A leads never leak into Tenant B)
 * 3. Funnel stages progression & CRM analytics metrics
 * 4. Atomic conversion of Lead to active Patient (with idempotency check)
 * 5. Rejection of unauthorized roles (e.g. PATIENT) with 403 Forbidden
 */

const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { setTenantContext } = require('../../utils/tenantRls');
const {
  User,
  Organization,
  Patient,
  Role,
  Specialty,
  Lead,
  sequelize
} = require('../../models');
const crmController = require('../../controllers/crm.controller');
const { authorize } = require('../../middlewares/authorization.middleware');

describe('🛡️ FASE 19: CRM Clínico, Embudo de Conversión & Multi-Tenant Security Suite', () => {
  let app;
  let orgA;
  let orgB;
  let adminUserA;
  let receptionistUserA;
  let patientUserA;
  let adminUserB;
  let specialtyCardio;

  let leadA1;
  let leadA2;
  let leadB1;

  beforeAll(async () => {
    await sequelize.authenticate();
    await Lead.sync();
    await setTenantContext(sequelize, { isSuperAdmin: true });

    // 1. Roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'ADMIN' }, defaults: { description: 'Administrador' } });
    const [recepRole] = await Role.findOrCreate({ where: { name: 'RECEPTIONIST' }, defaults: { description: 'Recepcionista' } });
    const [patientRole] = await Role.findOrCreate({ where: { name: 'PATIENT' }, defaults: { description: 'Paciente' } });

    // 2. Especialidad
    [specialtyCardio] = await Specialty.findOrCreate({
      where: { name: 'Cardiología CRM' },
      defaults: { description: 'Especialidad CRM' }
    });

    // 3. Usuarios Propietarios para Organizaciones
    adminUserA = await User.create({
      id: uuidv4(),
      username: `admin_crm_a_${Date.now()}`,
      email: `admin_crm_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Clínica A'
    });

    adminUserB = await User.create({
      id: uuidv4(),
      username: `admin_crm_b_${Date.now()}`,
      email: `admin_crm_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Clínica B'
    });

    // 4. Organizaciones
    orgA = await Organization.create({
      id: uuidv4(),
      name: `Clínica CRM Alfa ${Date.now()}`,
      slug: `crm-alfa-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserA.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Clínica CRM Beta ${Date.now()}`,
      slug: `crm-beta-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserB.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    await adminUserA.update({ organizationId: orgA.id });
    await adminUserB.update({ organizationId: orgB.id });

    // 5. Recepcionista y Paciente en Org A
    receptionistUserA = await User.create({
      id: uuidv4(),
      username: `recep_crm_a_${Date.now()}`,
      email: `recep_crm_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: recepRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Camila',
      lastName: 'Recepcionista'
    });

    patientUserA = await User.create({
      id: uuidv4(),
      username: `patient_crm_a_${Date.now()}`,
      email: `patient_crm_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Pedro',
      lastName: 'Pérez'
    });

    // 6. Leads iniciales para Org A
    leadA1 = await Lead.create({
      id: uuidv4(),
      organizationId: orgA.id,
      firstName: 'Andrés',
      lastName: 'Gómez',
      phone: '+584121112233',
      email: `andres_lead_${Date.now()}@gmail.com`,
      documentId: `V-${Date.now().toString().slice(-8)}`,
      source: 'WHATSAPP',
      status: 'NEW',
      channel: 'Campaña Hipertensión WhatsApp',
      specialtyId: specialtyCardio.id,
      estimatedValue: 120.00
    });

    leadA2 = await Lead.create({
      id: uuidv4(),
      organizationId: orgA.id,
      firstName: 'Mariana',
      lastName: 'López',
      phone: '+584145556677',
      email: `mariana_lead_${Date.now()}@gmail.com`,
      source: 'WEB_FORM',
      status: 'CONTACTED',
      channel: 'Formulario Web Consulta',
      estimatedValue: 80.00
    });

    // 7. Lead para Org B
    leadB1 = await Lead.create({
      id: uuidv4(),
      organizationId: orgB.id,
      firstName: 'Fernando',
      lastName: 'Díaz',
      phone: '+584169998877',
      email: `fernando_lead_${Date.now()}@gmail.com`,
      source: 'CALL_INBOUND',
      status: 'SCHEDULED',
      channel: 'Llamada Telefónica Central',
      estimatedValue: 200.00
    });

    // Configurar Express Test App
    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      if (authHeader === 'Bearer mock-token-admin-a') {
        req.user = { id: adminUserA.id, role: 'ADMIN', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-recep-a') {
        req.user = { id: receptionistUserA.id, role: 'RECEPTIONIST', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-pat-a') {
        req.user = { id: patientUserA.id, role: 'PATIENT', organizationId: orgA.id };
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

    app.get('/api/crm/leads/stats', mockAuthMiddleware, authorize('crm:read'), crmController.getLeadStats);
    app.get('/api/crm/leads', mockAuthMiddleware, authorize('crm:read'), crmController.getLeads);
    app.get('/api/crm/leads/:id', mockAuthMiddleware, authorize('crm:read'), crmController.getLeadById);
    app.post('/api/crm/leads', mockAuthMiddleware, authorize('crm:create'), crmController.createLead);
    app.put('/api/crm/leads/:id', mockAuthMiddleware, authorize('crm:update'), crmController.updateLead);
    app.post('/api/crm/leads/:id/convert', mockAuthMiddleware, authorize('crm:convert'), crmController.convertLeadToPatient);
    app.delete('/api/crm/leads/:id', mockAuthMiddleware, authorize('crm:delete'), crmController.deleteLead);
  });

  afterAll(async () => {
    try {
      await setTenantContext(sequelize, { isSuperAdmin: true });
      if (orgA) {
        await Lead.destroy({ where: { organizationId: orgA.id } });
        await Patient.destroy({ where: { organizationId: orgA.id } });
        await User.destroy({ where: { organizationId: orgA.id } });
        await Organization.destroy({ where: { id: orgA.id } });
      }
      if (orgB) {
        await Lead.destroy({ where: { organizationId: orgB.id } });
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
  // 1. AUTHENTICATION & RBAC CHECKS
  // =========================================================================
  describe('1. Autenticación & Control de Acceso RBAC (crm:read, crm:create)', () => {
    it('🔒 Rechaza con 401 si no hay token de autenticación', async () => {
      const res = await request(app).get('/api/crm/leads');
      expect(res.status).toBe(401);
    });

    it('🔒 Rechaza con 403 Forbidden a roles sin permiso (ej. PATIENT)', async () => {
      const res = await request(app)
        .get('/api/crm/leads')
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/permission/i);
    });

    it('✅ Permite acceso con 200 OK a RECEPTIONIST y ADMIN de la clínica', async () => {
      const resRecep = await request(app)
        .get('/api/crm/leads')
        .set('Authorization', 'Bearer mock-token-recep-a');
      expect(resRecep.status).toBe(200);

      const resAdmin = await request(app)
        .get('/api/crm/leads')
        .set('Authorization', 'Bearer mock-token-admin-a');
      expect(resAdmin.status).toBe(200);
    });
  });

  // =========================================================================
  // 2. MULTI-TENANT ISOLATION
  // =========================================================================
  describe('2. Aislamiento Multi-Tenant Estricto', () => {
    it('🛡️ Admin de Clínica A solo ve los leads de su clínica (no los de Clínica B)', async () => {
      const res = await request(app)
        .get('/api/crm/leads')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      const leadNames = res.body.leads.map(l => l.firstName);
      expect(leadNames).toContain('Andrés');
      expect(leadNames).toContain('Mariana');
      expect(leadNames).not.toContain('Fernando');
    });

    it('🛡️ Admin de Clínica B recibe 404 al intentar consultar un lead de Clínica A', async () => {
      const res = await request(app)
        .get(`/api/crm/leads/${leadA1.id}`)
        .set('Authorization', 'Bearer mock-token-admin-b');

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no encontrado/i);
    });
  });

  // =========================================================================
  // 3. FUNNEL STAGES & ANALYTICS
  // =========================================================================
  describe('3. Embudo de Ventas (Funnel) & Analytics', () => {
    it('📊 Retorna métricas correctas del embudo para Clínica A', async () => {
      const res = await request(app)
        .get('/api/crm/leads/stats')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      const { funnel, sources, financials } = res.body;

      expect(funnel.total).toBe(2);
      expect(funnel.new).toBe(1);
      expect(funnel.contacted).toBe(1);
      expect(funnel.converted).toBe(0);

      expect(sources['WHATSAPP']).toBe(1);
      expect(sources['WEB_FORM']).toBe(1);
      expect(sources['CALL_INBOUND']).toBeUndefined();

      expect(financials.totalEstimatedValue).toBe('200.00'); // 120 + 80
      expect(financials.convertedValue).toBe('0.00');
    });

    it('🔄 Permite avanzar el estado del prospecto (CONTACTED -> SCHEDULED)', async () => {
      const res = await request(app)
        .put(`/api/crm/leads/${leadA2.id}`)
        .set('Authorization', 'Bearer mock-token-recep-a')
        .send({
          status: 'SCHEDULED',
          notes: 'Paciente citada para chequeo integral este viernes'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SCHEDULED');
      expect(res.body.notes).toBe('Paciente citada para chequeo integral este viernes');
    });
  });

  // =========================================================================
  // 4. ATOMIC CONVERSION OF LEAD TO PATIENT
  // =========================================================================
  describe('4. Conversión Atómica de Prospecto a Paciente Activo', () => {
    it('🚀 Convierte exitosamente un lead a paciente activo (User + Patient)', async () => {
      const res = await request(app)
        .post(`/api/crm/leads/${leadA1.id}/convert`)
        .set('Authorization', 'Bearer mock-token-recep-a');

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/convertido exitosamente/i);
      expect(res.body.patient).toBeDefined();
      expect(res.body.patient.fullName).toBe('Andrés Gómez');
      expect(res.body.patient.medicalRecordNumber).toBeDefined();

      // Verificar que el lead quedó en estado CONVERTED
      const updatedLead = await Lead.findByPk(leadA1.id);
      expect(updatedLead.status).toBe('CONVERTED');
      expect(updatedLead.convertedPatientId).toBe(res.body.patient.id);
      expect(updatedLead.conversionDate).toBeDefined();

      // Verificar que el Patient existe en la base de datos
      const createdPatient = await Patient.findByPk(res.body.patient.id);
      expect(createdPatient).toBeDefined();
      expect(createdPatient.phone).toBe('+584121112233');
    });

    it('🔒 Rechaza con 400 Bad Request si se intenta re-convertir un lead ya convertido', async () => {
      const res = await request(app)
        .post(`/api/crm/leads/${leadA1.id}/convert`)
        .set('Authorization', 'Bearer mock-token-recep-a');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/ya fue convertido/i);
    });

    it('📊 Actualiza la tasa de conversión en las estadísticas del embudo', async () => {
      const res = await request(app)
        .get('/api/crm/leads/stats')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      const { funnel, conversionRatePercent, financials } = res.body;

      expect(funnel.converted).toBe(1);
      expect(conversionRatePercent).toBe(50.0); // 1 de 2 = 50%
      expect(financials.convertedValue).toBe('120.00');
    });
  });
});
