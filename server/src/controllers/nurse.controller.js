const { Nurse, User, Role, sequelize } = require('../models');

exports.getNurses = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';

    const whereClause = {};
    if (!isSuperAdmin && organizationId) {
      whereClause.organizationId = organizationId;
    }

    const nurses = await Nurse.findAll({ 
      where: whereClause,
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId', 'isActive'] }]
    });
    res.json(nurses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createNurse = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { organizationId } = req.user;
    const { firstName, lastName, email, phone, licenseNumber, shift, specialization, password } = req.body;

    if (!firstName || !lastName || !email || !licenseNumber) {
      await t.rollback();
      return res.status(400).json({ message: 'Nombre, apellido, correo y número de colegiatura son obligatorios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ where: { email: cleanEmail } });
    if (existingUser) {
      await t.rollback();
      return res.status(409).json({ message: `⚠️ Ya existe un usuario registrado con el correo ${email}. Se evitan registros duplicados.` });
    }

    const existingLicense = await Nurse.findOne({ where: { licenseNumber: licenseNumber.trim() } });
    if (existingLicense) {
      await t.rollback();
      return res.status(409).json({ message: `⚠️ Ya existe una enfermera registrada con la matrícula/licencia ${licenseNumber}.` });
    }

    const nurseRole = await Role.findOne({ where: { name: 'NURSE' } });

    const newUser = await User.create({
      username: cleanEmail.split('@')[0] + '_' + Date.now(),
      email: cleanEmail,
      password: password || 'Enfermeria123!',
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      roleId: nurseRole ? nurseRole.id : null,
      organizationId,
      phone: phone || null,
      isActive: true
    }, { transaction: t });

    const newNurse = await Nurse.create({
      userId: newUser.id,
      organizationId,
      licenseNumber: licenseNumber.trim(),
      shift: shift || 'Rotativo',
      specialization: specialization || 'Enfermería General',
      phone: phone || null
    }, { transaction: t });

    await t.commit();

    const populated = await Nurse.findByPk(newNurse.id, {
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'isActive'] }]
    });

    res.status(201).json(populated);
  } catch (error) {
    await t.rollback();
    console.error('Error in createNurse:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteNurse = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
    const { id } = req.params;
    
    const nurse = await Nurse.findByPk(id, { include: [User] });
    if (!nurse) return res.status(404).json({ message: 'Enfermera no encontrada' });

    if (!isSuperAdmin && nurse.User && nurse.User.organizationId !== organizationId) {
      return res.status(403).json({ message: 'No tienes permisos sobre esta enfermera' });
    }

    if (nurse.userId) {
      await User.destroy({ where: { id: nurse.userId } });
    }
    await nurse.destroy();
    res.json({ message: 'Enfermera eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
