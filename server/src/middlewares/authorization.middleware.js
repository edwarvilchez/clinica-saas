/**
 * Role-Based Access Control (RBAC) Middleware
 * Centralized authorization for resources based on user roles and granular permissions.
 */

const logger = require('../utils/logger');

const ROLES = {
  SUPER_ADMIN: 'SUPERADMIN',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN', // Manager de la plataforma (Vendedor / Demo)
  ADMIN: 'ADMIN',
  ADMINISTRATIVE: 'ADMINISTRATIVE',
  RECEPTIONIST: 'RECEPTIONIST',
  DOCTOR: 'DOCTOR',
  NURSE: 'NURSE',
  PATIENT: 'PATIENT'
};

const PERMISSIONS = {
  // --- Users management ---
  'users:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],
  'users:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],
  'users:delete': [ROLES.SUPER_ADMIN],

  // --- Patients ---
  'patients:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'patients:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'patients:create': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'patients:update': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'patients:delete': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],
  'patients:export': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],

  // --- Doctors ---
  'doctors:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'doctors:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],
  'doctors:delete': [ROLES.SUPER_ADMIN],

  // --- Nurses ---
  'nurses:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE],
  'nurses:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],
  'nurses:delete': [ROLES.SUPER_ADMIN],

  // --- Staff & Employees ---
  'staff:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],
  'staff:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],
  'staff:delete': [ROLES.SUPER_ADMIN],
  'employees:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'employees:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'employees:delete': [ROLES.SUPER_ADMIN],

  // --- Appointments ---
  'appointments:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST, ROLES.PATIENT],
  'appointments:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'appointments:create': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'appointments:update': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'appointments:delete': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],

  // --- Medical Records ---
  'medical-records:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  'medical-records:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  'medical-records:create': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  'medical-records:sign': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.DOCTOR], // Only Doctors and superadmins can sign
  'medical-records:delete': [ROLES.SUPER_ADMIN],

  // --- Prescriptions ---
  'prescriptions:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.PATIENT],
  'prescriptions:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.DOCTOR],
  'prescriptions:create': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.DOCTOR],
  'prescriptions:delete': [ROLES.SUPER_ADMIN, ROLES.DOCTOR],

  // --- Lab Results & Catalog ---
  'lab-results:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE],
  'lab-results:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE],
  'lab-results:delete': [ROLES.SUPER_ADMIN],
  'lab-catalog:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE],
  'lab-catalog:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ADMINISTRATIVE],

  // --- Payments, Billing & CXP ---
  'payments:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'payments:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'payments:create': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'payments:approve': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'payments:reconcile': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'payments:delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'billing:approve': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'billing:reconcile': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],

  // --- Doctor Fees ---
  'doctor-fees:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.DOCTOR],
  'doctor-fees:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'doctor-fees:pay': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],

  // --- Revenue Intelligence (Fase 22) ---
  'revenue:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'revenue:export': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],

  // --- Patient Portal (Fase 23) ---
  'portal:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.PATIENT],
  'portal:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.PATIENT],

  // --- Clinical AI & CDSS Decision Support (Fase 24) ---
  'clinical-ai:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  'clinical-ai:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],
  'clinical-ai:review': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR],

  // --- Omnichannel Communications & WhatsApp (Fase 25) ---
  'communications:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'communications:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.DOCTOR],

  // --- Accounting ---
  'accounting:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'accounting:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'accounting:delete': [ROLES.SUPER_ADMIN],

  // --- Inventory & Drugs ---
  'inventory:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE],
  'inventory:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],
  'inventory:delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'drugs:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE, ROLES.PATIENT],
  'drugs:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE],

  // --- Hospitalization ---
  'hospital:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE],
  'hospital:triage': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE],
  'hospital:admit': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE],
  'hospital:discharge': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.DOCTOR],
  'hospital:surgery': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.DOCTOR],

  // --- Insurance ---
  'insurance:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'insurance:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'insurance:delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // --- Sales & Packages ---
  'sales:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'sales:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'sales:delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

  // --- Specialties ---
  'specialties:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST, ROLES.PATIENT],
  'specialties:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],

  // --- Statistics & Reports ---
  'stats:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ADMINISTRATIVE],

  // --- Team ---
  'team:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ADMINISTRATIVE],
  'team:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],

  // --- Organizations & Subscriptions ---
  'organizations:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],
  'organizations:write': [ROLES.SUPER_ADMIN],
  'subscriptions:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],
  'subscriptions:write': [ROLES.SUPER_ADMIN],

  // --- Video Consultations ---
  'video-consultations:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT],
  'video-consultations:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT],

  // --- Clinical CRM & Leads Funnel ---
  'crm:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'crm:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'crm:create': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'crm:update': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'crm:convert': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'crm:delete': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],

  // --- Smart Waitlist (Fase 21) ---
  'waitlist:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST, ROLES.PATIENT],
  'waitlist:write': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST],
  'waitlist:create': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST, ROLES.PATIENT],
  'waitlist:accept': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE, ROLES.RECEPTIONIST, ROLES.PATIENT],
  'waitlist:delete': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.ADMINISTRATIVE],

  // --- Files ---
  'files:read': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE, ROLES.PATIENT],
  'files:upload': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMINISTRATIVE],
  'files:delete': [ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.ADMIN],

  // --- Bulk Operations ---
  'bulk:write': [ROLES.SUPER_ADMIN, ROLES.ADMIN]
};

/**
 * Check if user role has permission for specific action.
 * Normalizes role casing and permission format (underscore vs hyphen).
 */
const hasPermission = (userRole, permission) => {
  if (!userRole) return false;

  const normalizedRole = String(userRole).toUpperCase();

  // SUPERADMIN & PLATFORM_ADMIN (Root/Platform Manager) always have full system permissions
  if (normalizedRole === ROLES.SUPER_ADMIN || normalizedRole === ROLES.PLATFORM_ADMIN) {
    return true;
  }

  // Normalize aliases (hyphen/underscore equivalence)
  const normalizedPerm = permission.replace(/_/g, '-');

  let allowedRoles = PERMISSIONS[permission] || PERMISSIONS[normalizedPerm];

  // Specific alias mappings
  if (!allowedRoles) {
    if (permission === 'billing:approve') allowedRoles = PERMISSIONS['payments:approve'];
    else if (permission === 'billing:reconcile') allowedRoles = PERMISSIONS['payments:reconcile'];
    else if (permission === 'medical_records:sign') allowedRoles = PERMISSIONS['medical-records:sign'];
    else if (permission === 'doctor_fees:pay') allowedRoles = PERMISSIONS['doctor-fees:pay'];
  }

  if (!allowedRoles) {
    return false;
  }

  return allowedRoles.includes(normalizedRole);
};

/**
 * Middleware factory for checking permissions.
 * Supports a single permission or an array of permissions (satisfying any).
 *
 * @param {string|string[]} permissions - Permission or list of permissible actions
 * @param {object} options - Additional options
 * @param {boolean} options.ownership - If true, check resource ownership
 */
const authorize = (permissions, options = {}) => {
  const permList = Array.isArray(permissions) ? permissions : [permissions];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role ? String(req.user.role).toUpperCase() : null;

    const allowed = permList.some(perm => hasPermission(userRole, perm));

    if (!allowed) {
      logger.warn({
        userId: req.user.id,
        userRole,
        permissions: permList,
        path: req.path,
        method: req.method
      }, 'Authorization denied: insufficient permissions');

      return res.status(403).json({
        message: 'You do not have permission to perform this action',
        requiredPermission: permList.length === 1 ? permList[0] : permList,
        userRole
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

    const userRole = req.user.role ? String(req.user.role).toUpperCase() : null;
    const resourceId = req.params.id || req.body.id;

    if (userRole === ROLES.SUPER_ADMIN || userRole === ROLES.PLATFORM_ADMIN || userRole === ROLES.ADMIN) {
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
  const normalizedAllowed = allowedRoles.map(r => String(r).toUpperCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role ? String(req.user.role).toUpperCase() : null;

    if (userRole === ROLES.SUPER_ADMIN || userRole === ROLES.PLATFORM_ADMIN) {
      return next();
    }

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action',
        requiredRoles: allowedRoles,
        userRole
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
