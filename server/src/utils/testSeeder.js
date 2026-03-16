const { Role, User, Patient, Doctor, Nurse, Staff, Specialty, Department, Organization } = require('../models');

/**
 * Seed test users for ALL environments (dev + production).
 * Runs automatically on every server reset.
 *
 * Password convention:
 *   - All seed accounts use a single shared password:
 *     process.env.TEST_PASSWORD || 'Med1cus!2026'
 */

const SEED_PASSWORD = process.env.TEST_PASSWORD || 'Med1cus!2026';

const seedTestData = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // ── 1. Load all roles ──────────────────────────────────────────────
    const roles = {};
    const roleNames = ['SUPERADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'ADMINISTRATIVE', 'PATIENT'];

    for (const name of roleNames) {
      const [role] = await Role.findOrCreate({ 
        where: { name }, 
        defaults: { name, description: `Role for ${name}` } 
      });
      roles[name] = role;
    }

    // ── 2. Helper for User Creation ────────────────────────────────────
    const upsertUser = async (data) => {
      if (!roles[data.role]) return null;

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
          roleId: roles[data.role].id,
          organizationId: data.organizationId || null,
          gender: data.gender || null,
        },
      });

      if (!created) {
        await user.update({ 
          password: SEED_PASSWORD,
          roleId: roles[data.role].id,
          accountType: data.accountType || user.accountType,
          organizationId: data.organizationId || user.organizationId
        });
      }
      return user;
    };

    // ── 3. Helper for Organization Creation ────────────────────────────
    const createOrg = async (user, type, status = 'TRIAL') => {
      const orgName = user.businessName || `${user.firstName} ${user.lastName} Practice`;
      
      let trialEnds = null;
      if (status === 'TRIAL') {
        trialEnds = new Date();
        trialEnds.setDate(trialEnds.getDate() + 7); // 7 days from now
      } else if (status === 'EXPIRED') {
        trialEnds = new Date();
        trialEnds.setDate(trialEnds.getDate() - 1); // Yesterday
        status = 'TRIAL'; // It's a trial, but expired
      }

      const [org] = await Organization.findOrCreate({
        where: { ownerId: user.id },
        defaults: {
          name: orgName,
          type: type,
          ownerId: user.id,
          subscriptionStatus: status === 'EXPIRED' ? 'TRIAL' : status,
          trialEndsAt: trialEnds
        }
      });
      
      await user.update({ organizationId: org.id });
      return org;
    };

    // ── 4. Main Scenario: HOSPITAL (Active Subscription) ────────────────
    // This is the stable environment for happy-path testing
    const admin = await upsertUser({
      username: 'admin',
      email: 'edwarvilchez1977@gmail.com', // Primary Admin 1
      firstName: 'Edwar',
      lastName: 'Vilchez',
      role: 'SUPERADMIN',
      accountType: 'HOSPITAL',
      businessName: 'Hospital Central Medicus',
    });

    const admin2 = await upsertUser({
      username: 'medicus_admin',
      email: 'admin@medicus.com', // Primary Admin 2 (Classic)
      firstName: 'Admin',
      lastName: 'Medicus',
      role: 'SUPERADMIN',
      accountType: 'HOSPITAL',
      businessName: 'Hospital Central Medicus',
    });

    // Alias from Screenshot (if they typed this)
    await upsertUser({
      username: 'edwar.vilchez',
      email: 'edwarvilchez@medicus-app.com', 
      firstName: 'Edwar',
      lastName: 'Vilchez',
      role: 'SUPERADMIN',
      accountType: 'HOSPITAL',
      businessName: 'Hospital Central Medicus',
    });
    
    // Hospital is ACTIVE (Paid/Stable)
    const hospitalOrg = await createOrg(admin, 'HOSPITAL', 'ACTIVE');
    console.log(`🏥 Created ACTIVE Hospital: ${hospitalOrg.name}`);

    // ── 5. Scenario: CLINIC (Trial Active) ──────────────────────────────
    // To test the "7 days left" banner
    const clinicAdmin = await upsertUser({
      username: 'staff.mora',
      email: 'staff.mora@medicus.com',
      firstName: 'Ricardo',
      lastName: 'Mora',
      role: 'ADMINISTRATIVE',
      accountType: 'CLINIC',
      businessName: 'Clínica Salud Integral',
    });

    const clinicOrg = await createOrg(clinicAdmin, 'CLINIC', 'TRIAL');
    console.log(`🏥 Created TRIAL Clinic: ${clinicOrg.name}`);

    // ── 6. Scenario: PROFESSIONAL (Trial Expired) ───────────────────────
    // To test the blocking middleware and "Expired" banner
    const expiredDoc = await upsertUser({
      username: 'dr.cardenas',
      email: 'dr.cardenas@medicus.com',
      firstName: 'Andrés',
      lastName: 'Cárdenas',
      role: 'DOCTOR',
      accountType: 'PROFESSIONAL',
      gender: 'Male'
    });
    
    // Create professional profile
    await Doctor.findOrCreate({
      where: { userId: expiredDoc.id },
      defaults: { userId: expiredDoc.id, licenseNumber: 'MED-EXP-01', phone: '+58412-0000000' }
    });

    const proOrg = await createOrg(expiredDoc, 'PROFESSIONAL', 'EXPIRED');
    console.log(`👨‍⚕️ Created EXPIRED Professional: ${proOrg.name}`);


    // ── 7. Hospital Staff (Linked to ACTIVE Hospital) ──────────────────
    const hospitalStaff = [
      {
        username: 'dr.luna',
        email: 'dr.luna@medicus.com',
        firstName: 'Valeria',
        lastName: 'Luna',
        role: 'DOCTOR',
        accountType: 'HOSPITAL',
        organizationId: hospitalOrg.id,
        profile: { type: 'DOCTOR', license: 'MED-1002', specialty: 'Pediatría' }
      },
      {
        username: 'enf.rios',
        email: 'enf.rios@medicus.com',
        firstName: 'Carolina',
        lastName: 'Ríos',
        role: 'NURSE',
        accountType: 'HOSPITAL',
        organizationId: hospitalOrg.id,
        profile: { type: 'NURSE', license: 'ENF-2001', shift: 'Morning' }
      },
      {
        username: 'recep.vega',
        email: 'recep.vega@medicus.com',
        firstName: 'Isabel',
        lastName: 'Vega',
        role: 'RECEPTIONIST',
        accountType: 'HOSPITAL',
        organizationId: hospitalOrg.id,
        profile: { type: 'STAFF', employeeId: 'EMP-01', position: 'Receptionist' }
      }
    ];

    for (const data of hospitalStaff) {
      const user = await upsertUser(data);
      if (data.profile.type === 'DOCTOR') {
         // Create dept/specialty if needed
         const [dept] = await Department.findOrCreate({ where: { name: data.profile.specialty }, defaults: { name: data.profile.specialty }});
         const [spec] = await Specialty.findOrCreate({ where: { name: data.profile.specialty }, defaults: { name: data.profile.specialty, departmentId: dept.id }});
         await Doctor.findOrCreate({ 
           where: { userId: user.id }, 
           defaults: { userId: user.id, licenseNumber: data.profile.license, specialtyId: spec.id }
         });
      }
      // ... Add other profile creations as needed (Nurse, Staff) logic is same as before
    }

    // ── 8. PATIENTS (No Org) ───────────────────────────────────────────
    const patients = [
      {
        username: 'pac.torres',
        email: 'pac.torres@email.com',
        firstName: 'Miguel',
        lastName: 'Torres',
        role: 'PATIENT',
        accountType: 'PATIENT',
        gender: 'Male',
        profile: { documentId: 'V-12345678' }
      }
    ];

    for (const data of patients) {
      const user = await upsertUser(data);
      await Patient.findOrCreate({
        where: { userId: user.id },
        defaults: { userId: user.id, documentId: data.profile.documentId, gender: 'Male' }
      });
    }

    console.log(`\n✅ Database Seeded Successfully!`);
    console.log(`   🔑 Password for all accounts: ${SEED_PASSWORD}`);
    console.log(`   - admin@medicus.com (SUPERADMIN)`);
    console.log(`   - edwarvilchez1977@gmail.com (SUPERADMIN)`);
    console.log(`   - edwarvilchez@medicus-app.com (SUPERADMIN)`);
    console.log(`   - staff.mora@medicus.com (TRIAL Clinic - 7 days left)`);
    console.log(`   - dr.cardenas@medicus.com (EXPIRED Professional - blocked)`);
    console.log(`   - dr.luna@medicus.com (Doctor in Active Hospital)`);

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
  }
};

module.exports = seedTestData;
