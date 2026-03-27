const { User, Role, Doctor, Nurse, Staff, Patient, Specialty } = require('../models');
const bcrypt = require('bcryptjs');

const TEST_PASSWORD = process.env.TEST_PASSWORD || 'ClinicaSaaS123'; // Dev fallback

const testUsers = [
  // Doctores
  {
    type: 'DOCTOR',
    username: 'dr.martinez',
    email: 'dr.martinez@clinicasaas.com',
    password: TEST_PASSWORD,
    firstName: 'Carlos',
    lastName: 'Martínez',
    phone: '+58412-1111111',
    profile: {
      licenseNumber: 'MED-001',
      specialtyName: 'Cardiología'
    }
  },
  {
    type: 'DOCTOR',
    username: 'dr.rodriguez',
    email: 'dr.rodriguez@clinicasaas.com',
    password: TEST_PASSWORD,
    firstName: 'Ana',
    lastName: 'Rodríguez',
    phone: '+58412-2222222',
    profile: {
      licenseNumber: 'MED-002',
      specialtyName: 'Pediatría'
    }
  },
  {
    type: 'DOCTOR',
    username: 'dr.lopez',
    email: 'dr.lopez@clinicasaas.com',
    password: TEST_PASSWORD,
    firstName: 'Miguel',
    lastName: 'López',
    phone: '+58412-3333333',
    profile: {
      licenseNumber: 'MED-003',
      specialtyName: 'Dermatología'
    }
  },
  
  // Enfermeras
  {
    type: 'NURSE',
    username: 'enf.garcia',
    email: 'enf.garcia@clinicasaas.com',
    password: TEST_PASSWORD,
    firstName: 'María',
    lastName: 'García',
    phone: '+58412-4444444',
    profile: {
      licenseNumber: 'ENF-001',
      specialization: 'Cuidados Intensivos',
      shift: 'Mañana'
    }
  },
  {
    type: 'NURSE',
    username: 'enf.fernandez',
    email: 'enf.fernandez@clinicasaas.com',
    password: TEST_PASSWORD,
    firstName: 'Laura',
    lastName: 'Fernández',
    phone: '+58412-5555555',
    profile: {
      licenseNumber: 'ENF-002',
      specialization: 'Pediatría',
      shift: 'Tarde'
    }
  },
  {
    type: 'NURSE',
    username: 'enf.torres',
    email: 'enf.torres@clinicasaas.com',
    password: TEST_PASSWORD,
    firstName: 'Carmen',
    lastName: 'Torres',
    phone: '+58412-6666666',
    profile: {
      licenseNumber: 'ENF-003',
      specialization: 'Emergencias',
      shift: 'Noche'
    }
  },
  
  // Personal Staff (ADMINISTRATIVE)
  {
    type: 'ADMINISTRATIVE',
    username: 'staff.ramirez',
    email: 'staff.ramirez@clinicasaas.com',
    password: TEST_PASSWORD,
    firstName: 'Pedro',
    lastName: 'Ramírez',
    phone: '+58412-7777777',
    profile: {
      employeeId: 'EMP-001',
      position: 'Recepcionista',
      departmentName: 'Recepción'
    }
  },
  {
    type: 'ADMINISTRATIVE',
    username: 'staff.morales',
    email: 'staff.morales@clinicasaas.com',
    password: TEST_PASSWORD,
    firstName: 'Sofía',
    lastName: 'Morales',
    phone: '+58412-8888888',
    profile: {
      employeeId: 'EMP-002',
      position: 'Contador',
      departmentName: 'Contabilidad'
    }
  },
  {
    type: 'ADMINISTRATIVE',
    username: 'staff.silva',
    email: 'staff.silva@clinicasaas.com',
    password: TEST_PASSWORD,
    firstName: 'Roberto',
    lastName: 'Silva',
    phone: '+58412-9999999',
    profile: {
      employeeId: 'EMP-003',
      position: 'Coordinador',
      departmentName: 'Administración'
    }
  },
  
  // Pacientes
  {
    type: 'PATIENT',
    username: 'pac.gonzalez',
    email: 'pac.gonzalez@email.com',
    password: TEST_PASSWORD,
    firstName: 'Juan',
    lastName: 'González',
    phone: '+58424-1111111',
    profile: {
      documentId: 'V-11111111',
      dateOfBirth: '1985-05-15',
      gender: 'Masculino',
      address: 'Av. Principal, Caracas',
      emergencyContact: 'María González - +58424-1111112'
    }
  },
  {
    type: 'PATIENT',
    username: 'pac.perez',
    email: 'pac.perez@email.com',
    password: TEST_PASSWORD,
    firstName: 'Elena',
    lastName: 'Pérez',
    phone: '+58424-2222222',
    profile: {
      documentId: 'V-22222222',
      dateOfBirth: '1990-08-22',
      gender: 'Femenino',
      address: 'Calle 5, Valencia',
      emergencyContact: 'Carlos Pérez - +58424-2222223'
    }
  },
  {
    type: 'PATIENT',
    username: 'pac.diaz',
    email: 'pac.diaz@email.com',
    password: TEST_PASSWORD,
    firstName: 'Luis',
    lastName: 'Díaz',
    phone: '+58424-3333333',
    profile: {
      documentId: 'V-33333333',
      dateOfBirth: '1978-12-10',
      gender: 'Masculino',
      address: 'Urb. Los Pinos, Maracay',
      emergencyContact: 'Ana Díaz - +58424-3333334'
    }
  }
];

async function createTestUsers() {
  const results = {
    created: [],
    existing: [],
    errors: []
  };

  console.log('🏥 Iniciando creación de usuarios de prueba...\n');

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      let user = await User.findOne({ where: { email: userData.email } });
      let isNewUser = false;
      
      if (user) {
        // Update existing user's password (hooks will handle hashing)
        user.password = userData.password;
        await user.save();
        
        results.existing.push({
          type: userData.type,
          name: `${userData.firstName} ${userData.lastName}`,
          email: userData.email,
          username: userData.username
        });
        console.log(`ℹ️  Actualizado password para: ${userData.email}`);
      } else {
        // Create user (hooks will handle hashing)
        user = await User.create({
          username: userData.username,
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          roleId: (await Role.findOne({ where: { name: userData.type } })).id
        });
        isNewUser = true;
      }

      if (isNewUser) {
          // Create profile based on type ONLY if new user (to avoid duplicates or errors if profile exists)
          // Ideally we should upsert profiles too, but for now let's assume if user exists, profile likely exists or we skip to avoid complexity
          // actually, the original code only created profile if user was created.
          
          if (userData.type === 'DOCTOR') {
            const specialty = await Specialty.findOne({ 
              where: { name: userData.profile.specialtyName } 
            });
            
            await Doctor.create({
              userId: user.id,
              licenseNumber: userData.profile.licenseNumber,
              specialtyId: specialty ? specialty.id : null
            });
          } else if (userData.type === 'NURSE') {
            await Nurse.create({
              userId: user.id,
              licenseNumber: userData.profile.licenseNumber,
              specialization: userData.profile.specialization,
              shift: userData.profile.shift
            });
          } else if (userData.type === 'ADMINISTRATIVE') {
            await Staff.create({
              userId: user.id,
              employeeId: userData.profile.employeeId,
              position: userData.profile.position,
              departmentName: userData.profile.departmentName
            });
          } else if (userData.type === 'PATIENT') {
            await Patient.create({
              userId: user.id,
              documentId: userData.profile.documentId,
              dateOfBirth: userData.profile.dateOfBirth,
              gender: userData.profile.gender,
              address: userData.profile.address,
              emergencyContact: userData.profile.emergencyContact
            });
          }

          results.created.push({
            type: userData.type,
            name: `${userData.firstName} ${userData.lastName}`,
            email: userData.email,
            username: userData.username,
            password: userData.password
          });
          console.log(`✅ Creado: ${userData.email}`);
      }
      
    } catch (error) {
      results.errors.push({
        email: userData.email,
        error: error.message
      });
      console.log(`❌ Error: ${userData.email} - ${error.message}`);
    }
  }

  // Print summary table
  console.log('\n' + '='.repeat(120));
  console.log('📊 RESUMEN DE USUARIOS DE PRUEBA');
  console.log('='.repeat(120) + '\n');

  if (results.created.length > 0) {
    console.log('✅ USUARIOS CREADOS:\n');
    console.log('┌─────────────┬──────────────────────┬────────────────────────────────┬─────────────────────┬──────────────┐');
    console.log('│ TIPO        │ NOMBRE               │ EMAIL                          │ USERNAME            │ PASSWORD     │');
    console.log('├─────────────┼──────────────────────┼────────────────────────────────┼─────────────────────┼──────────────┤');
    
    results.created.forEach(user => {
      console.log(
        `│ ${user.type.padEnd(11)} │ ${user.name.padEnd(20)} │ ${user.email.padEnd(30)} │ ${user.username.padEnd(19)} │ ${user.password.padEnd(12)} │`
      );
    });
    
    console.log('└─────────────┴──────────────────────┴────────────────────────────────┴─────────────────────┴──────────────┘\n');
  }

  if (results.existing.length > 0) {
    console.log('ℹ️  USUARIOS EXISTENTES (OMITIDOS):\n');
    console.log('┌─────────────┬──────────────────────┬────────────────────────────────┬─────────────────────┐');
    console.log('│ TIPO        │ NOMBRE               │ EMAIL                          │ USERNAME            │');
    console.log('├─────────────┼──────────────────────┼────────────────────────────────┼─────────────────────┤');
    
    results.existing.forEach(user => {
      console.log(
        `│ ${user.type.padEnd(11)} │ ${user.name.padEnd(20)} │ ${user.email.padEnd(30)} │ ${user.username.padEnd(19)} │`
      );
    });
    
    console.log('└─────────────┴──────────────────────┴────────────────────────────────┴─────────────────────┘\n');
  }

  if (results.errors.length > 0) {
    console.log('❌ ERRORES:\n');
    results.errors.forEach(err => {
      console.log(`   ${err.email}: ${err.error}`);
    });
    console.log('');
  }

  console.log('📈 ESTADÍSTICAS:');
  console.log(`   ✅ Creados: ${results.created.length}`);
  console.log(`   ℹ️  Existentes: ${results.existing.length}`);
  console.log(`   ❌ Errores: ${results.errors.length}`);
  console.log(`   📋 Total procesados: ${testUsers.length}\n`);

  console.log('🎉 ¡Proceso completado!\n');
  
  process.exit(0);
}

createTestUsers().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
