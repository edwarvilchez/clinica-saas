const { Role, User, Organization } = require('../models');

const SEED_PASSWORD = process.env.TEST_PASSWORD || 'ClinicaSaaS123';

const seedCleanData = async () => {
  try {
    console.log('🌱 Starting CLEAN database seeding...');

    // 1. Roles
    const roles = {};
    const roleNames = ['SUPERADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'ADMINISTRATIVE', 'PATIENT'];

    for (const name of roleNames) {
      const [role] = await Role.findOrCreate({ 
        where: { name }, 
        defaults: { name, description: `Role for ${name}` } 
      });
      roles[name] = role;
    }

    // 2. Primary Admin (User)
    const [admin] = await User.findOrCreate({
      where: { email: 'edwarvilchez1977@gmail.com' },
      defaults: {
        username: 'edwar.vilchez',
        email: 'edwarvilchez1977@gmail.com',
        password: SEED_PASSWORD,
        firstName: 'Edwar',
        lastName: 'Vilchez',
        accountType: 'HOSPITAL',
        roleId: roles['SUPERADMIN'].id,
        mustChangePassword: true
      }
    });

    // 3. Primary Organization
    const [org] = await Organization.findOrCreate({
      where: { ownerId: admin.id },
      defaults: {
        name: 'Sede Central Clínica SaaS',
        type: 'HOSPITAL',
        ownerId: admin.id,
        subscriptionStatus: 'ACTIVE'
      }
    });

    await admin.update({ organizationId: org.id });

    console.log('✅ Clean state initialized. Only 1 Global Admin created.');
  } catch (error) {
    console.error('❌ Error seeding clean data:', error);
    throw error;
  }
};

module.exports = seedCleanData;
