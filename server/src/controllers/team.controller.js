const { User, Role, Organization, Doctor, Nurse, Staff, sequelize } = require('../models');
const bcrypt = require('bcryptjs');
const { generarPasswordTemporal } = require('./auth.controller');

exports.addMember = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { firstName, lastName, email, roleName, password, gender, licenseNumber, departmentId } = req.body;
    const organizationId = req.user.organizationId; 
    const org = await Organization.findByPk(organizationId);

    if (!organizationId || !org) {
      await t.rollback();
      return res.status(403).json({ message: 'No perteneces a una organización para añadir miembros.' });
    }

    // ENFORCE PLAN LIMITS
    if (roleName === 'DOCTOR') {
      const doctorRole = await Role.findOne({ where: { name: 'DOCTOR' } });
      const doctorCount = await User.count({ 
        where: { 
          organizationId, 
          roleId: doctorRole.id,
          subscriptionBypass: false // No cuentan para el límite los que tienen bypass (VIP)
        } 
      });

      if (org.type === 'PROFESSIONAL' && doctorCount >= 1) {
        await t.rollback();
        return res.status(403).json({ 
          message: 'Límite alcanzado: El plan Consultorio solo permite 1 médico. Por favor, actualiza tu plan.' 
        });
      }
      if (org.type === 'CLINIC' && doctorCount >= 10) {
        await t.rollback();
        return res.status(403).json({ 
          message: 'Límite alcanzado: El plan Clínica solo permite hasta 10 médicos. Por favor, actualiza tu plan.' 
        });
      }
    }

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      await t.rollback();
      return res.status(400).json({ message: 'El usuario ya existe con este correo.' });
    }

    // Get Role
    const role = await Role.findOne({ where: { name: roleName } });
    if (!role) {
      await t.rollback();
      return res.status(400).json({ message: 'Rol inválido.' });
    }

    // Generar o usar la contraseña proporcionada; siempre forzar cambio en primer ingreso
    const tempPass = password || generarPasswordTemporal();
    const isTemporary = !password;

    // Create User
    const newUser = await User.create({
      username: email.split('@')[0] + '_' + Date.now(), // Generate unique username
      email,
      password: tempPass,
      firstName,
      lastName,
      gender,
      roleId: role.id,
      organizationId,
      accountType: req.user.accountType, // Inherit account type context
      mustChangePassword: true,          // Obligar cambio de contraseña en primer ingreso
      temporaryPassword: isTemporary ? tempPass : null
    }, { transaction: t });

    // Create Profile based on Role
    if (roleName === 'DOCTOR') {
      await Doctor.create({
        userId: newUser.id,
        licenseNumber: licenseNumber || 'TEMP',
        specialtyId: req.body.specialtyId // Optional
      }, { transaction: t });
    } else if (roleName === 'NURSE') {
      await Nurse.create({
        userId: newUser.id,
        licenseNumber: licenseNumber || 'TEMP',
        departmentId
      }, { transaction: t });
    } else if (roleName === 'ADMINISTRATIVE') {
      await Staff.create({
        userId: newUser.id,
        departmentName: 'General'
      }, { transaction: t });
    }

    await t.commit();
    res.status(201).json({
      message: 'Miembro añadido con éxito. Se le ha generado una contraseña temporal.',
      user: { ...newUser.toJSON(), password: undefined },
      // Exponer contraseña temporal para que el admin la comunique al nuevo miembro
      temporaryPassword: isTemporary ? tempPass : undefined
    });

  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ message: 'Error al añadir miembro.' });
  }
};

exports.getTeam = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) return res.json([]);

    const members = await User.findAll({
      where: { organizationId },
      include: [Role],
      attributes: { exclude: ['password'] }
    });

    res.json(members);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el equipo.' });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const userToRemove = await User.findOne({ where: { id, organizationId } });

    if (!userToRemove) {
      return res.status(404).json({ message: 'Usuario no encontrado en tu equipo.' });
    }

    await userToRemove.destroy(); // Soft delete if paranoid is enabled, or hard delete
    res.json({ message: 'Usuario eliminado del equipo.' });

  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar usuario.' });
  }
};
