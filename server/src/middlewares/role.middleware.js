/**
 * Middleware para verificar roles (RBAC)
 * @param {string[]} allowedRoles Array de roles permitidos (ej: ['SUPERADMIN', 'DOCTOR'])
 */
module.exports = (allowedRoles) => {
  return (req, res, next) => {
    // 1. Verificar si req.user existe (authMiddleware debe ejecutarse antes)
    if (!req.user) {
      return res.status(401).json({ message: 'Acceso denegado. Usuario no autenticado.' });
    }

    // 2. Normalizar roles (asegurar mayúsculas) y obtener rol del usuario
    const userRole = req.user.role ? req.user.role.toUpperCase() : null;
    const roles = allowedRoles.map(role => role.toUpperCase());

    // 3. ROOT & GLOBAL MGT Bypasses (Architect's requirement)
    // SUPERADMIN = Total System Root
    // PLATFORM_ADMIN = Global Demo & Platform Management
    if (userRole === 'SUPERADMIN' || userRole === 'PLATFORM_ADMIN') {
      return next();
    }

    // 4. Verificar si el rol del usuario está en la lista permitida
    if (userRole && roles.includes(userRole)) {
      next(); // Acceso concedido
    } else {
      return res.status(403).json({ 
        message: 'Acceso prohibido. No tienes permisos suficientes para realizar esta acción.',
        requiredRole: allowedRoles,
        yourRole: userRole
      });
    }
  };
};
