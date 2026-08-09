const { Organization, User, Role } = require('../models');

/**
 * Super Admin Controller for Platform Management
 */

// Emails autorizados para crear nuevos SUPERADMIN - Cargados desde variables de entorno
const ALLOWED_MASTER_EMAILS = process.env.ALLOWED_MASTER_EMAILS 
  ? process.env.ALLOWED_MASTER_EMAILS.split(',') 
  : ['edwarvilchez1977@gmail.com', 'edwarvilchez@gmail.com', 'cgk888digital@gmail.com'];

// List ALL organizations in the platform with stats
exports.getAllOrganizations = async (req, res) => {
  console.log('🔍 [Admin] Fetching all organizations...');
  try {
    const orgs = await Organization.findAll({
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'email', 'firstName', 'lastName']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Add counts for users/doctors manually or via subqueries if needed
    // For now, let's just return the organizations
    res.json(orgs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// List ALL users in the platform
exports.getAllUsers = async (req, res) => {
  try {
    const requestingUser = await User.findByPk(req.user.id, { include: [Role] });
    const isPlatformAdmin = requestingUser.Role.name === 'PLATFORM_ADMIN';

    const { Op } = require('sequelize');
    const where = {};
    
    // Platform Admins cannot see SuperAdmins
    if (isPlatformAdmin) {
      where['$Role.name$'] = { [Op.not]: 'SUPERADMIN' };
    }

    const users = await User.findAll({
      where,
      include: [Role, Organization],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Global Platform Statistics (Nomimus-inspired)
exports.getAdminDashboardStats = async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const now = new Date();

        const totalUsers = await User.count();
        const totalOrganizations = await Organization.count();
        
        const activeTrials = await Organization.count({ where: { subscriptionStatus: 'TRIAL', trialEndsAt: { [Op.gt]: now } } });
        const expiredTrials = await Organization.count({ where: { subscriptionStatus: 'TRIAL', trialEndsAt: { [Op.lte]: now } } });
        const activeSubscriptions = await Organization.count({ where: { subscriptionStatus: 'ACTIVE' } });
        
        // Urgency counts
        const expiringIn3Days = await Organization.count({
            where: {
                subscriptionStatus: 'TRIAL',
                trialEndsAt: {
                    [Op.and]: [
                        { [Op.gt]: now },
                        { [Op.lte]: new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000)) }
                    ]
                }
            }
        });

        res.json({
            users: { total: totalUsers },
            organizations: {
                total: totalOrganizations,
                activeTrials,
                expiredTrials,
                activeSubscriptions,
                expiringIn3Days
            },
            system: {
                version: '4.3.2',
                status: 'Healthy'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Organization status (for blocking/activating)
exports.updateOrganizationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscriptionStatus, trialEndsAt } = req.body;

    const org = await Organization.findByPk(id);
    if (!org) {
      return res.status(404).json({ message: 'Organización no encontrada' });
    }

    await org.update({
      subscriptionStatus: subscriptionStatus !== undefined ? subscriptionStatus : org.subscriptionStatus,
      trialEndsAt: trialEndsAt !== undefined ? trialEndsAt : org.trialEndsAt
    });

    res.json({ message: 'Organización actualizada correctamente', org });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle User Active status
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, { include: [Role] });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Protection: Platform Admins cannot modify SuperAdmins
    const requestingUser = await User.findByPk(req.user.id, { include: [Role] });
    if (requestingUser.Role.name === 'PLATFORM_ADMIN' && user.Role.name === 'SUPERADMIN') {
        return res.status(403).json({ message: 'No tienes permisos para modificar a un SuperAdministrador' });
    }

    await user.update({ isActive: !user.isActive });
    res.json({ message: `Usuario ${user.isActive ? 'activado' : 'bloqueado'}`, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle Subscription Bypass for User (Nomimus-inspired feature)
exports.toggleUserBypass = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, { include: [Role] });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Protection: Platform Admins cannot modify SuperAdmins
    const requestingUser = await User.findByPk(req.user.id, { include: [Role] });
    if (requestingUser.Role.name === 'PLATFORM_ADMIN' && user.Role.name === 'SUPERADMIN') {
        return res.status(403).json({ message: 'No tienes permisos para modificar a un SuperAdministrador' });
    }

    await user.update({ subscriptionBypass: !user.subscriptionBypass });
    res.json({ message: `Bypass de suscripción ${user.subscriptionBypass ? 'activado' : 'desactivado'} para el usuario`, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new SuperAdmin — solo permitido para los emails autorizados
exports.createSuperAdmin = async (req, res) => {
    try {
        const requestingUser = await User.findByPk(req.user.id, { attributes: ['email'] });
        if (!requestingUser || !ALLOWED_MASTER_EMAILS.includes(requestingUser.email)) {
            return res.status(403).json({ message: 'Solo los administradores maestros pueden crear nuevos SuperAdmins.' });
        }

        const { firstName, lastName, email, password } = req.body;

        // Ensure SUPERADMIN role exists
        let superRole = await Role.findOne({ where: { name: 'SUPERADMIN' } });
        if (!superRole) {
            console.log('Role SUPERADMIN not found, attempting to seed...');
            const seedRoles = require('../seeders/seeder');
            await seedRoles();
            superRole = await Role.findOne({ where: { name: 'SUPERADMIN' } });
        }
        
        if (!superRole) return res.status(500).json({ message: 'Error crítico: Rol SUPERADMIN no pudo ser inicializado. Ejecute el seeder manualmente.' });

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ message: 'El correo electrónico ya está registrado' });

        const user = await User.create({
            firstName,
            lastName,
            email,
            password,
            username: email,
            roleId: superRole.id,
            accountType: 'HOSPITAL',
            isActive: true,
            mustChangePassword: true
        });

        res.status(201).json({ message: 'SuperAdministrador creado con éxito', user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a new PlatformAdmin (vendedor) — solo SUPERADMIN puede hacerlo
exports.createPlatformAdmin = async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        // Ensure PLATFORM_ADMIN role exists
        let platformRole = await Role.findOne({ where: { name: 'PLATFORM_ADMIN' } });
        if (!platformRole) {
            console.log('Role PLATFORM_ADMIN not found, attempting to seed...');
            const seedRoles = require('../seeders/seeder');
            await seedRoles();
            platformRole = await Role.findOne({ where: { name: 'PLATFORM_ADMIN' } });
        }

        if (!platformRole) return res.status(500).json({ message: 'Error crítico: Rol PLATFORM_ADMIN no pudo ser inicializado. Ejecute el seeder manualmente.' });

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ message: 'El correo electrónico ya está registrado' });

        const user = await User.create({
            firstName,
            lastName,
            email,
            password,
            username: email,
            roleId: platformRole.id,
            accountType: 'HOSPITAL',
            isActive: true,
            mustChangePassword: true
        });

        res.status(201).json({ message: 'Administrador de plataforma creado con éxito', user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
