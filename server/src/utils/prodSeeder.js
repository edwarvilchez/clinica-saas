const { Role, User, Organization } = require('../models');

/**
 * Production Seeder
 * Seeds ONLY essential roles and the primary SuperAdmin.
 */
const seedProductionData = async () => {
  try {
    console.log('💎 Starting production data initialization...');

    // 1. Roles
    const roles = [
      { name: 'SUPERADMIN', description: 'Acceso total al sistema' },
      { name: 'DOCTOR', description: 'Médicos con historial y consultas' },
      { name: 'NURSE', description: 'Enfermería y toma de signos' },
      { name: 'RECEPTIONIST', description: 'Gestión de citas' },
      { name: 'ADMINISTRATIVE', description: 'Gestión administrativa' },
      { name: 'PATIENT', description: 'Pacientes del sistema' }
    ];

    const rolesMap = {};
    for (const r of roles) {
      const [role] = await Role.findOrCreate({
        where: { name: r.name },
        defaults: r
      });
      rolesMap[r.name] = role;
    }
    console.log('✅ Roles initialized.');

    // 2. Primary Admin (Edwar Vilchez)
    // We seed this user so the system is accessible after reset.
    const PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'ClinicaSaaS2026!';
    
    const [admin, created] = await User.findOrCreate({
      where: { email: 'edwarvilchez1977@gmail.com' },
      defaults: {
        username: 'admin.edwar',
        email: 'edwarvilchez1977@gmail.com',
        password: PASSWORD,
        firstName: 'Edwar',
        lastName: 'Vilchez',
        roleId: rolesMap['SUPERADMIN'].id,
        accountType: 'HOSPITAL',
        isActive: true,
        mustChangePassword: true  // Force password change on first login
      }
    });

    if (created) {
      // Create their main organization
      await Organization.create({
        name: 'Organización Principal Clínica SaaS',
        type: 'HOSPITAL',
        ownerId: admin.id,
        subscriptionStatus: 'ACTIVE'
      });
      console.log('✅ Primary SuperAdmin and Organization created.');
    } else {
      console.log('ℹ️ Primary Admin already exists.');
    }

    console.log('🚀 Production environment ready.');
  } catch (err) {
    console.error('❌ Error during production seeding:', err);
    throw err;
  }
};

module.exports = seedProductionData;
