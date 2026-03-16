const { User } = require('./src/models');
const bcrypt = require('bcryptjs');

async function fixPassword() {
  try {
    const email = 'edwarvilchez1977@gmail.com';
    const newPassword = 'Med1cus!2026';
    
    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log('Usuario no encontrado');
      process.exit(1);
    }
    
    user.password = newPassword;
    await user.save();
    
    console.log(`✅ Contraseña actualizada para ${email}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixPassword();
