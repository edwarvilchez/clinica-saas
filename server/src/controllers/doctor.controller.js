const { Doctor, User, Specialty, Role, Employee, sequelize } = require('../models');

/**
 * Helper to calculate Venezuelan Medical Credential Expiry and Notification Windows:
 * - 30 days notice (1 month in advance)
 * - Weekly alerts (21 days, 14 days, 7 days)
 * - Expired status (< 0 days)
 */
function calculateCredentialStatus(expiryDate) {
  if (!expiryDate) {
    return {
      status: 'NOT_SET',
      daysRemaining: null,
      alertLevel: 'none',
      labelEs: 'Sin fecha de vigencia registrada',
      labelEn: 'No expiration date recorded',
      isExpired: false,
      isExpiringSoon: false
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      status: 'EXPIRED',
      daysRemaining,
      alertLevel: 'danger',
      labelEs: `Credencial Vencida (${Math.abs(daysRemaining)} días)`,
      labelEn: `Credentials Expired (${Math.abs(daysRemaining)} days ago)`,
      isExpired: true,
      isExpiringSoon: false
    };
  }
  if (daysRemaining <= 7) {
    return {
      status: 'CRITICAL_7_DAYS',
      daysRemaining,
      alertLevel: 'danger',
      labelEs: `Alerta Crítica: Vence en ${daysRemaining} día(s) (1 semana)`,
      labelEn: `Critical Alert: Expires in ${daysRemaining} day(s) (1 week)`,
      isExpired: false,
      isExpiringSoon: true
    };
  }
  if (daysRemaining <= 14) {
    return {
      status: 'WARNING_14_DAYS',
      daysRemaining,
      alertLevel: 'warning',
      labelEs: `Alerta: Vence en ${daysRemaining} días (2 semanas)`,
      labelEn: `Alert: Expires in ${daysRemaining} days (2 weeks)`,
      isExpired: false,
      isExpiringSoon: true
    };
  }
  if (daysRemaining <= 21) {
    return {
      status: 'WARNING_21_DAYS',
      daysRemaining,
      alertLevel: 'warning',
      labelEs: `Aviso Semanal: Vence en ${daysRemaining} días (3 semanas)`,
      labelEn: `Weekly Notice: Expires in ${daysRemaining} days (3 weeks)`,
      isExpired: false,
      isExpiringSoon: true
    };
  }
  if (daysRemaining <= 30) {
    return {
      status: 'NOTICE_30_DAYS',
      daysRemaining,
      alertLevel: 'info',
      labelEs: `Aviso Preventivo: Vence en ${daysRemaining} días (1 mes de anticipación)`,
      labelEn: `Advance Notice: Expires in ${daysRemaining} days (1 month in advance)`,
      isExpired: false,
      isExpiringSoon: true
    };
  }

  return {
    status: 'VALID',
    daysRemaining,
    alertLevel: 'success',
    labelEs: `Vigente (${daysRemaining} días)`,
    labelEn: `Valid (${daysRemaining} days)`,
    isExpired: false,
    isExpiringSoon: false
  };
}

exports.getDoctors = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN';

    const whereClause = {};
    if (!isSuperAdmin && organizationId) {
      whereClause.organizationId = organizationId;
    }

    const doctors = await Doctor.findAll({ 
      where: whereClause,
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId', 'isActive', 'subscriptionBypass'] }, 
        { model: Specialty }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Enrich with calculated credential status
    const formatted = doctors.map(doc => {
      const docJson = doc.toJSON();
      docJson.credentialStatus = calculateCredentialStatus(doc.credentialsExpiryDate);
      return docJson;
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCredentialAlerts = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN';

    const whereClause = {};
    if (!isSuperAdmin && organizationId) {
      whereClause.organizationId = organizationId;
    }

    const doctors = await Doctor.findAll({
      where: whereClause,
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'isActive'] },
        { model: Specialty }
      ]
    });

    const alerts = [];
    let expiredCount = 0;
    let critical7Count = 0;
    let warning14Count = 0;
    let warning21Count = 0;
    let notice30Count = 0;

    doctors.forEach(doc => {
      const status = calculateCredentialStatus(doc.credentialsExpiryDate);
      if (status.isExpired || status.isExpiringSoon) {
        alerts.push({
          doctorId: doc.id,
          doctorName: doc.User ? `Dr. ${doc.User.firstName} ${doc.User.lastName}` : 'Dr.',
          email: doc.User?.email,
          specialty: doc.Specialty?.name || 'General',
          mppsNumber: doc.mppsNumber,
          collegeNumber: doc.collegeNumber,
          credentialsExpiryDate: doc.credentialsExpiryDate,
          credentialStatus: status
        });

        if (status.status === 'EXPIRED') expiredCount++;
        else if (status.status === 'CRITICAL_7_DAYS') critical7Count++;
        else if (status.status === 'WARNING_14_DAYS') warning14Count++;
        else if (status.status === 'WARNING_21_DAYS') warning21Count++;
        else if (status.status === 'NOTICE_30_DAYS') notice30Count++;
      }
    });

    res.json({
      totalAlerts: alerts.length,
      summary: {
        expiredCount,
        critical7Count,
        warning14Count,
        warning21Count,
        notice30Count
      },
      alerts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createDoctor = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { organizationId } = req.user;
    const { 
      firstName, lastName, email, phone, password, 
      licenseNumber, specialtyId, additionalSpecialties,
      university, degreeTitle, mppsNumber, collegeNumber,
      credentialsIssueDate, credentialsExpiryDate,
      chargesProfessionalFees, address
    } = req.body;

    if (!email || !firstName || !lastName) {
      await t.rollback();
      return res.status(400).json({ message: 'Nombre, apellido y correo son obligatorios.' });
    }

    const existingUser = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (existingUser) {
      await t.rollback();
      return res.status(409).json({ message: `⚠️ Ya existe un usuario o médico registrado con el correo ${email}. Se evitan registros duplicados.` });
    }

    if (mppsNumber) {
      const existingMpps = await Doctor.findOne({ where: { mppsNumber: mppsNumber.trim() } });
      if (existingMpps) {
        await t.rollback();
        return res.status(409).json({ message: `⚠️ Ya existe un médico registrado con el Nro. de Matrícula MPPS ${mppsNumber}.` });
      }
    }

    const doctorRole = await Role.findOne({ where: { name: 'DOCTOR' } });
    if (!doctorRole) {
      await t.rollback();
      return res.status(400).json({ message: 'Rol DOCTOR no configurado en el sistema.' });
    }

    const newUser = await User.create({
      username: email.split('@')[0] + '_' + Date.now(),
      email,
      password: password || 'ClinicaSaaS123',
      firstName,
      lastName,
      organizationId,
      roleId: doctorRole.id,
      accountType: req.user.accountType || 'CLINIC',
      isActive: true
    }, { transaction: t });

    const newDoctor = await Doctor.create({
      userId: newUser.id,
      organizationId,
      phone: phone || null,
      address: address || null,
      licenseNumber: licenseNumber || `MPPS-${Date.now() % 100000}`,
      specialtyId: specialtyId ? parseInt(specialtyId) : null,
      additionalSpecialties: Array.isArray(additionalSpecialties) ? additionalSpecialties : [],
      university: university || null,
      degreeTitle: degreeTitle || 'Médico Cirujano',
      mppsNumber: mppsNumber || null,
      collegeNumber: collegeNumber || null,
      credentialsIssueDate: credentialsIssueDate || null,
      credentialsExpiryDate: credentialsExpiryDate || null,
      chargesProfessionalFees: chargesProfessionalFees !== undefined ? Boolean(chargesProfessionalFees) : true
    }, { transaction: t });

    // Sync with Employee (HR) if available
    try {
      const existingEmployee = await Employee.findOne({ where: { userId: newUser.id } });
      if (!existingEmployee) {
        await Employee.create({
          organizationId,
          userId: newUser.id,
          doctorId: newDoctor.id,
          employeeCode: `MED-${Date.now() % 10000}`,
          documentId: licenseNumber || `V-${Date.now() % 10000000}`,
          firstName,
          lastName,
          email,
          phone,
          jobTitle: degreeTitle || 'Médico Especialista',
          departmentId: null,
          specialtyId: specialtyId ? parseInt(specialtyId) : null,
          isDoctor: true,
          contractType: Boolean(chargesProfessionalFees) ? 'PROFESSIONAL_FEES' : 'FULL_TIME',
          baseSalaryUSD: 0,
          hireDate: credentialsIssueDate || new Date(),
          status: 'ACTIVE',
          medicalLicense: licenseNumber,
          address: address || null
        }, { transaction: t });
      }
    } catch (empErr) {
      console.warn('HR Employee sync warning:', empErr.message);
    }

    await t.commit();
    res.status(201).json({
      message: 'Doctor registrado exitosamente con credenciales y especialidades.',
      doctor: newDoctor
    });
  } catch (error) {
    await t.rollback();
    console.error('Error creating doctor:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateDoctor = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN';

    const doctor = await Doctor.findByPk(id, { include: [User] });
    if (!doctor) {
      await t.rollback();
      return res.status(404).json({ message: 'Doctor no encontrado.' });
    }

    if (!isSuperAdmin && doctor.organizationId !== organizationId) {
      await t.rollback();
      return res.status(403).json({ message: 'No tienes permisos para modificar este doctor.' });
    }

    const { 
      firstName, lastName, phone, address,
      licenseNumber, specialtyId, additionalSpecialties,
      university, degreeTitle, mppsNumber, collegeNumber,
      credentialsIssueDate, credentialsExpiryDate,
      chargesProfessionalFees
    } = req.body;

    if (doctor.User && (firstName || lastName)) {
      await doctor.User.update({
        firstName: firstName !== undefined ? firstName : doctor.User.firstName,
        lastName: lastName !== undefined ? lastName : doctor.User.lastName
      }, { transaction: t });
    }

    await doctor.update({
      phone: phone !== undefined ? phone : doctor.phone,
      address: address !== undefined ? address : doctor.address,
      licenseNumber: licenseNumber !== undefined ? licenseNumber : doctor.licenseNumber,
      specialtyId: specialtyId ? parseInt(specialtyId) : doctor.specialtyId,
      additionalSpecialties: additionalSpecialties !== undefined ? additionalSpecialties : doctor.additionalSpecialties,
      university: university !== undefined ? university : doctor.university,
      degreeTitle: degreeTitle !== undefined ? degreeTitle : doctor.degreeTitle,
      mppsNumber: mppsNumber !== undefined ? mppsNumber : doctor.mppsNumber,
      collegeNumber: collegeNumber !== undefined ? collegeNumber : doctor.collegeNumber,
      credentialsIssueDate: credentialsIssueDate !== undefined ? credentialsIssueDate : doctor.credentialsIssueDate,
      credentialsExpiryDate: credentialsExpiryDate !== undefined ? credentialsExpiryDate : doctor.credentialsExpiryDate,
      chargesProfessionalFees: chargesProfessionalFees !== undefined ? Boolean(chargesProfessionalFees) : doctor.chargesProfessionalFees
    }, { transaction: t });

    // Sync Employee record
    try {
      const employee = await Employee.findOne({ where: { doctorId: doctor.id } });
      if (employee) {
        await employee.update({
          firstName: firstName !== undefined ? firstName : employee.firstName,
          lastName: lastName !== undefined ? lastName : employee.lastName,
          phone: phone !== undefined ? phone : employee.phone,
          jobTitle: degreeTitle || employee.jobTitle,
          specialtyId: specialtyId ? parseInt(specialtyId) : employee.specialtyId,
          medicalLicense: licenseNumber !== undefined ? licenseNumber : employee.medicalLicense,
          contractType: (chargesProfessionalFees !== undefined ? Boolean(chargesProfessionalFees) : doctor.chargesProfessionalFees) ? 'PROFESSIONAL_FEES' : employee.contractType
        }, { transaction: t });
      }
    } catch (empErr) {
      console.warn('HR Employee update sync warning:', empErr.message);
    }

    await t.commit();
    res.json({
      message: 'Ficha del doctor actualizada exitosamente.',
      doctor
    });
  } catch (error) {
    await t.rollback();
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.toggleDoctorStatus = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN';
    const { id } = req.params;
    
    const doctor = await Doctor.findByPk(id, { 
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId', 'isActive'] }] 
    });
    
    if (!doctor || !doctor.User) {
      return res.status(404).json({ message: 'Doctor or associated user not found' });
    }

    if (!isSuperAdmin && doctor.User.organizationId !== organizationId) {
      return res.status(403).json({ message: 'No tienes permisos sobre este doctor' });
    }

    const newStatus = !doctor.User.isActive;
    await doctor.User.update({ isActive: newStatus });

    res.json({ 
      message: `Doctor ${newStatus ? 'activado' : 'desactivado'} con éxito`,
      isActive: newStatus 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteDoctor = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN';
    const { id } = req.params;
    
    const doctor = await Doctor.findByPk(id, { include: [User] });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    if (!isSuperAdmin && doctor.User.organizationId !== organizationId) {
      return res.status(403).json({ message: 'No tienes permisos sobre este doctor' });
    }

    await User.destroy({ where: { id: doctor.userId } });
    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.toggleDoctorBypass = async (req, res) => {
  try {
    const authorizedEmails = ['edwarvilchez1977@gmail.com', 'admin@clinicasaas.com'];
    if (!authorizedEmails.includes(req.user.email)) {
      return res.status(403).json({ message: 'No tienes permisos de nivel Fundador para esta acción.' });
    }

    const { id } = req.params;
    const doctor = await Doctor.findByPk(id, { include: [User] });
    
    if (!doctor || !doctor.User) {
      return res.status(404).json({ message: 'Doctor or associated user not found' });
    }

    const newBypass = !doctor.User.subscriptionBypass;
    await doctor.User.update({ subscriptionBypass: newBypass });

    res.json({ 
      message: `Bypass de suscripción ${newBypass ? 'activado' : 'desactivado'} con éxito`,
      subscriptionBypass: newBypass 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
