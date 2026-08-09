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
    const { username, email, password, firstName, lastName, role: bodyRole, roleName, patientData, businessName, accountType, licenseNumber, address, inviteToken, paymentId } = req.body;
    
    // Default to PATIENT for public registration
    let finalRoleName = bodyRole || roleName || 'PATIENT';
    const finalAccountType = accountType || 'PATIENT';

    // ROLES THAT REQUIRE INVITATION
    const restrictedRoles = ['SUPERADMIN', 'ADMIN', 'ADMINISTRATIVE', 'DOCTOR', 'NURSE'];
    const isRestrictedRole = restrictedRoles.includes(finalRoleName);
    
    // Verify invite token for restricted roles
    if (isRestrictedRole) {
      const validInviteTokens = {
        'super-admin-token': 'SUPERADMIN',
        'admin-token': 'ADMIN',
        'staff-token': 'ADMINISTRATIVE',
      };
      
      if (!inviteToken || !validInviteTokens[inviteToken]) {
        await t.rollback();
        return res.status(403).json({ 
          message: 'Registro no autorizado. Se requiere invitación para crear cuentas de personal.' 
        });
      }
      
      // Override role if valid token provided
      finalRoleName = validInviteTokens[inviteToken];
    }

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

    // Determine organization
    let organizationId = null;
    
    // For non-restricted roles (PATIENT), look for organizationId in body or create default
    if (!isRestrictedRole) {
      // Patients can be assigned to an organization via invite or register to a specific one
      if (patientData?.organizationId) {
        const org = await Organization.findByPk(patientData.organizationId);
        if (org) {
          organizationId = org.id;
        }
      }
    } else {
      // Restricted roles: must be invited by existing organization
      if (patientData?.organizationId) {
        organizationId = patientData.organizationId;
      }

      // Check Doctor quota limit for organization
      if (finalRoleName === 'DOCTOR' && organizationId) {
        const { PLAN_LIMITS } = require('../middlewares/quotaEnforcer.middleware');
        const org = await Organization.findByPk(organizationId);
        if (org) {
          const planType = org.type || 'PROFESSIONAL';
          const limits = PLAN_LIMITS[planType] || PLAN_LIMITS.PROFESSIONAL;
          if (limits.maxDoctors !== Infinity) {
            const DoctorModel = require('../models/Doctor');
            const currentCount = await DoctorModel.count({ where: { organizationId } });
            if (currentCount >= limits.maxDoctors) {
              await t.rollback();
              return res.status(403).json({
                error: 'UPGRADE_REQUIRED',
                message: `Has alcanzado el límite máximo de doctores (${limits.maxDoctors}) permitidos por tu plan ${planType}. Actualiza a un plan superior.`
              });
            }
          }
        }
      }
    }

    // Si se envía una contraseña, se usa. Si no, se genera una temporal.
    const finalPassword = password || generarPasswordTemporal();
    const isTemporary = !password;

    const user = await User.create({
      username,
      email,
      password: finalPassword,
      firstName,
      lastName,
      businessName,
      accountType: finalAccountType,
      roleId: role.id,
      organizationId,
      gender: patientData?.gender || req.body.gender,
      mustChangePassword: isTemporary,
      temporaryPassword: isTemporary ? finalPassword : null
    }, { transaction: t });


    // If registering as a patient, create patient record
    if (role.name === 'PATIENT' && patientData) {
      // Check if documentId already exists (global check - documentId should be unique)
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
        allergies: patientData.allergies,
        organizationId
      }, { transaction: t });
    }

    // Role-specific extensions
    if (finalAccountType === 'PROFESSIONAL' || finalRoleName === 'DOCTOR') {
      const Doctor = require('../models/Doctor');
      await Doctor.create({
        userId: user.id,
        licenseNumber: licenseNumber || 'TEMP-' + Date.now(),
        address: address,
        phone: req.body.phone,
        organizationId
      }, { transaction: t });
    }

    // Create Organization for business accounts (only if not already assigned)
    if (!organizationId && ['PROFESSIONAL', 'CLINIC', 'HOSPITAL'].includes(finalAccountType)) {
      const orgName = businessName || (finalAccountType === 'PROFESSIONAL' ? `${firstName} ${lastName}` : username);
      const newOrg = await Organization.create({
        name: orgName,
        type: finalAccountType,
        ownerId: user.id,
        subscriptionStatus: paymentId ? 'ACTIVE' : 'TRIAL',
        trialEndsAt: new Date(Date.now() + (paymentId ? 30 : 7) * 24 * 60 * 60 * 1000) 
      }, { transaction: t });

      // Link user to organization
      await user.update({ organizationId: newOrg.id }, { transaction: t });
      organizationId = newOrg.id;

      // Link existing payment if any
      if (paymentId) {
        const { Payment } = require('../models');
        await Payment.update({ organizationId: newOrg.id }, { where: { id: paymentId }, transaction: t });
      }
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
      const htmlContent = getWelcomeEmail(user.firstName, user.email, finalPassword, urlLogin);

      await sendEmail({
        email: user.email,
        subject: 'Bienvenido a Clinica SaaS - Tus accesos',
        message: `Hola ${user.firstName},\n\nTu cuenta ha sido creada exitosamente.\n\nUsuario: ${user.email}\nContraseña temporal: ${finalPassword}\n\nURL de acceso: ${urlLogin}`,
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
      temporaryPassword: finalPassword
    });
  } catch (error) {
    await t.rollback();
    console.error('Registration Error:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        message: 'Error de duplicación: ' + error.errors[0].message
      });
    }

    res.status(500).json({ 
      message: 'No se pudo completar el registro. Error interno del servidor.',
      debug_error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};

const log = (msg) => {
  console.log(`[AUTH] ${new Date().toISOString()} - ${msg}`);
};

exports.login = async (req, res) => {
  let { email, password } = req.body;

  try {
    // 1. Normalización de inputs (Robustez para el mundo real)
    email = email ? email.trim().toLowerCase() : '';
    // Eliminar espacios y CARACTERES INVISIBLES (Unicode zero-width)
    password = password ? password.trim().replace(/[\u200B-\u200D\uFEFF]/g, '') : '';

    console.log(`[LOGIN] Intento de acceso para: "${email}" (Longitud Password: ${password.length})`);
    log(`[LOGIN START] Request received for: ${email}`);

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }

    if (!process.env.JWT_SECRET) {
      log(`[CRITICAL] JWT_SECRET MISSING`);
      return res.status(500).json({ message: 'Error interno: JWT_SECRET no configurado.' });
    }

    // 2. Búsqueda insensible a mayúsculas (Case-insensitive)
    const user = await User.findOne({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('User.email')), email.toLowerCase()),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('User.username')), email.toLowerCase())
        ]
      },
      include: [Role, Organization]
    });

    if (!user) {
      console.log(`[LOGIN] Usuario no encontrado: ${email}`);
      return res.status(401).json({ message: 'Credenciales inválidas (Usuario no encontrado)' });
    }

    // 3. Diagnóstico de contraseña (Solo visible en logs de servidor)
    const storedHash = user.password || '';
    console.log(`[LOGIN DEBUG] Usuario hallado: ${user.email} (ID: ${user.id})`);
    console.log(`[LOGIN DEBUG] Longitud Hash: ${storedHash.length}, Empieza por: ${storedHash.substring(0, 4)}`);
    console.log(`[LOGIN DEBUG] Longitud Password Input: ${password.length}`);

    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.warn(`[LOGIN FAIL] Password mismatch para: ${email}`);
      return res.status(401).json({ message: 'Credenciales inválidas (Contraseña incorrecta)' });
    }

    console.log(`[LOGIN SUCCESS] Sesión iniciada para: ${user.email}`);

    log(`Password Match. Checking account status...`);
    
    if (user.isActive === false) {
      log(`[LOGIN FAIL] Account inactive for: ${email}`);
      return res.status(401).json({ message: 'Tu cuenta ha sido desactivada. Por favor, contacta al administrador.' });
    }

    if (user.twoFactorEnabled) {
      log(`[LOGIN 2FA REQUIRED] 2FA enabled for: ${email}`);
      const tempToken = jwt.sign(
        { id: user.id, role: user.Role.name, is2FAPending: true },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );
      return res.json({
        requires2FA: true,
        message: 'Se requiere código de verificación de 2FA',
        tempToken
      });
    }

    log(`Account active. Generating Token...`);

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
        subscriptionBypass: user.subscriptionBypass,
        mustChangePassword: user.mustChangePassword,
        twoFactorEnabled: user.twoFactorEnabled
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

    const message = `Hola ${user.firstName},\n\nHas solicitado restablecer tu contraseña en Clinica SaaS. Por favor, utiliza el siguiente enlace para crear una nueva clave:\n\n${resetUrl}\n\nEste enlace expirará en 1 hora por tu seguridad.\n\nSi no solicitaste este cambio, simplemente ignora este correo.\n\nSaludos,\nEquipo de Clinica SaaS.`;

    const sendEmail = require('../utils/sendEmail');
    const { getPasswordResetEmail } = require('../utils/emailTemplates');

    try {
      await sendEmail({
        email: user.email,
        subject: 'Recuperación de Contraseña - Clinica SaaS',
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
        message: `Hola ${user.firstName},\n\nTe informamos que la contraseña de tu cuenta en Clinica SaaS ha sido cambiada exitosamente.\n\nSi no realizaste este cambio, por favor contacta a soporte de inmediato.\n\nSaludos,\nEquipo de Clinica SaaS.`,
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
        message: `Hola ${user.firstName},\n\nTe informamos que la contraseña de tu cuenta en Clinica SaaS acaba de ser cambiada exitosamente.\n\nSi tú no realizaste este cambio, por favor contacta al administrador del sistema inmediatamente.\n\nSaludos,\nEquipo de Clinica SaaS.`,
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

const totp = require('../utils/totp.service');

exports.verify2FALogin = async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ message: 'Token temporal y código de 6 dígitos son requeridos' });
    }

    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!decoded || !decoded.is2FAPending) {
      return res.status(401).json({ message: 'Token temporal inválido o expirado' });
    }

    const user = await User.findByPk(decoded.id, { include: [Role, Organization] });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: 'El usuario no tiene 2FA activo' });
    }

    const isValid = totp.verifyTOTP(user.twoFactorSecret, code);
    if (!isValid) {
      return res.status(401).json({ message: 'Código de autenticación inválido o expirado' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.Role.name, mustChangePassword: user.mustChangePassword },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        businessName: user.businessName,
        accountType: user.accountType,
        role: user.Role.name,
        gender: user.gender,
        organizationId: user.organizationId,
        Organization: user.Organization,
        subscriptionBypass: user.subscriptionBypass,
        mustChangePassword: user.mustChangePassword,
        twoFactorEnabled: true
      }
    });
  } catch (error) {
    res.status(401).json({ message: 'Falló la verificación de 2FA', error: error.message });
  }
};

exports.setup2FA = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const secret = totp.generateSecret();
    const { otpauthUrl, qrImageUrl } = totp.getQRCodeUrl(user.email, secret);

    res.json({
      secret,
      otpauthUrl,
      qrImageUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al generar configuración de 2FA', error: error.message });
  }
};

exports.enable2FA = async (req, res) => {
  try {
    const { secret, code } = req.body;
    if (!secret || !code) {
      return res.status(400).json({ message: 'Se requiere la clave secreta y el código de verificación' });
    }

    const isValid = totp.verifyTOTP(secret, code);
    if (!isValid) {
      return res.status(400).json({ message: 'El código de 6 dígitos ingresado es incorrecto' });
    }

    const user = await User.findByPk(req.user.id);
    user.twoFactorEnabled = true;
    user.twoFactorSecret = secret;
    await user.save();

    res.json({ message: '✅ Autenticación de doble factor activada con éxito.', twoFactorEnabled: true });
  } catch (error) {
    res.status(500).json({ message: 'Error al activar 2FA', error: error.message });
  }
};

exports.disable2FA = async (req, res) => {
  try {
    const { code, password } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    let isAuthorized = false;
    if (code && user.twoFactorSecret) {
      isAuthorized = totp.verifyTOTP(user.twoFactorSecret, code);
    }
    if (!isAuthorized && password) {
      isAuthorized = await user.comparePassword(password);
    }

    if (!isAuthorized) {
      return res.status(401).json({ message: 'Código TOTP o contraseña incorrecta' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    await user.save();

    res.json({ message: 'Autenticación de doble factor desactivada.', twoFactorEnabled: false });
  } catch (error) {
    res.status(500).json({ message: 'Error al desactivar 2FA', error: error.message });
  }
};

// Exportar el helper para uso en otros controladores (e.g. team.controller)
exports.generarPasswordTemporal = generarPasswordTemporal;
