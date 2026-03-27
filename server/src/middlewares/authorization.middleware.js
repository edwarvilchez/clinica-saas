/**
 * Role-Based Access Control (RBAC) Middleware
 * Centralized authorization for resources based on user roles
 */

const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  ADMINISTRATIVE: 'ADMINISTRATIVE',
  DOCTOR: 'DOCTOR',
  NURSE: 'NURSE',
  PATIENT: 'PATIENT'
};

const PERMISSIONS = {
  // Users management
  'users:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'users:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'users:delete': [ROLES.SUPER_ADMIN],

  // Patients
  'patients:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE],
  'patients:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  'patients:delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // Doctors
  'doctors:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE],
  'doctors:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'doctors:delete': [ROLES.SUPER_ADMIN],

  // Nurses
  'nurses:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE],
  'nurses:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'nurses:delete': [ROLES.SUPER_ADMIN],

  // Staff
  'staff:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'staff:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'staff:delete': [ROLES.SUPER_ADMIN],

  // Appointments
  'appointments:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE, ROLES.PATIENT],
  'appointments:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE],
  'appointments:delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],

  // Medical Records
  'medical-records:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  'medical-records:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  'medical-records:delete': [ROLES.SUPER_ADMIN],

  // Lab Results
  'lab-results:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE],
  'lab-results:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.NURSE],
  'lab-results:delete': [ROLES.SUPER_ADMIN],

  // Payments
  'payments:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'payments:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'payments:delete': [ROLES.SUPER_ADMIN],

  // Statistics
  'stats:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  
  // Video Consultations
  'video-consultations:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT],
  'video-consultations:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT],
  
  // Bulk Operations
  'bulk:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  // Team
  'team:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  'team:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // Organizations
  'organizations:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'organizations:write': [ROLES.SUPER_ADMIN],
  
  // Subscriptions (super admin only)
  'subscriptions:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'subscriptions:write': [ROLES.SUPER_ADMIN],
  
  // Drugs
  'drugs:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.PATIENT],
  'drugs:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  // Prescriptions
  'prescriptions:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT],
  'prescriptions:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  
  // Specialties
  'specialties:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  'specialties:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  // Lab Catalog
  'lab-catalog:read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.NURSE],
  'lab-catalog:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
};

/**
 * Check if user role has permission for specific action
 */
const hasPermission = (userRole, permission) => {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    return false;
  }
  return allowedRoles.includes(userRole);
};

/**
 * Middleware factory for checking permissions
 * @param {string} permission - Permission to check (e.g., 'patients:read')
 * @param {object} options - Additional options
 * @param {boolean} options.ownership - If true, check resource ownership
 */
const authorize = (permission, options = {}) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;

    if (!hasPermission(userRole, permission)) {
      logger.warn({
        userId: req.user.id,
        userRole,
        permission,
        path: req.path,
        method: req.method
      }, 'Authorization denied: insufficient permissions');
      
      return res.status(403).json({ 
        message: 'You do not have permission to perform this action' 
      });
    }

    next();
  };
};

/**
 * Middleware to check if user owns the resource or is admin/super_admin
 */
const authorizeOwner = (Model, ownerField = 'userId') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const resourceId = req.params.id || req.body.id;

    if (userRole === ROLES.SUPER_ADMIN || userRole === ROLES.ADMIN) {
      return next();
    }

    if (!resourceId) {
      return next();
    }

    try {
      const resource = await Model.findByPk(resourceId);
      
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      const ownerId = resource[ownerField];
      
      if (ownerId !== req.user.id) {
        logger.warn({
          userId: req.user.id,
          resourceId,
          ownerId,
          model: Model.name
        }, 'Authorization denied: not resource owner');
        
        return res.status(403).json({ 
          message: 'You do not have permission to access this resource' 
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Require specific roles
 */
const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: 'You do not have permission to perform this action' 
      });
    }

    next();
  };
};

module.exports = {
  ROLES,
  PERMISSIONS,
  hasPermission,
  authorize,
  authorizeOwner,
  requireRoles
};
