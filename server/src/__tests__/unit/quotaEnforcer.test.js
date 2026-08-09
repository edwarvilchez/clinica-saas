const { PLAN_LIMITS, checkSubscriptionActive, checkDoctorQuota, checkAppointmentQuota } = require('../../middlewares/quotaEnforcer.middleware');

describe('SaaS Quota Enforcer & Subscription Middleware', () => {
  test('Límites de planes configurados correctamente (PROFESSIONAL vs CLINIC vs HOSPITAL)', () => {
    expect(PLAN_LIMITS.PROFESSIONAL.maxDoctors).toBe(2);
    expect(PLAN_LIMITS.PROFESSIONAL.maxAppointmentsPerMonth).toBe(100);

    expect(PLAN_LIMITS.CLINIC.maxDoctors).toBe(15);
    expect(PLAN_LIMITS.CLINIC.maxAppointmentsPerMonth).toBe(1000);

    expect(PLAN_LIMITS.HOSPITAL.maxDoctors).toBe(Infinity);
    expect(PLAN_LIMITS.HOSPITAL.maxAppointmentsPerMonth).toBe(Infinity);
  });

  test('Permite acceso a SUPERADMIN o usuarios con subscriptionBypass', async () => {
    const req = {
      user: {
        role: 'SUPERADMIN',
        subscriptionBypass: false,
        organizationId: 'org-123'
      }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await checkSubscriptionActive(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('Permite acceso a usuarios con subscriptionBypass activo', async () => {
    const req = {
      user: {
        role: 'DOCTOR',
        subscriptionBypass: true,
        organizationId: 'org-123'
      }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await checkDoctorQuota(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
