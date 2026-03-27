const { User, Role } = require('../models');
const bcrypt = require('bcryptjs');

async function fixPatientPassword() {
  try {
    console.log('🔍 Buscando usuario pac.gonzalez@email.com ...');
    
    // Buscar el usuario
    const user = await User.findOne({ 
      where: { email: 'pac.gonzalez@email.com' },
      include: [Role]
    });

    if (!user) {
      console.log('❌ El usuario NO existe. Creándolo ahora...');
      // Crear si no existe
      const patientRole = await Role.findOne({ where: { name: 'PATIENT' } });
      const newUser = await User.create({
        firstName: 'Juan',
        lastName: 'Gonzalez',
        username: 'juang',
        email: 'pac.gonzalez@email.com',
        password: process.env.TEST_PASSWORD || 'DevPassword123', // Warning: dev fallback
        roleId: patientRole.id
      });
      console.log(`✅ Usuario creado exitosamente.`);
    } else {
      console.log(`✅ Usuario encontrado (ID: ${user.id}, Rol: ${user.Role.name})`);
      console.log(`🔄 Restableciendo contraseña...`);
      
      // Forzar actualización de password
      user.password = process.env.TEST_PASSWORD || 'DevPassword123';
      await user.save(); // Esto disparará el hook de hasheo
      
      console.log('✅ Contraseña actualizada correctamente.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixPatientPassword();
