const { Role, User, Patient, Doctor, Nurse, Staff, Specialty, Department, Organization } = require('../models');

const SEED_PASSWORD = process.env.TEST_PASSWORD || 'ClinicaSaaS123';

const seedAllProfiles = async () => {
  try {
    console.log('🌱 Creating comprehensive test users for ALL roles & profiles...');

    // 1. Roles Definition
    const rolesList = [
      { name: 'SUPERADMIN', description: 'Acceso total al sistema y configuración global' },
      { name: 'PLATFORM_ADMIN', description: 'Consola Maestro (Ventas y gestión de cuentas SaaS)' },
      { name: 'DOCTOR', description: 'Médicos con atención clínica, recetas y videoconsultas' },
      { name: 'NURSE', description: 'Personal de enfermería y triaje de signos vitales' },
      { name: 'RECEPTIONIST', description: 'Recepción y control de agenda de citas' },
      { name: 'ADMINISTRATIVE', description: 'Administrador de clínica y gestión financiera' },
      { name: 'PATIENT', description: 'Pacientes con acceso a mis citas y resultados' }
    ];

    const rolesMap = {};
    for (const r of rolesList) {
      const [role] = await Role.findOrCreate({
        where: { name: r.name },
        defaults: r
      });
      rolesMap[r.name] = role;
    }

    // 2. Specialty & Department
    const [dept] = await Department.findOrCreate({
      where: { name: 'Medicina General' },
      defaults: { name: 'Medicina General' }
    });
    const [cardioDept] = await Department.findOrCreate({
      where: { name: 'Cardiología' },
      defaults: { name: 'Cardiología' }
    });

    const [specGeneral] = await Specialty.findOrCreate({
      where: { name: 'Medicina General' },
      defaults: { name: 'Medicina General', departmentId: dept.id }
    });
    const [specCardio] = await Specialty.findOrCreate({
      where: { name: 'Cardiología' },
      defaults: { name: 'Cardiología', departmentId: cardioDept.id }
    });

    // 3. Helper for Upsert User
    const createTestUser = async (data) => {
      const [user, created] = await User.findOrCreate({
        where: { email: data.email },
        defaults: {
          username: data.username,
          email: data.email,
          password: SEED_PASSWORD,
          firstName: data.firstName,
          lastName: data.lastName,
          businessName: data.businessName || null,
          accountType: data.accountType || 'PATIENT',
          roleId: rolesMap[data.role].id,
          organizationId: data.organizationId || null,
          gender: data.gender || 'Male',
          isActive: true,
          mustChangePassword: false
        }
      });

      if (!created) {
        await user.update({
          password: SEED_PASSWORD,
          roleId: rolesMap[data.role].id,
          organizationId: data.organizationId || user.organizationId,
          mustChangePassword: false
        });
      }
      return user;
    };

    // 4. Create SuperAdmin user first to act as Org Owner
    const superAdmin = await createTestUser({
      username: 'superadmin.demo',
      email: 'superadmin@clinicasaas.com',
      firstName: 'Edwar',
      lastName: 'SuperAdmin',
      role: 'SUPERADMIN',
      accountType: 'HOSPITAL'
    });

    const [mainOrg] = await Organization.findOrCreate({
      where: { name: 'Hospital Central MedicalCare 888' },
      defaults: {
        name: 'Hospital Central MedicalCare 888',
        type: 'HOSPITAL',
        subscriptionStatus: 'ACTIVE',
        ownerId: superAdmin.id
      }
    });

    const [clinicOrg] = await Organization.findOrCreate({
      where: { name: 'Clínica Salud Integral' },
      defaults: {
        name: 'Clínica Salud Integral',
        type: 'CLINIC',
        subscriptionStatus: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 3600000),
        ownerId: superAdmin.id
      }
    });

    await superAdmin.update({ organizationId: mainOrg.id });

    // ── PLATFORM ADMIN (Consola Maestro / Ventas)
    await createTestUser({
      username: 'platform.admin',
      email: 'platformadmin@clinicasaas.com',
      firstName: 'Gabriel',
      lastName: 'Maestro',
      role: 'PLATFORM_ADMIN',
      accountType: 'HOSPITAL',
      organizationId: mainOrg.id
    });

    // ── DOCTOR (Medicina General)
    const docGeneral = await createTestUser({
      username: 'dr.mendoza',
      email: 'dr.mendoza@clinicasaas.com',
      firstName: 'Carlos',
      lastName: 'Mendoza',
      role: 'DOCTOR',
      accountType: 'HOSPITAL',
      organizationId: mainOrg.id,
      gender: 'Male'
    });
    await Doctor.findOrCreate({
      where: { userId: docGeneral.id },
      defaults: {
        userId: docGeneral.id,
        licenseNumber: 'MP-998811',
        specialtyId: specGeneral.id,
        phone: '+58412-1000001',
        organizationId: mainOrg.id
      }
    });

    // ── DOCTOR (Cardiología)
    const docCardio = await createTestUser({
      username: 'dra.suarez',
      email: 'dra.suarez@clinicasaas.com',
      firstName: 'María',
      lastName: 'Suárez',
      role: 'DOCTOR',
      accountType: 'CLINIC',
      organizationId: clinicOrg.id,
      gender: 'Female'
    });
    await Doctor.findOrCreate({
      where: { userId: docCardio.id },
      defaults: {
        userId: docCardio.id,
        licenseNumber: 'MP-772244',
        specialtyId: specCardio.id,
        phone: '+58412-1000002',
        organizationId: clinicOrg.id
      }
    });

    // ── NURSE (Enfermería)
    const nurse = await createTestUser({
      username: 'enfermera.lopez',
      email: 'enfermera.lopez@clinicasaas.com',
      firstName: 'Ana',
      lastName: 'López',
      role: 'NURSE',
      accountType: 'HOSPITAL',
      organizationId: mainOrg.id,
      gender: 'Female'
    });
    await Nurse.findOrCreate({
      where: { userId: nurse.id },
      defaults: {
        userId: nurse.id,
        specialization: 'Triaje e Intensivismo',
        shift: 'Morning',
        organizationId: mainOrg.id
      }
    });

    // ── RECEPTIONIST (Recepción)
    const receptionist = await createTestUser({
      username: 'recepcion.gomez',
      email: 'recepcion.gomez@clinicasaas.com',
      firstName: 'Lucía',
      lastName: 'Gómez',
      role: 'RECEPTIONIST',
      accountType: 'HOSPITAL',
      organizationId: mainOrg.id,
      gender: 'Female'
    });
    await Staff.findOrCreate({
      where: { userId: receptionist.id },
      defaults: {
        userId: receptionist.id,
        employeeId: 'EMP-REC-01',
        position: 'Recepcionista Principal',
        organizationId: mainOrg.id
      }
    });

    // ── ADMINISTRATIVE (Gestión Administrativa)
    const adminStaff = await createTestUser({
      username: 'admin.gerencia',
      email: 'admin.gerencia@clinicasaas.com',
      firstName: 'Roberto',
      lastName: 'Fernández',
      role: 'ADMINISTRATIVE',
      accountType: 'HOSPITAL',
      organizationId: mainOrg.id,
      gender: 'Male'
    });
    await Staff.findOrCreate({
      where: { userId: adminStaff.id },
      defaults: {
        userId: adminStaff.id,
        employeeId: 'EMP-ADM-01',
        position: 'Gerente Administrativo',
        organizationId: mainOrg.id
      }
    });

    // ── PATIENT (Paciente)
    const patientUser = await createTestUser({
      username: 'paciente.martinez',
      email: 'paciente.martinez@clinicasaas.com',
      firstName: 'José',
      lastName: 'Martínez',
      role: 'PATIENT',
      accountType: 'PATIENT',
      organizationId: mainOrg.id,
      gender: 'Male'
    });
    await Patient.findOrCreate({
      where: { userId: patientUser.id },
      defaults: {
        userId: patientUser.id,
        documentId: 'V-19876543',
        phone: '+58414-9998877',
        bloodType: 'O+',
        allergies: 'Penicilina',
        organizationId: mainOrg.id
      }
    });

    console.log('\n🎉 ALL ROLE PROFILES CREATED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Error seeding all profiles:', error);
  }
};

module.exports = seedAllProfiles;
