const { User, Role, Patient, Organization, sequelize } = require('../models');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

/**
 * Genera una contraseña temporal que cumple con el patrón de seguridad:
 * mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número.
 * Formato: Med@ + 6 caracteres aleatorios (letras y números).
 * Ejemplo: Med@x7Rp2q
 */
const generarPasswordTemporal = () => {
  const chars = 'abcdefghijkmnopqrstuvwxyz';
  const nums = '23456789';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let resto = '';
  const all = chars + nums + upper;
  for (let i = 0; i < 6; i++) {
    resto += all.charAt(Math.floor(Math.random() * all.length));
  }
  // Garantizar al menos 1 mayúscula y 1 número adicionales en el sufijo
  return 'Med@' + resto;
};

exports.register = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { username, email, password, firstName, lastName, role: bodyRole, roleName, patientData, businessName, accountType, licenseNumber, address } = req.body;
    let finalRoleName = bodyRole || roleName || 'PATIENT';
    const finalAccountType = accountType || 'PATIENT';

    // Map account types to internal roles if necessary
    if (finalAccountType === 'PROFESSIONAL') finalRoleName = 'DOCTOR';
    if (finalAccountType === 'CLINIC' || finalAccountType === 'HOSPITAL') finalRoleName = 'ADMINISTRATIVE';

    // Check if user already exists to give a cleaner error before database constraint
    const existingUser = await User.findOne({ where: { [Op.or]: [{ email }, { username }] } });
    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      await t.rollback();
      return res.status(400).json({
        message: field === 'email' ? 'Este correo electrónico ya está registrado.' : 'Este nombre de usuario ya está en uso.'
      });
    }

    let role = await Role.findOne({ where: { name: finalRoleName } });
    if (!role) {
      await t.rollback();
      return res.status(400).json({ message: 'El rol especificado no es válido.' });
    }

    // Opción B: siempre generar contraseña temporal.
    // Se ignora cualquier password enviado desde el cliente.
    // El usuario DEBE cambiarla en su primer ingreso.
    const tempPassword = generarPasswordTemporal();

    const user = await User.create({
      username,
      email,
      password: tempPassword,
      firstName,
      lastName,
      businessName,
      accountType: finalAccountType,
      roleId: role.id,
      gender: patientData?.gender || req.body.gender,
      mustChangePassword: true,
      temporaryPassword: tempPassword  // Siempre se guarda la temporal
    }, { transaction: t });


    // If registering as a patient, create patient record
    if (role.name === 'PATIENT' && patientData) {
      // Check if documentId already exists
      const existingPatient = await Patient.findOne({ where: { documentId: patientData.documentId } });
      if (existingPatient) {
        await t.rollback();
        return res.status(400).json({ message: 'Esta cédula/documento ya está registrado en el sistema.' });
      }

      await Patient.create({
        userId: user.id,
        documentId: patientData.documentId,
        phone: patientData.phone,
        birthDate: patientData.birthDate,
        gender: patientData.gender,
        address: patientData.address,
        bloodType: patientData.bloodType,
        allergies: patientData.allergies
      }, { transaction: t });
    }

    // Role-specific extensions
    if (finalAccountType === 'PROFESSIONAL' || finalRoleName === 'DOCTOR') {
      const Doctor = require('../models/Doctor');
      await Doctor.create({
        userId: user.id,
        licenseNumber: licenseNumber || 'TEMP-' + Date.now(),
        address: address,
        phone: req.body.phone
      }, { transaction: t });
    }

    // Create Organization for business accounts
    if (['PROFESSIONAL', 'CLINIC', 'HOSPITAL'].includes(finalAccountType)) {
      const orgName = businessName || (finalAccountType === 'PROFESSIONAL' ? `${firstName} ${lastName}` : username);
      const newOrg = await Organization.create({
        name: orgName,
        type: finalAccountType,
        ownerId: user.id,
        subscriptionStatus: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days trial
      }, { transaction: t });

      // Link user to organization
      await user.update({ organizationId: newOrg.id }, { transaction: t });

      // Update returned user object
      user.organizationId = newOrg.id;
    }

    await t.commit();

    const token = jwt.sign(
      { id: user.id, role: role.name, mustChangePassword: true },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Enviar correo de bienvenida con contraseña temporal
    const sendEmail = require('../utils/sendEmail');
    const { getWelcomeEmail } = require('../utils/emailTemplates');
    try {
      const urlLogin = `${process.env.CLIENT_URL || 'http://localhost:4200'}/login`;
      const htmlContent = getWelcomeEmail(user.firstName, user.email, tempPassword, urlLogin);

      await sendEmail({
        email: user.email,
        subject: 'Bienvenido a Medicus - Tus accesos',
        message: `Hola ${user.firstName},\n\nTu cuenta ha sido creada exitosamente.\n\nUsuario: ${user.email}\nContraseña temporal: ${tempPassword}\n\nURL de acceso: ${urlLogin}`,
        html: htmlContent
      });
    } catch (emailError) {
      console.error('Error al enviar correo de bienvenida:', emailError.message);
    }

    res.status(201).json({
      message: 'Cuenta creada con éxito. Se ha enviado un correo con tu contraseña temporal.',
      token,
      user: {
        id: user.id,
        username,
        email,
        firstName,
        lastName,
        businessName,
        accountType: user.accountType,
        role: role.name,
        gender: user.gender,
        mustChangePassword: true
      },
      // En modo desarrollo se expone la contraseña temporal para facilitar las pruebas
      ...(process.env.NODE_ENV !== 'production' && { temporaryPassword: tempPassword })
    });
  } catch (error) {
    await t.rollback();
    console.error('Registration Error:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        message: 'Error de duplicación: ' + error.errors[0].message
      });
    }

    res.status(500).json({ message: 'No se pudo completar el registro. Error interno del servidor.' });
  }
};

const fs = require('fs');
const path = require('path');
const logFile = path.resolve(__dirname, '../../login_debug.log');

const log = (msg) => {
  try {
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${msg}\n`);
  } catch (e) {
    console.error('LOGGING FAILED:', e);
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log(`[LOGIN DEBUG] Email received: "${email}"`);
    log(`[LOGIN START] Request received for: ${email}`);


    // Explicitly check env var
    if (!process.env.JWT_SECRET) {
      log(`[CRITICAL] JWT_SECRET MISSING`);
      return res.status(500).json({ message: 'Error interno: JWT_SECRET no configurado.' });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: email },
          { username: email }
        ]
      },
      include: [
        Role,
        Organization
      ]
    });

    if (!user) {
      log(`[LOGIN FAIL] User not found: ${email}`);
      return res.status(401).json({ message: 'Credenciales inválidas (Usuario no encontrado)' });
    }

    log(`User Found: ID=${user.id}, Role=${user.Role ? user.Role.name : 'NULL'}`);

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      log(`[LOGIN FAIL] Password mismatch for: ${email}`);
      return res.status(401).json({ message: 'Credenciales inválidas (Contraseña incorrecta)' });
    }

    log(`Password Match. Generating Token...`);

    // Incluir mustChangePassword en el token JWT para que el guard del frontend pueda verificarlo
    const token = jwt.sign(
      { id: user.id, role: user.Role.name, mustChangePassword: user.mustChangePassword },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    log(`Token Generated. Sending Response.`);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email,
        firstName: user.firstName,
        lastName: user.lastName,
        businessName: user.businessName,
        accountType: user.accountType,
        role: user.Role.name,
        gender: user.gender,
        organizationId: user.organizationId,
        Organization: user.Organization,
        mustChangePassword: user.mustChangePassword  // Exponer flag al frontend
      }
    });
  } catch (error) {
    log(`[LOGIN EXCEPTION] ${error.message} \nStack: ${error.stack}`);
    console.error('[LOGIN ERROR]', error);
    res.status(500).json({ message: 'Error interno del servidor: ' + error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [Role, Organization],
      attributes: { exclude: ['password'] }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'No existe un usuario con ese email' });
    }

    // Generate random token
    const crypto = require('crypto');
    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await user.update({
      resetToken: token,
      resetExpires: expires
    });

    // Create reset URL
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:4200';
    const resetUrl = `${clientUrl}/reset-password/${token}`;

    const message = `Hola ${user.firstName},\n\nHas solicitado restablecer tu contraseña en Medicus. Por favor, utiliza el siguiente enlace para crear una nueva clave:\n\n${resetUrl}\n\nEste enlace expirará en 1 hora por tu seguridad.\n\nSi no solicitaste este cambio, simplemente ignora este correo.\n\nSaludos,\nEquipo de Medicus.`;

    const sendEmail = require('../utils/sendEmail');
    const { getPasswordResetEmail } = require('../utils/emailTemplates');

    try {
      await sendEmail({
        email: user.email,
        subject: 'Recuperación de Contraseña - Medicus',
        message: message,
        html: getPasswordResetEmail(user.firstName, resetUrl)
      });

      res.status(200).json({
        success: true,
        message: 'Correo de recuperación enviado',
        debugToken: process.env.NODE_ENV !== 'production' ? token : undefined
      });
    } catch (emailError) {
      console.error('Email send error:', emailError);

      if (process.env.NODE_ENV !== 'production') {
        return res.status(200).json({
          success: true,
          message: 'Error al enviar email (modo desarrollo), pero el token fue generado.',
          debugToken: token
        });
      }

      // If email fails in production, clear the token fields
      await user.update({
        resetToken: null,
        resetExpires: null
      });
      return res.status(500).json({ error: 'Hubo un error enviando el correo. Intenta de nuevo más tarde.' });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const { Op } = require('sequelize');

    const user = await User.findOne({
      where: {
        resetToken: token,
        resetExpires: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    console.log(`[RESET PASSWORD] Token valid for user: ${user.email}`);
    
    user.password = password;
    user.resetToken = null;
    user.resetExpires = null;
    user.mustChangePassword = false;
    user.temporaryPassword = null;
    
    await user.save();
    console.log(`[RESET PASSWORD] Success for: ${user.email}`);

    // Send confirmation email
    const sendEmail = require('../utils/sendEmail');
    const { getPasswordChangedEmail } = require('../utils/emailTemplates');
    try {
      await sendEmail({
        email: user.email,
        subject: 'Actualización de Seguridad - Cambio de Contraseña',
        message: `Hola ${user.firstName},\n\nTe informamos que la contraseña de tu cuenta en Medicus ha sido cambiada exitosamente.\n\nSi no realizaste este cambio, por favor contacta a soporte de inmediato.\n\nSaludos,\nEquipo de Medicus.`,
        html: getPasswordChangedEmail(user.firstName)
      });
    } catch (emailError) {
      console.error('Confirmation email failed:', emailError.message);
      // We don't block the response if confirmation email fails
    }

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
    }

    // Actualizar contraseña y desactivar el flag de cambio obligatorio
    console.log(`[CHANGE PASSWORD] Changing password for user: ${user.email}`);
    
    user.password = newPassword;
    user.mustChangePassword = false;
    user.temporaryPassword = null;
    
    await user.save();
    console.log(`[CHANGE PASSWORD] Success for: ${user.email}`);

    // Enviar correo de notificación del cambio de contraseña
    const sendEmail = require('../utils/sendEmail');
    const { getPasswordChangedEmail } = require('../utils/emailTemplates');
    try {
      await sendEmail({
        email: user.email,
        subject: 'Actualización de Seguridad - Cambio de Contraseña',
        message: `Hola ${user.firstName},\n\nTe informamos que la contraseña de tu cuenta en Medicus acaba de ser cambiada exitosamente.\n\nSi tú no realizaste este cambio, por favor contacta al administrador del sistema inmediatamente.\n\nSaludos,\nEquipo de Medicus.`,
        html: getPasswordChangedEmail(user.firstName)
      });
    } catch (emailError) {
      console.error('Error al enviar correo de cambio de contraseña:', emailError.message);
    }

    res.json({
      message: '✅ Contraseña actualizada exitosamente. Tu cuenta está completamente configurada.',
      mustChangePassword: false
    });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ message: 'Error al cambiar la contraseña' });
  }
};

// Exportar el helper para uso en otros controladores (e.g. team.controller)
exports.generarPasswordTemporal = generarPasswordTemporal;
