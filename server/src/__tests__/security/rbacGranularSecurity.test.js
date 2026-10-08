'use strict';

const request = require('supertest');
const express = require('express');
const {
  ROLES,
  PERMISSIONS,
  hasPermission,
  authorize
} = require('../../middlewares/authorization.middleware');

describe('🛡️ FASE 6: Granular RBAC by Verb and Resource & Privilege Escalation Security Suite', () => {
  describe('1. Granular Matrix Validation (Verbs & Domains)', () => {
    it('🔒 Verifies patient domain permissions separation', () => {
      // READ: doctors, nurses, administrative, receptionist
      expect(hasPermission(ROLES.DOCTOR, 'patients:read')).toBe(true);
      expect(hasPermission(ROLES.NURSE, 'patients:read')).toBe(true);
      expect(hasPermission(ROLES.ADMINISTRATIVE, 'patients:read')).toBe(true);
      expect(hasPermission(ROLES.RECEPTIONIST, 'patients:read')).toBe(true);
      expect(hasPermission(ROLES.PATIENT, 'patients:read')).toBe(false);

      // CREATE / UPDATE: doctor, admin, administrative, receptionist (NOT nurse, NOT patient)
      expect(hasPermission(ROLES.DOCTOR, 'patients:create')).toBe(true);
      expect(hasPermission(ROLES.ADMINISTRATIVE, 'patients:create')).toBe(true);
      expect(hasPermission(ROLES.RECEPTIONIST, 'patients:create')).toBe(true);
      expect(hasPermission(ROLES.NURSE, 'patients:create')).toBe(false);
      expect(hasPermission(ROLES.PATIENT, 'patients:create')).toBe(false);

      // DELETE / EXPORT: admin and superadmin only (NOT doctor, NOT nurse)
      expect(hasPermission(ROLES.ADMIN, 'patients:delete')).toBe(true);
      expect(hasPermission(ROLES.DOCTOR, 'patients:delete')).toBe(false);
      expect(hasPermission(ROLES.NURSE, 'patients:delete')).toBe(false);
      expect(hasPermission(ROLES.ADMINISTRATIVE, 'patients:delete')).toBe(false);

      expect(hasPermission(ROLES.ADMIN, 'patients:export')).toBe(true);
      expect(hasPermission(ROLES.DOCTOR, 'patients:export')).toBe(false);
    });

    it('🔒 Verifies clinical medical records signing restrictions', () => {
      // ONLY DOCTOR and PLATFORM_ADMIN / SUPERADMIN can sign clinical medical records
      expect(hasPermission(ROLES.DOCTOR, 'medical-records:sign')).toBe(true);
      expect(hasPermission(ROLES.SUPER_ADMIN, 'medical-records:sign')).toBe(true);
      expect(hasPermission(ROLES.PLATFORM_ADMIN, 'medical-records:sign')).toBe(true);

      // Aliases with underscore
      expect(hasPermission(ROLES.DOCTOR, 'medical_records:sign')).toBe(true);

      // STRICT BLOCK: Nurse, Administrative, Receptionist, Patient cannot sign
      expect(hasPermission(ROLES.NURSE, 'medical-records:sign')).toBe(false);
      expect(hasPermission(ROLES.ADMINISTRATIVE, 'medical-records:sign')).toBe(false);
      expect(hasPermission(ROLES.RECEPTIONIST, 'medical-records:sign')).toBe(false);
      expect(hasPermission(ROLES.PATIENT, 'medical-records:sign')).toBe(false);
    });

    it('🔒 Verifies billing approval and reconciliation restrictions', () => {
      // ADMINISTRATIVE and ADMIN can approve billing
      expect(hasPermission(ROLES.ADMIN, 'billing:approve')).toBe(true);
      expect(hasPermission(ROLES.ADMINISTRATIVE, 'billing:approve')).toBe(true);
      expect(hasPermission(ROLES.ADMINISTRATIVE, 'billing:reconcile')).toBe(true);

      // STRICT BLOCK: Doctor, Nurse, Patient CANNOT approve billing or reconcile doctor fees
      expect(hasPermission(ROLES.DOCTOR, 'billing:approve')).toBe(false);
      expect(hasPermission(ROLES.NURSE, 'billing:approve')).toBe(false);
      expect(hasPermission(ROLES.PATIENT, 'billing:approve')).toBe(false);
      expect(hasPermission(ROLES.DOCTOR, 'billing:reconcile')).toBe(false);
      expect(hasPermission(ROLES.NURSE, 'billing:reconcile')).toBe(false);
    });

    it('🔒 Verifies prescription issuing restrictions', () => {
      // ONLY Doctor and Superadmin can write prescriptions
      expect(hasPermission(ROLES.DOCTOR, 'prescriptions:write')).toBe(true);
      expect(hasPermission(ROLES.SUPER_ADMIN, 'prescriptions:write')).toBe(true);

      expect(hasPermission(ROLES.NURSE, 'prescriptions:write')).toBe(false);
      expect(hasPermission(ROLES.ADMINISTRATIVE, 'prescriptions:write')).toBe(false);
      expect(hasPermission(ROLES.RECEPTIONIST, 'prescriptions:write')).toBe(false);
      expect(hasPermission(ROLES.PATIENT, 'prescriptions:write')).toBe(false);
    });

    it('🔒 Verifies accounting journal entry restrictions', () => {
      expect(hasPermission(ROLES.ADMINISTRATIVE, 'accounting:write')).toBe(true);
      expect(hasPermission(ROLES.ADMIN, 'accounting:write')).toBe(true);

      expect(hasPermission(ROLES.DOCTOR, 'accounting:write')).toBe(false);
      expect(hasPermission(ROLES.NURSE, 'accounting:write')).toBe(false);
      expect(hasPermission(ROLES.PATIENT, 'accounting:write')).toBe(false);
    });
  });

  describe('2. Privilege Escalation Prevention via HTTP Middleware', () => {
    let app;

    beforeAll(() => {
      app = express();
      app.use(express.json());

      // Mock authentication injector middleware
      const mockAuth = (req, res, next) => {
        const headerRole = req.headers['x-test-role'];
        if (headerRole) {
          req.user = {
            id: 'usr-test-123',
            role: headerRole,
            organizationId: 'org-test-456'
          };
        }
        next();
      };
      app.use(mockAuth);

      // Protected routes mimicking application endpoints
      app.post('/api/patients', authorize('patients:create'), (req, res) => {
        res.status(201).json({ message: 'Patient created' });
      });

      app.delete('/api/patients/:id', authorize('patients:delete'), (req, res) => {
        res.json({ message: 'Patient deleted' });
      });

      app.post('/api/medical-records/:id/sign', authorize('medical-records:sign'), (req, res) => {
        res.json({ message: 'Record signed successfully' });
      });

      app.post('/api/payments/reconcile-doctor-fees', authorize('billing:reconcile'), (req, res) => {
        res.json({ message: 'Doctor fees reconciled' });
      });

      app.post('/api/prescriptions', authorize('prescriptions:write'), (req, res) => {
        res.status(201).json({ message: 'Prescription created' });
      });

      app.get('/api/accounting/trial-balance', authorize('accounting:read'), (req, res) => {
        res.json({ balance: 10000 });
      });
    });

    it('🔒 BLOCKS Nurse attempting to sign a medical record with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/medical-records/med-123/sign')
        .set('x-test-role', 'NURSE');

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('You do not have permission to perform this action');
      expect(res.body.requiredPermission).toBe('medical-records:sign');
      expect(res.body.userRole).toBe('NURSE');
    });

    it('🔒 BLOCKS Administrative staff attempting to sign a medical record with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/medical-records/med-123/sign')
        .set('x-test-role', 'ADMINISTRATIVE');

      expect(res.status).toBe(403);
    });

    it('✅ ALLOWS Doctor to sign a medical record', async () => {
      const res = await request(app)
        .post('/api/medical-records/med-123/sign')
        .set('x-test-role', 'DOCTOR');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Record signed successfully');
    });

    it('🔒 BLOCKS Doctor attempting to reconcile billing / doctor fees with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/payments/reconcile-doctor-fees')
        .set('x-test-role', 'DOCTOR');

      expect(res.status).toBe(403);
      expect(res.body.requiredPermission).toBe('billing:reconcile');
    });

    it('✅ ALLOWS Administrative staff to reconcile billing / doctor fees', async () => {
      const res = await request(app)
        .post('/api/payments/reconcile-doctor-fees')
        .set('x-test-role', 'ADMINISTRATIVE');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Doctor fees reconciled');
    });

    it('🔒 BLOCKS Nurse attempting to create a prescription with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/prescriptions')
        .set('x-test-role', 'NURSE')
        .send({ drug: 'Amoxicillin' });

      expect(res.status).toBe(403);
    });

    it('🔒 BLOCKS Doctor attempting to delete patients (only Admin/Superadmin)', async () => {
      const res = await request(app)
        .delete('/api/patients/pat-999')
        .set('x-test-role', 'DOCTOR');

      expect(res.status).toBe(403);
    });

    it('✅ ALLOWS Superadmin to perform all actions without restriction', async () => {
      const resSign = await request(app)
        .post('/api/medical-records/med-123/sign')
        .set('x-test-role', 'SUPERADMIN');
      expect(resSign.status).toBe(200);

      const resReconcile = await request(app)
        .post('/api/payments/reconcile-doctor-fees')
        .set('x-test-role', 'SUPERADMIN');
      expect(resReconcile.status).toBe(200);

      const resDelete = await request(app)
        .delete('/api/patients/pat-999')
        .set('x-test-role', 'SUPERADMIN');
      expect(resDelete.status).toBe(200);
    });

    it('🔒 Rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/patients').send({ name: 'Jane Doe' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });
  });
});
