'use strict';

/**
 * 🛡️ FASE 17 SECURITY TEST SUITE: Real-Time Operational Clinic Dashboard
 * ("¿Qué está pasando hoy en mi clínica?")
 * 
 * Verifies:
 * 1. Endpoint authentication & authorization (RBAC 'stats:read')
 * 2. Multi-tenant data isolation (Tenant A never leaks into Tenant B)
 * 3. Daily shift aggregation metrics (Appointments, Beds/Admissions, Payments USD/VES, Live Queue)
 * 4. Superadmin scoped vs global query behavior
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
  Appointment,
  Payment,
  HospitalBed,
  Role,
  sequelize
} = require('../../models');
const statsController = require('../../controllers/stats.controller');
const { authorize } = require('../../middlewares/authorization.middleware');

describe('🛡️ FASE 17: Dashboard Operativo en Tiempo Real & Multi-Tenant Security Suite', () => {
  let app;
  let orgA;
  let orgB;
  let adminUserA;
  let doctorUserA;
  let patientUserA;
  let patientModelA;
  let doctorModelA;

  let adminUserB;
  let patientUserB;
  let patientModelB;
  let doctorModelB;
  let doctorUserB;

  beforeAll(async () => {
    await sequelize.authenticate();
    await setTenantContext(sequelize, { isSuperAdmin: true });

    // 1. Roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'ADMIN' }, defaults: { description: 'Administrador' } });
    const [doctorRole] = await Role.findOrCreate({ where: { name: 'DOCTOR' }, defaults: { description: 'Médico' } });
    const [patientRole] = await Role.findOrCreate({ where: { name: 'PATIENT' }, defaults: { description: 'Paciente' } });

    // 2. Usuarios Base para Dueños
    adminUserA = await User.create({
      id: uuidv4(),
      username: `admin_ops_a_${Date.now()}`,
      email: `admin_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Alfa'
    });

    adminUserB = await User.create({
      id: uuidv4(),
      username: `admin_ops_b_${Date.now()}`,
      email: `admin_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Beta'
    });

    // 3. Tenants (Organizaciones)
    orgA = await Organization.create({
      id: uuidv4(),
      name: `Clinica Alfa Ops Test ${Date.now()}`,
      slug: `ops-alfa-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserA.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Clinica Beta Ops Test ${Date.now()}`,
      slug: `ops-beta-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserB.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    await adminUserA.update({ organizationId: orgA.id });
    await adminUserB.update({ organizationId: orgB.id });

    // 4. Doctores y Pacientes de Org A
    doctorUserA = await User.create({
      id: uuidv4(),
      username: `dr_ops_a_${Date.now()}`,
      email: `dr_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Gregory',
      lastName: 'House'
    });

    doctorModelA = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserA.id,
      organizationId: orgA.id,
      licenseNumber: `MED-A-${Date.now()}`,
      specialty: 'Infectología'
    });

    patientUserA = await User.create({
      id: uuidv4(),
      username: `patient_ops_a_${Date.now()}`,
      email: `pat_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'John',
      lastName: 'Doe'
    });

    patientModelA = await Patient.create({
      id: uuidv4(),
      userId: patientUserA.id,
      organizationId: orgA.id,
      documentId: `V-${Date.now().toString().slice(-8)}`,
      medicalRecordNumber: `HC-A-${Date.now()}`
    });

    // 5. Doctores y Pacientes de Org B
    doctorUserB = await User.create({
      id: uuidv4(),
      username: `dr_ops_b_${Date.now()}`,
      email: `dr_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgB.id,
      isActive: true,
      firstName: 'Meredith',
      lastName: 'Grey'
    });

    doctorModelB = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserB.id,
      organizationId: orgB.id,
      licenseNumber: `MED-B-${Date.now()}`,
      specialty: 'Cirugía General'
    });

    patientUserB = await User.create({
      id: uuidv4(),
      username: `patient_ops_b_${Date.now()}`,
      email: `pat_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgB.id,
      isActive: true,
      firstName: 'Jane',
      lastName: 'Roe'
    });

    patientModelB = await Patient.create({
      id: uuidv4(),
      userId: patientUserB.id,
      organizationId: orgB.id,
      documentId: `V-${(Date.now() + 1).toString().slice(-8)}`,
      medicalRecordNumber: `HC-B-${Date.now()}`
    });

    // 6. Citas de Hoy para Org A
    const now = new Date();
    await Appointment.create({
      id: uuidv4(),
      organizationId: orgA.id,
      patientId: patientModelA.id,
      doctorId: doctorModelA.id,
      date: now,
      status: 'Confirmed',
      type: 'In-Person',
      reason: 'Consulta Control A'
    });

    await Appointment.create({
      id: uuidv4(),
      organizationId: orgA.id,
      patientId: patientModelA.id,
      doctorId: doctorModelA.id,
      date: now,
      status: 'Pending',
      type: 'Video',
      reason: 'Telemedicina A'
    });

    // 7. Citas de Hoy para Org B (Tenant B)
    await Appointment.create({
      id: uuidv4(),
      organizationId: orgB.id,
      patientId: patientModelB.id,
      doctorId: doctorModelB.id,
      date: now,
      status: 'Completed',
      type: 'In-Person',
      reason: 'Consulta Culminada B'
    });

    // 8. Pagos del turno de hoy para Org A vs Org B
    await Payment.create({
      id: uuidv4(),
      organizationId: orgA.id,
      patientId: patientModelA.id,
      amount: 150.00,
      amountBs: 5400.00,
      currency: 'USD',
      method: 'Efectivo',
      status: 'Paid',
      createdAt: now
    });

    await Payment.create({
      id: uuidv4(),
      organizationId: orgB.id,
      patientId: patientModelB.id,
      amount: 450.00,
      amountBs: 16200.00,
      currency: 'USD',
      method: 'Zelle',
      status: 'Paid',
      createdAt: now
    });

    // 9. Camas hospitalarias para Org A
    await HospitalBed.create({
      id: uuidv4(),
      organizationId: orgA.id,
      bedNumber: 'A-101',
      roomNumber: '101',
      roomType: 'ICU',
      dailyRateUSD: 250.00,
      status: 'OCCUPIED'
    });

    await HospitalBed.create({
      id: uuidv4(),
      organizationId: orgA.id,
      bedNumber: 'A-102',
      roomNumber: '102',
      roomType: 'INDIVIDUAL',
      dailyRateUSD: 150.00,
      status: 'AVAILABLE'
    });

    // Configuración de Express Test App con Middleware de Autorización real
    app = express();
    app.use(express.json());

    // Middleware simulado de inyección de sesión para probar seguridad
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      if (authHeader === 'Bearer mock-token-admin-a') {
        req.user = { id: adminUserA.id, role: 'ADMIN', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-doctor-a') {
        req.user = { id: doctorUserA.id, role: 'DOCTOR', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-patient-a') {
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

    app.get(
      '/api/stats/live-operations',
      mockAuthMiddleware,
      authorize('stats:read'),
      statsController.getLiveOperationsDashboard
    );
  });

  afterAll(async () => {
    try {
      await setTenantContext(sequelize, { isSuperAdmin: true });
      if (orgA) {
        await Payment.destroy({ where: { organizationId: orgA.id } });
        await Appointment.destroy({ where: { organizationId: orgA.id } });
        await HospitalBed.destroy({ where: { organizationId: orgA.id } });
        await Patient.destroy({ where: { organizationId: orgA.id } });
        await Doctor.destroy({ where: { organizationId: orgA.id } });
        await User.destroy({ where: { organizationId: orgA.id } });
        await Organization.destroy({ where: { id: orgA.id } });
      }
      if (orgB) {
        await Payment.destroy({ where: { organizationId: orgB.id } });
        await Appointment.destroy({ where: { organizationId: orgB.id } });
        await HospitalBed.destroy({ where: { organizationId: orgB.id } });
        await Patient.destroy({ where: { organizationId: orgB.id } });
        await Doctor.destroy({ where: { organizationId: orgB.id } });
        await User.destroy({ where: { organizationId: orgB.id } });
        await Organization.destroy({ where: { id: orgB.id } });
      }
    } catch (err) {
      console.error('Error cleaning test data:', err);
    }
  });

  // =========================================================================
  // 1. AUTHENTICATION & AUTHORIZATION RBAC CHECKS
  // =========================================================================
  describe('1. Control de Acceso y RBAC (stats:read)', () => {
    it('🔒 Rechaza con 401 si la petición no incluye token de sesión', async () => {
      const res = await request(app).get('/api/stats/live-operations');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Acceso no autorizado');
    });

    it('🔒 Rechaza con 403 Forbidden a roles sin permiso stats:read (ej. PATIENT)', async () => {
      const res = await request(app)
        .get('/api/stats/live-operations')
        .set('Authorization', 'Bearer mock-token-patient-a');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/permission/i);
    });

    it('✅ Permite acceso con 200 OK a ADMIN y DOCTOR de la clínica', async () => {
      const resAdmin = await request(app)
        .get('/api/stats/live-operations')
        .set('Authorization', 'Bearer mock-token-admin-a');
      expect(resAdmin.status).toBe(200);

      const resDoctor = await request(app)
        .get('/api/stats/live-operations')
        .set('Authorization', 'Bearer mock-token-doctor-a');
      expect(resDoctor.status).toBe(200);
    });
  });

  // =========================================================================
  // 2. MULTI-TENANT ISOLATION & LIVE METRICS AGGREGATION
  // =========================================================================
  describe('2. Aislamiento Multi-Tenant & Métricas Operativas en Vivo', () => {
    it('🛡️ Tenant A solo ve sus propias métricas operativas del día sin fuga de datos', async () => {
      const res = await request(app)
        .get('/api/stats/live-operations')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      expect(res.body.organizationId).toBe(orgA.id);

      const { appointments, hospital, revenueToday } = res.body.summary;

      // Tenant A tiene exactamente 2 citas creadas para hoy (1 Confirmed, 1 Pending, 1 In-Person, 1 Video)
      expect(appointments.total).toBe(2);
      expect(appointments.confirmed).toBe(1);
      expect(appointments.pending).toBe(1);
      expect(appointments.completed).toBe(0);
      expect(appointments.inPerson).toBe(1);
      expect(appointments.video).toBe(1);

      // Hospitalización de Tenant A: 2 camas (1 OCCUPIED, 1 AVAILABLE) -> 50% ocupación
      expect(hospital.totalBeds).toBe(2);
      expect(hospital.occupiedBeds).toBe(1);
      expect(hospital.availableBeds).toBe(1);
      expect(hospital.occupancyRatePercent).toBe(50.0);

      // Ingresos del turno: Tenant A = $150.00 USD (NO debe sumar los $450 de Tenant B)
      expect(revenueToday.totalUSD).toBe('150.00');
      expect(revenueToday.totalVES).toBe('5400.00');
      expect(revenueToday.paymentsCount).toBe(1);
      expect(revenueToday.methods['Efectivo']).toBe(150.00);
      expect(revenueToday.methods['Zelle']).toBeUndefined();

      // Live Queue: solo citas en estado Pending o Confirmed de Tenant A
      expect(res.body.activeQueue.length).toBe(2);
      expect(res.body.activeQueue[0].doctorName).toBe('Dr. Gregory House');
      expect(res.body.activeQueue[0].patientName).toBe('John Doe');
    });

    it('🛡️ Tenant B solo ve sus propias métricas operativas del día (1 cita Completed, $450 Zelle)', async () => {
      const res = await request(app)
        .get('/api/stats/live-operations')
        .set('Authorization', 'Bearer mock-token-admin-b');

      expect(res.status).toBe(200);
      expect(res.body.organizationId).toBe(orgB.id);

      const { appointments, revenueToday } = res.body.summary;

      expect(appointments.total).toBe(1);
      expect(appointments.completed).toBe(1);
      expect(appointments.confirmed).toBe(0);

      // Ingresos de Tenant B
      expect(revenueToday.totalUSD).toBe('450.00');
      expect(revenueToday.totalVES).toBe('16200.00');
      expect(revenueToday.methods['Zelle']).toBe(450.00);
      expect(revenueToday.methods['Efectivo']).toBeUndefined();
    });

    it('🌐 Superadmin puede consultar de forma global o filtrar por organizationId específico', async () => {
      // Consulta filtrando por tenant B
      const resScoped = await request(app)
        .get(`/api/stats/live-operations?organizationId=${orgB.id}`)
        .set('Authorization', 'Bearer mock-token-superadmin');

      expect(resScoped.status).toBe(200);
      expect(resScoped.body.organizationId).toBe(orgB.id);
      expect(resScoped.body.summary.appointments.total).toBe(1);
    });
  });
});
