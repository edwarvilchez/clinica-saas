'use strict';

/**
 * 🛡️ FASE 22: Revenue Intelligence & Financial Segregation Security Suite
 * Tests multi-tenant financial isolation, RBAC enforcement (clinical roles blocked from clinic revenues),
 * accurate gross/net calculation, payment method distribution, doctor liability schedules,
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
  Payment,
  DoctorFee,
  AuditLog,
  sequelize
} = require('../../models');
const revenueController = require('../../controllers/revenueIntelligence.controller');
const { authorize } = require('../../middlewares/authorization.middleware');
const { eventBus, DOMAIN_EVENTS } = require('../../events/eventBus');

describe('🛡️ FASE 22: Revenue Intelligence Security & Financial Isolation Suite', () => {
  let app;
  let orgA;
  let orgB;
  let adminUserA;
  let adminUserB;
  let superadminUser;
  let adminRole;
  let adminStaffUserA;
  let doctorUserA;
  let doctorA;
  let nurseUserA;
  let recepUserA;
  let patientUserA;
  let patientA;
  let patientUserB;
  let patientB;
  let specialtyCardio;
  let specialtyDerma;

  // Payments & Fees
  let paymentOrgA1;
  let paymentOrgA2;
  let paymentOrgA_Pending;
  let paymentOrgB1;
  let feeDocA1;
  let feeDocA2;

  beforeAll(async () => {
    await sequelize.authenticate();
    await setTenantContext(sequelize, { isSuperAdmin: true });

    // 1. Roles
    [adminRole] = await Role.findOrCreate({ where: { name: 'ADMIN' }, defaults: { description: 'Administrador' } });
    const [superadminRole] = await Role.findOrCreate({ where: { name: 'SUPERADMIN' }, defaults: { description: 'Super Administrador' } });
    const [adminStaffRole] = await Role.findOrCreate({ where: { name: 'ADMINISTRATIVE' }, defaults: { description: 'Administrativo' } });
    const [patientRole] = await Role.findOrCreate({ where: { name: 'PATIENT' }, defaults: { description: 'Paciente' } });
    const [doctorRole] = await Role.findOrCreate({ where: { name: 'DOCTOR' }, defaults: { description: 'Médico' } });
    const [nurseRole] = await Role.findOrCreate({ where: { name: 'NURSE' }, defaults: { description: 'Enfermero' } });
    const [recepRole] = await Role.findOrCreate({ where: { name: 'RECEPTIONIST' }, defaults: { description: 'Recepcionista' } });

    // 2. Specialties
    [specialtyCardio] = await Specialty.findOrCreate({
      where: { name: 'Cardiología Revenue Test' },
      defaults: { description: 'Especialidad Revenue Test' }
    });
    [specialtyDerma] = await Specialty.findOrCreate({
      where: { name: 'Dermatología Revenue Test' },
      defaults: { description: 'Especialidad Revenue Test' }
    });

    // 3. Organizations
    adminUserA = await User.create({
      id: uuidv4(),
      username: `admin_rev_a_${Date.now()}`,
      email: `admin_rev_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Revenue Alfa'
    });

    adminUserB = await User.create({
      id: uuidv4(),
      username: `admin_rev_b_${Date.now()}`,
      email: `admin_rev_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminRole.id,
      isActive: true,
      firstName: 'Admin',
      lastName: 'Revenue Beta'
    });

    superadminUser = await User.create({
      id: uuidv4(),
      username: `super_rev_${Date.now()}`,
      email: `super_rev_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: superadminRole.id,
      isActive: true,
      firstName: 'Super',
      lastName: 'Admin'
    });

    orgA = await Organization.create({
      id: uuidv4(),
      name: `Clínica Revenue Alfa ${Date.now()}`,
      slug: `rev-alfa-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserA.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    orgB = await Organization.create({
      id: uuidv4(),
      name: `Clínica Revenue Beta ${Date.now()}`,
      slug: `rev-beta-${Date.now()}`,
      type: 'CLINIC',
      ownerId: adminUserB.id,
      subscriptionStatus: 'ACTIVE',
      isActive: true
    });

    await adminUserA.update({ organizationId: orgA.id });
    await adminUserB.update({ organizationId: orgB.id });

    // 4. Staff, Doctors, Patients in Org A
    adminStaffUserA = await User.create({
      id: uuidv4(),
      username: `adminstaff_rev_a_${Date.now()}`,
      email: `adminstaff_rev_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: adminStaffRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Finanzas',
      lastName: 'Staff'
    });

    doctorUserA = await User.create({
      id: uuidv4(),
      username: `doc_rev_a_${Date.now()}`,
      email: `doc_rev_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: doctorRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Alejandro',
      lastName: 'Paredes'
    });

    doctorA = await Doctor.create({
      id: uuidv4(),
      userId: doctorUserA.id,
      specialtyId: specialtyCardio.id,
      licenseNumber: `MED-REV-${Date.now().toString().slice(-6)}`,
      organizationId: orgA.id
    });

    nurseUserA = await User.create({
      id: uuidv4(),
      username: `nurse_rev_a_${Date.now()}`,
      email: `nurse_rev_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: nurseRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Elena',
      lastName: 'Vargas'
    });

    recepUserA = await User.create({
      id: uuidv4(),
      username: `recep_rev_a_${Date.now()}`,
      email: `recep_rev_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: recepRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Rosa',
      lastName: 'Morales'
    });

    patientUserA = await User.create({
      id: uuidv4(),
      username: `pat_rev_a_${Date.now()}`,
      email: `pat_rev_a_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgA.id,
      isActive: true,
      firstName: 'Santiago',
      lastName: 'García'
    });

    patientA = await Patient.create({
      id: uuidv4(),
      userId: patientUserA.id,
      organizationId: orgA.id,
      phone: '+584128880001',
      documentId: `V-${Date.now().toString().slice(-8)}`
    });

    // 5. Patient in Org B
    patientUserB = await User.create({
      id: uuidv4(),
      username: `pat_rev_b_${Date.now()}`,
      email: `pat_rev_b_${Date.now()}@test.com`,
      password: 'HashPassword123!',
      roleId: patientRole.id,
      organizationId: orgB.id,
      isActive: true,
      firstName: 'Lucía',
      lastName: 'Méndez'
    });

    patientB = await Patient.create({
      id: uuidv4(),
      userId: patientUserB.id,
      organizationId: orgB.id,
      phone: '+584128880002',
      documentId: `V-${(Date.now() + 1).toString().slice(-8)}`
    });

    // 6. Appointments & Financial Records for Org A
    const apptOrgA1 = await Appointment.create({
      id: uuidv4(),
      patientId: patientA.id,
      doctorId: doctorA.id,
      date: new Date(),
      reason: 'Consulta Cardiología Pago Zelle',
      status: 'Completed',
      organizationId: orgA.id
    });

    const apptOrgA2 = await Appointment.create({
      id: uuidv4(),
      patientId: patientA.id,
      doctorId: doctorA.id,
      date: new Date(),
      reason: 'Consulta Cardiología Pago Efectivo',
      status: 'Completed',
      organizationId: orgA.id
    });

    // Paid payment 1 in Org A: $100 USD (Zelle) -> $70 doctor, $30 clinic
    paymentOrgA1 = await Payment.create({
      id: uuidv4(),
      amount: 100.00,
      amountBs: 3600.00,
      method: 'Zelle',
      currency: 'USD',
      status: 'Paid',
      concept: 'Consulta Especialista Cardiología',
      paymentType: 'APPOINTMENT',
      doctorFeePercentage: 70.00,
      doctorFeeAmount: 70.00,
      clinicFeeAmount: 30.00,
      pharmacyDiscount: 5.00,
      reconciliationStatus: 'RECONCILED',
      organizationId: orgA.id,
      patientId: patientA.id,
      appointmentId: apptOrgA1.id
    });

    // Paid payment 2 in Org A: $200 USD (Cash) -> $140 doctor, $60 clinic
    paymentOrgA2 = await Payment.create({
      id: uuidv4(),
      amount: 200.00,
      amountBs: 7200.00,
      method: 'Cash',
      currency: 'USD',
      status: 'Paid',
      concept: 'Ecocardiograma Avanzado',
      paymentType: 'APPOINTMENT',
      doctorFeePercentage: 70.00,
      doctorFeeAmount: 140.00,
      clinicFeeAmount: 60.00,
      pharmacyDiscount: 0.00,
      reconciliationStatus: 'PENDING',
      organizationId: orgA.id,
      patientId: patientA.id,
      appointmentId: apptOrgA2.id
    });

    // Pending payment in Org A: $50 USD
    paymentOrgA_Pending = await Payment.create({
      id: uuidv4(),
      amount: 50.00,
      amountBs: 1800.00,
      method: 'Transferencia',
      currency: 'USD',
      status: 'Pending',
      concept: 'Examen Pre-Operatorio Pendiente',
      paymentType: 'APPOINTMENT',
      organizationId: orgA.id,
      patientId: patientA.id
    });

    // Doctor Fees for Doctor A
    feeDocA1 = await DoctorFee.create({
      id: uuidv4(),
      organizationId: orgA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      paymentId: paymentOrgA1.id,
      serviceConcept: 'Consulta Cardiología',
      serviceType: 'CONSULTATION',
      totalAmountUSD: 100.00,
      doctorPercent: 70.00,
      clinicPercent: 30.00,
      doctorAmountUSD: 70.00,
      clinicAmountUSD: 30.00,
      retentionIslrPercent: 3.00,
      retentionIslrUSD: 2.10,
      netPayableUSD: 67.90,
      status: 'PAID' // Settled
    });

    feeDocA2 = await DoctorFee.create({
      id: uuidv4(),
      organizationId: orgA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      paymentId: paymentOrgA2.id,
      serviceConcept: 'Ecocardiograma',
      serviceType: 'PROCEDURE',
      totalAmountUSD: 200.00,
      doctorPercent: 70.00,
      clinicPercent: 30.00,
      doctorAmountUSD: 140.00,
      clinicAmountUSD: 60.00,
      retentionIslrPercent: 3.00,
      retentionIslrUSD: 4.20,
      netPayableUSD: 135.80,
      status: 'PENDING' // Pending payout
    });

    // Financial Record for Org B: $500 USD (Card)
    paymentOrgB1 = await Payment.create({
      id: uuidv4(),
      amount: 500.00,
      amountBs: 18000.00,
      method: 'Tarjeta',
      currency: 'USD',
      status: 'Paid',
      concept: 'Paquete Quirúrgico Org B',
      paymentType: 'APPOINTMENT',
      doctorFeePercentage: 60.00,
      doctorFeeAmount: 300.00,
      clinicFeeAmount: 200.00,
      organizationId: orgB.id,
      patientId: patientB.id
    });

    // 7. Express App Setup with simulated Auth
    app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) return next();

      if (authHeader === 'Bearer mock-token-admin-a') {
        req.user = { id: adminUserA.id, role: 'ADMIN', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-admin-b') {
        req.user = { id: adminUserB.id, role: 'ADMIN', organizationId: orgB.id };
      } else if (authHeader === 'Bearer mock-token-staff-a') {
        req.user = { id: adminStaffUserA.id, role: 'ADMINISTRATIVE', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-doc-a') {
        req.user = { id: doctorUserA.id, role: 'DOCTOR', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-nurse-a') {
        req.user = { id: nurseUserA.id, role: 'NURSE', organizationId: orgA.id };
      } else if (authHeader === 'Bearer mock-token-recep-a') {
        req.user = { id: recepUserA.id, role: 'RECEPTIONIST', organizationId: orgA.id };
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

    app.get('/api/revenue/analytics', mockAuthMiddleware, authorize('revenue:read'), revenueController.getRevenueAnalytics);
    app.get('/api/revenue/trends', mockAuthMiddleware, authorize('revenue:read'), revenueController.getRevenueTrends);
    app.get('/api/revenue/payouts-liability', mockAuthMiddleware, authorize('revenue:read'), revenueController.getDoctorPayoutsLiability);
    app.get('/api/revenue/export', mockAuthMiddleware, authorize('revenue:export'), revenueController.exportRevenueReport);
  });

  afterAll(async () => {
    try {
      await setTenantContext(sequelize, { isSuperAdmin: true });
      await DoctorFee.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Payment.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Appointment.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Patient.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Doctor.destroy({ where: { organizationId: [orgA?.id, orgB?.id] }, force: true });
      await Organization.destroy({ where: { id: [orgA?.id, orgB?.id] }, force: true });
      await User.destroy({
        where: {
          id: [
            adminUserA?.id, adminUserB?.id, superadminUser?.id, adminStaffUserA?.id, doctorUserA?.id,
            nurseUserA?.id, recepUserA?.id, patientUserA?.id, patientUserB?.id
          ].filter(Boolean)
        },
        force: true
      });
      if (specialtyCardio) await Specialty.destroy({ where: { id: specialtyCardio.id } });
      if (specialtyDerma) await Specialty.destroy({ where: { id: specialtyDerma.id } });
    } catch (e) {
      // Ignore append-only audit log trigger on cascade
    }
  });

  beforeEach(() => {
    eventBus.clearHistory();
  });

  describe('1. RBAC & Principle of Least Privilege Enforcement', () => {
    it('debe rechazar solicitudes anónimas con 401 Unauthorized', async () => {
      const res = await request(app).get('/api/revenue/analytics');
      expect(res.status).toBe(401);
    });

    it('debe denegar acceso a analítica financiera al rol PATIENT con 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/revenue/analytics')
        .set('Authorization', 'Bearer mock-token-pat-a');

      expect(res.status).toBe(403);
    });

    it('debe denegar acceso a analítica financiera de clínica al rol DOCTOR con 403 Forbidden', async () => {
      // Los médicos gestionan sus honorarios propios, no la inteligencia de ingresos de la empresa
      const res = await request(app)
        .get('/api/revenue/analytics')
        .set('Authorization', 'Bearer mock-token-doc-a');

      expect(res.status).toBe(403);
    });

    it('debe denegar acceso al personal de enfermería (NURSE) con 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/revenue/analytics')
        .set('Authorization', 'Bearer mock-token-nurse-a');

      expect(res.status).toBe(403);
    });

    it('debe denegar acceso al personal de recepción (RECEPTIONIST) con 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/revenue/analytics')
        .set('Authorization', 'Bearer mock-token-recep-a');

      expect(res.status).toBe(403);
    });

    it('debe permitir acceso al personal administrativo de finanzas (ADMINISTRATIVE) con 200 OK', async () => {
      const res = await request(app)
        .get('/api/revenue/analytics')
        .set('Authorization', 'Bearer mock-token-staff-a');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('overview');
    });

    it('debe impedir exportar reporte financiero a ADMINISTRATIVE si no tiene revenue:export (403)', async () => {
      const res = await request(app)
        .get('/api/revenue/export')
        .set('Authorization', 'Bearer mock-token-staff-a');

      expect(res.status).toBe(403);
    });

    it('debe permitir exportar reporte a ADMIN con 200 OK', async () => {
      const res = await request(app)
        .get('/api/revenue/export')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('exportedAt');
      expect(res.body).toHaveProperty('overview');
    });
  });

  describe('2. Multi-Tenant Financial Data Isolation', () => {
    it('Admin de Org A únicamente debe ver ingresos correspondientes a Org A', async () => {
      const res = await request(app)
        .get('/api/revenue/analytics')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      // Org A: paymentOrgA1 ($100) + paymentOrgA2 ($200) = $300 USD
      expect(res.body.overview.grossRevenueUSD).toBe(300.00);
      expect(res.body.overview.paidTransactionsCount).toBe(2);
    });

    it('Admin de Org B únicamente debe ver ingresos correspondientes a Org B ($500 USD)', async () => {
      const res = await request(app)
        .get('/api/revenue/analytics')
        .set('Authorization', 'Bearer mock-token-admin-b');

      expect(res.status).toBe(200);
      // Org B: paymentOrgB1 ($500)
      expect(res.body.overview.grossRevenueUSD).toBe(500.00);
      expect(res.body.overview.paidTransactionsCount).toBe(1);
    });

    it('Superadmin puede consultar analíticas especificando organizationId de Org A', async () => {
      const res = await request(app)
        .get(`/api/revenue/analytics?organizationId=${orgA.id}`)
        .set('Authorization', 'Bearer mock-token-superadmin');

      expect(res.status).toBe(200);
      expect(res.body.overview.grossRevenueUSD).toBe(300.00);
    });
  });

  describe('3. Accurate Financial Calculations & Net Margin Calculation', () => {
    let reportA;

    beforeAll(async () => {
      const res = await request(app)
        .get('/api/revenue/analytics')
        .set('Authorization', 'Bearer mock-token-admin-a');
      reportA = res.body;
    });

    it('debe calcular correctamente el ingreso bruto bimonetario (USD y VES)', () => {
      // Org A: $100 + $200 = $300 USD | 3600 + 7200 = 10800 VES
      expect(reportA.overview.grossRevenueUSD).toBe(300.00);
      expect(reportA.overview.grossRevenueVES).toBe(10800.00);
    });

    it('debe calcular con precisión honorarios médicos, descuentos y margen operativo neto', () => {
      // Doctor fees: $70 + $140 = $210 USD
      // Clinic fees: $30 + $60 = $90 USD
      // Pharmacy discount: $5 USD
      // Net operating revenue = Gross ($300) - DocFees ($210) - Discounts ($5) = $85 USD
      expect(reportA.overview.totalDoctorFeesUSD).toBe(210.00);
      expect(reportA.overview.totalClinicFeesUSD).toBe(90.00);
      expect(reportA.overview.totalPharmacyDiscountsUSD).toBe(5.00);
      expect(reportA.overview.netOperatingRevenueUSD).toBe(85.00);

      // Margen operativo % = (85 / 300) * 100 = 28.33%
      expect(reportA.overview.operatingMarginPercentage).toBe(28.33);
    });

    it('debe calcular el ticket promedio (averageTicketUSD)', () => {
      // $300 / 2 transacciones = $150.00
      expect(reportA.overview.averageTicketUSD).toBe(150.00);
    });

    it('debe reportar ingresos pendientes de cobro (uncollectedRevenueUSD)', () => {
      // paymentOrgA_Pending = $50 USD
      expect(reportA.overview.uncollectedRevenueUSD).toBe(50.00);
      expect(reportA.overview.pendingTransactionsCount).toBe(1);
    });
  });

  describe('4. Breakdown by Payment Method & Specialty', () => {
    let reportA;

    beforeAll(async () => {
      const res = await request(app)
        .get('/api/revenue/analytics')
        .set('Authorization', 'Bearer mock-token-admin-a');
      reportA = res.body;
    });

    it('debe desglosar los ingresos por método de pago con porcentajes correctos', () => {
      const methods = reportA.revenueByPaymentMethod;
      expect(methods.length).toBeGreaterThanOrEqual(2);

      const cash = methods.find(m => m.method === 'Cash');
      const zelle = methods.find(m => m.method === 'Zelle');

      expect(cash).toBeDefined();
      expect(cash.totalUSD).toBe(200.00);
      expect(cash.percentageOfGross).toBe(66.67);

      expect(zelle).toBeDefined();
      expect(zelle.totalUSD).toBe(100.00);
      expect(zelle.percentageOfGross).toBe(33.33);
    });

    it('debe desglosar los ingresos por especialidad médica', () => {
      const specialties = reportA.revenueBySpecialty;
      expect(specialties.length).toBeGreaterThanOrEqual(1);

      const cardio = specialties.find(s => s.specialty === 'Cardiología Revenue Test');
      expect(cardio).toBeDefined();
      expect(cardio.totalUSD).toBe(300.00);
      expect(cardio.percentageOfGross).toBe(100.00);
    });
  });

  describe('5. Doctor Payouts Liability Schedule', () => {
    it('debe calcular el pasivo pendiente por pagar y el monto liquidado a médicos', async () => {
      const res = await request(app)
        .get('/api/revenue/payouts-liability')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('doctorBreakdown');

      // Summary:
      // Gross: $100 + $200 = $300
      // Total Doctor Payable: 67.90 + 135.80 = 203.70
      // Clinic Retained: 30 + 60 = 90
      // ISLR: 2.10 + 4.20 = 6.30
      expect(res.body.summary.totalGrossUSD).toBe(300.00);
      expect(res.body.summary.totalDoctorPayableUSD).toBe(203.70);
      expect(res.body.summary.totalClinicRetainedUSD).toBe(90.00);
      expect(res.body.summary.totalIslrWithheldUSD).toBe(6.30);

      // Doctor Breakdown
      const docEntry = res.body.doctorBreakdown.find(d => d.doctorId === doctorA.id);
      expect(docEntry).toBeDefined();
      expect(docEntry.totalEarnedUSD).toBe(203.70);
      expect(docEntry.settledPayoutUSD).toBe(67.90); // feeDocA1 is PAID
      expect(docEntry.pendingPayoutUSD).toBe(135.80); // feeDocA2 is PENDING
    });
  });

  describe('6. Historical Revenue Trends & Time-Series', () => {
    it('debe devolver serie temporal de tendencias con agregación diaria', async () => {
      const res = await request(app)
        .get('/api/revenue/trends?interval=daily')
        .set('Authorization', 'Bearer mock-token-admin-a');

      expect(res.status).toBe(200);
      expect(res.body.interval).toBe('daily');
      expect(res.body.trends.length).toBeGreaterThan(0);

      const todayPoint = res.body.trends[0];
      expect(todayPoint).toHaveProperty('date');
      expect(todayPoint).toHaveProperty('grossUSD');
      expect(todayPoint).toHaveProperty('netUSD');
      expect(todayPoint.grossUSD).toBe(300.00);
    });
  });

  describe('7. Tamper-Evident Audit Logging & Domain Event Bus', () => {
    it('debe registrar evento de auditoría y emitir evento de dominio al consultar analíticas', async () => {
      await request(app)
        .get('/api/revenue/analytics')
        .set('Authorization', 'Bearer mock-token-admin-a');

      // Verify AuditLog
      const auditLog = await AuditLog.findOne({
        where: {
          organizationId: orgA.id,
          action: 'REVENUE_ANALYTICS_ACCESSED'
        },
        order: [['timestamp', 'DESC']]
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog.entity).toBe('Payment');

      // Verify DomainEventBus
      const recentEvents = eventBus.getRecentEvents();
      const event = recentEvents.find(e => e.eventName === DOMAIN_EVENTS.REVENUE_ANALYTICS_REQUESTED);
      expect(event).toBeDefined();
      expect(event.payload.grossRevenueUSD).toBe(300.00);
    });
  });
});
