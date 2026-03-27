const { ROLES, PERMISSIONS, hasPermission, authorize } = require('../../middlewares/authorization.middleware');

describe('RBAC Authorization', () => {
  describe('hasPermission', () => {
    it('should allow SUPER_ADMIN to do everything', () => {
      expect(hasPermission(ROLES.SUPER_ADMIN, 'patients:write')).toBe(true);
      expect(hasPermission(ROLES.SUPER_ADMIN, 'users:delete')).toBe(true);
      expect(hasPermission(ROLES.SUPER_ADMIN, 'anything:read')).toBe(true);
    });

    it('should allow DOCTOR to read and write patients', () => {
      expect(hasPermission(ROLES.DOCTOR, 'patients:read')).toBe(true);
      expect(hasPermission(ROLES.DOCTOR, 'patients:write')).toBe(true);
    });

    it('should NOT allow PATIENT to write patients', () => {
      expect(hasPermission(ROLES.PATIENT, 'patients:write')).toBe(false);
    });

    it('should allow PATIENT to read their own appointments', () => {
      expect(hasPermission(ROLES.PATIENT, 'appointments:read')).toBe(true);
    });

    it('should return false for unknown permissions', () => {
      expect(hasPermission(ROLES.DOCTOR, 'unknown:action')).toBe(false);
    });

    it('should restrict NURSE from deleting records', () => {
      expect(hasPermission(ROLES.NURSE, 'patients:delete')).toBe(false);
      expect(hasPermission(ROLES.NURSE, 'patients:read')).toBe(true);
    });

    it('should restrict ADMINISTRATIVE from medical records', () => {
      expect(hasPermission(ROLES.ADMINISTRATIVE, 'medical-records:read')).toBe(false);
      expect(hasPermission(ROLES.ADMINISTRATIVE, 'payments:write')).toBe(true);
    });
  });

  describe('authorize middleware factory', () => {
    it('should return 401 if no user', () => {
      const req = { user: null };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = authorize('patients:read');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user lacks permission', () => {
      const req = { user: { id: 1, role: ROLES.PATIENT } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = authorize('patients:write');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next if user has permission', () => {
      const req = { user: { id: 1, role: ROLES.DOCTOR } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = authorize('patients:read');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
