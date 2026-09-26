const { Patient, User, Role, InsuranceCompany, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Clean document helper: removes dots, commas, hyphens, slashes, spaces.
 */
function cleanDocNumber(val) {
  if (!val) return '';
  return String(val).replace(/[^0-9]/g, '');
}

function cleanDocString(prefix, num) {
  const cleanP = (prefix || 'V').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanN = cleanDocNumber(num);
  return `${cleanP}${cleanN}`;
}

exports.getPatients = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { search } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    let userWhere = {};
    let patientWhere = {};

    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
    
    if (!isSuperAdmin && organizationId) {
      patientWhere.organizationId = organizationId;
    }

    if (search) {
      const s = search.trim();
      patientWhere[Op.or] = [
        { documentId: { [Op.iLike]: `%${s}%` } },
        { medicalRecordNumber: { [Op.iLike]: `%${s}%` } },
        { phone: { [Op.iLike]: `%${s}%` } },
        { '$User.firstName$': { [Op.iLike]: `%${s}%` } },
        { '$User.lastName$': { [Op.iLike]: `%${s}%` } },
        { '$User.email$': { [Op.iLike]: `%${s}%` } }
      ];
    }

    const { count, rows } = await Patient.findAndCountAll({
      where: patientWhere,
      limit,
      offset,
      include: [
        {
          model: User,
          where: userWhere,
          attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId', 'isActive']
        },
        {
          model: InsuranceCompany,
          attributes: ['id', 'name', 'rif', 'phone']
        }
      ],
      order: [['createdAt', 'DESC']],
      distinct: true
    });

    res.json({
      patients: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';

    const patient = await Patient.findByPk(id, {
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'organizationId', 'isActive'] },
        { model: InsuranceCompany }
      ]
    });
    if (!patient) return res.status(404).json({ message: 'Paciente no encontrado' });

    if (!isSuperAdmin && organizationId) {
      if (patient.organizationId && patient.organizationId !== organizationId && patient.User?.organizationId && patient.User.organizationId !== organizationId) {
        return res.status(403).json({ message: 'No tienes permisos para acceder a los datos de este paciente' });
      }
    }

    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPatientByMedicalRecord = async (req, res) => {
  try {
    const { recordNumber } = req.params;
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';

    const patient = await Patient.findOne({
      where: {
        [Op.or]: [
          { medicalRecordNumber: recordNumber },
          { documentId: recordNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase() }
        ]
      },
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'organizationId'] },
        { model: InsuranceCompany }
      ]
    });
    if (!patient) return res.status(404).json({ message: 'Paciente no encontrado con esa Historia Médica o Documento' });

    if (!isSuperAdmin && organizationId) {
      if (patient.organizationId && patient.organizationId !== organizationId && patient.User?.organizationId && patient.User.organizationId !== organizationId) {
        return res.status(403).json({ message: 'No tienes permisos para acceder a los datos de este paciente' });
      }
    }

    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPatientByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';

    const patient = await Patient.findOne({
      where: { userId },
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'organizationId', 'isActive'] },
        { model: InsuranceCompany }
      ]
    });
    if (!patient) return res.status(404).json({ message: 'Paciente no encontrado para este usuario' });

    if (!isSuperAdmin && organizationId) {
      if (patient.organizationId && patient.organizationId !== organizationId && patient.User?.organizationId && patient.User.organizationId !== organizationId) {
        return res.status(403).json({ message: 'No tienes permisos para acceder a los datos de este paciente' });
      }
    }

    res.json(patient);
  } catch (error) {
    console.error('Error fetching patient by userId:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createPatient = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { organizationId } = req.user;
    const {
      firstName,
      lastName,
      email,
      password,
      documentType = 'CEDULA',
      documentPrefix = 'V',
      documentNumber,
      birthDate,
      gender = 'Other',
      phone,
      state,
      city,
      municipality,
      address,
      bloodType,
      allergies,
      hasInsurance = false,
      insuranceCompanyId,
      insuranceProvider,
      policyNumber,
      coverageType,
      copayPercentage,
      familyInfo = [],
      beneficiaries = [],
      preexistingDiseases = [],
      clinicalHistorySummary
    } = req.body;

    if (!firstName || !lastName || !documentNumber) {
      await t.rollback();
      return res.status(400).json({ message: 'Nombres, apellidos y número de documento son obligatorios.' });
    }

    // Clean format: strictly numbers for documentNumber
    const cleanNum = cleanDocNumber(documentNumber);
    if (!cleanNum) {
      await t.rollback();
      return res.status(400).json({ message: 'El número de documento debe contener solo dígitos numéricos.' });
    }

    const cleanPref = (documentPrefix || 'V').toUpperCase();
    const formattedDocumentId = `${cleanPref}${cleanNum}`;
    const medicalRecordNumber = `HC-${formattedDocumentId}`;

    // 1. DUPLICATE CHECK: Verify if patient with documentId or medicalRecordNumber already exists
    const existingPatient = await Patient.findOne({
      where: {
        [Op.or]: [
          { documentId: formattedDocumentId },
          { medicalRecordNumber }
        ]
      }
    });

    if (existingPatient) {
      await t.rollback();
      return res.status(409).json({ 
        message: `⚠️ Ya existe un paciente registrado con el documento ${formattedDocumentId} (Nro. de Historia Médica: ${existingPatient.medicalRecordNumber || medicalRecordNumber}). Se evitan registros duplicados.` 
      });
    }

    // 2. DUPLICATE CHECK: Verify if User email already exists
    const userEmail = email ? email.trim().toLowerCase() : `pac.${formattedDocumentId.toLowerCase()}@medicusve.com`;
    const existingUser = await User.findOne({ where: { email: userEmail } });
    if (existingUser) {
      await t.rollback();
      return res.status(409).json({ 
        message: `⚠️ Ya existe un usuario en el sistema con el correo electrónico ${userEmail}.` 
      });
    }

    // Find Patient Role
    const patientRole = await Role.findOne({ where: { name: 'PATIENT' } });

    // Create User
    const user = await User.create({
      username: email ? email.split('@')[0] : `pac.${formattedDocumentId.toLowerCase()}`,
      email: userEmail,
      password: password || 'MedicusvePatient123!',
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      roleId: patientRole ? patientRole.id : null,
      organizationId,
      phone: phone || null
    }, { transaction: t });

    // Create Patient
    const patient = await Patient.create({
      userId: user.id,
      organizationId,
      medicalRecordNumber,
      documentType,
      documentPrefix: cleanPref,
      documentNumber: cleanNum,
      documentId: formattedDocumentId,
      birthDate: birthDate || null,
      gender,
      phone: phone || null,
      state: state || null,
      city: city || null,
      municipality: municipality || null,
      address: address || null,
      bloodType: bloodType || null,
      allergies: allergies || null,
      hasInsurance: !!hasInsurance,
      insuranceCompanyId: hasInsurance && insuranceCompanyId ? insuranceCompanyId : null,
      insuranceProvider: hasInsurance ? (insuranceProvider || 'Seguro Privado') : 'Particular',
      policyNumber: hasInsurance ? policyNumber : null,
      coverageType: hasInsurance ? (coverageType || 'INSURANCE') : 'SELF_PAY',
      copayPercentage: copayPercentage || 0.00,
      coverageStatus: 'ACTIVE',
      familyInfo: Array.isArray(familyInfo) ? familyInfo : [],
      beneficiaries: Array.isArray(beneficiaries) ? beneficiaries : [],
      preexistingDiseases: Array.isArray(preexistingDiseases) ? preexistingDiseases : [],
      clinicalHistorySummary: clinicalHistorySummary || null
    }, { transaction: t });

    await t.commit();

    const populated = await Patient.findByPk(patient.id, {
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
        { model: InsuranceCompany }
      ]
    });

    res.status(201).json({
      message: '¡Paciente registrado exitosamente!',
      patient: populated
    });
  } catch (error) {
    await t.rollback();
    console.error('Error in createPatient:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updatePatient = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';

    const patient = await Patient.findByPk(id, { include: [User] });
    if (!patient) {
      await t.rollback();
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    if (!isSuperAdmin && organizationId) {
      if (patient.organizationId && patient.organizationId !== organizationId && patient.User?.organizationId && patient.User.organizationId !== organizationId) {
        await t.rollback();
        return res.status(403).json({ message: 'No tienes permisos para modificar este paciente de otra clínica' });
      }
    }

    const {
      firstName,
      lastName,
      email,
      documentType,
      documentPrefix,
      documentNumber,
      birthDate,
      gender,
      phone,
      state,
      city,
      municipality,
      address,
      bloodType,
      allergies,
      hasInsurance,
      insuranceCompanyId,
      insuranceProvider,
      policyNumber,
      coverageType,
      copayPercentage,
      familyInfo,
      beneficiaries,
      preexistingDiseases,
      clinicalHistorySummary
    } = req.body;

    // If document is being changed, check for duplicates
    let documentId = patient.documentId;
    let medicalRecordNumber = patient.medicalRecordNumber;
    let cleanNum = patient.documentNumber;
    let cleanPref = patient.documentPrefix;

    if (documentNumber) {
      cleanNum = cleanDocNumber(documentNumber);
      cleanPref = (documentPrefix || patient.documentPrefix || 'V').toUpperCase();
      documentId = `${cleanPref}${cleanNum}`;
      medicalRecordNumber = `HC-${documentId}`;

      const duplicate = await Patient.findOne({
        where: {
          documentId,
          id: { [Op.ne]: id }
        }
      });

      if (duplicate) {
        await t.rollback();
        return res.status(409).json({ message: `Ya existe otro paciente con el documento ${documentId}` });
      }
    }

    // Update User
    if (patient.User) {
      const userUpdates = {};
      if (firstName) userUpdates.firstName = firstName.trim();
      if (lastName) userUpdates.lastName = lastName.trim();
      if (phone) userUpdates.phone = phone;
      if (email && email !== patient.User.email) {
        const dupUser = await User.findOne({ where: { email: email.trim().toLowerCase(), id: { [Op.ne]: patient.User.id } } });
        if (dupUser) {
          await t.rollback();
          return res.status(409).json({ message: 'El correo electrónico ya está en uso por otro usuario.' });
        }
        userUpdates.email = email.trim().toLowerCase();
      }
      await patient.User.update(userUpdates, { transaction: t });
    }

    // Update Patient
    await patient.update({
      documentType: documentType || patient.documentType,
      documentPrefix: cleanPref,
      documentNumber: cleanNum,
      documentId,
      medicalRecordNumber,
      birthDate: birthDate !== undefined ? birthDate : patient.birthDate,
      gender: gender || patient.gender,
      phone: phone !== undefined ? phone : patient.phone,
      state: state !== undefined ? state : patient.state,
      city: city !== undefined ? city : patient.city,
      municipality: municipality !== undefined ? municipality : patient.municipality,
      address: address !== undefined ? address : patient.address,
      bloodType: bloodType !== undefined ? bloodType : patient.bloodType,
      allergies: allergies !== undefined ? allergies : patient.allergies,
      hasInsurance: hasInsurance !== undefined ? !!hasInsurance : patient.hasInsurance,
      insuranceCompanyId: hasInsurance ? (insuranceCompanyId || patient.insuranceCompanyId) : null,
      insuranceProvider: hasInsurance ? (insuranceProvider || patient.insuranceProvider) : 'Particular',
      policyNumber: hasInsurance ? (policyNumber || patient.policyNumber) : null,
      coverageType: hasInsurance ? (coverageType || patient.coverageType) : 'SELF_PAY',
      copayPercentage: copayPercentage !== undefined ? copayPercentage : patient.copayPercentage,
      familyInfo: familyInfo !== undefined ? familyInfo : patient.familyInfo,
      beneficiaries: beneficiaries !== undefined ? beneficiaries : patient.beneficiaries,
      preexistingDiseases: preexistingDiseases !== undefined ? preexistingDiseases : patient.preexistingDiseases,
      clinicalHistorySummary: clinicalHistorySummary !== undefined ? clinicalHistorySummary : patient.clinicalHistorySummary
    }, { transaction: t });

    await t.commit();

    const updated = await Patient.findByPk(id, {
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
        { model: InsuranceCompany }
      ]
    });

    res.json({
      message: 'Paciente actualizado correctamente',
      patient: updated
    });
  } catch (error) {
    await t.rollback();
    console.error('Error updating patient:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';

    const patient = await Patient.findByPk(id, { include: [User] });
    if (!patient) return res.status(404).json({ message: 'Paciente no encontrado' });
    
    if (!isSuperAdmin && organizationId) {
      if (patient.organizationId && patient.organizationId !== organizationId && patient.User?.organizationId && patient.User.organizationId !== organizationId) {
        return res.status(403).json({ message: 'No tienes permisos para eliminar este paciente de otra clínica' });
      }
    }

    await User.destroy({ where: { id: patient.userId } });
    await patient.destroy();
    res.json({ message: 'Paciente eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.expressAdmission = async (req, res) => {
  try {
    const { documentId, firstName, lastName, email, phone, insuranceProvider, policyNumber, coverageType } = req.body;
    const { organizationId } = req.user;

    if (!documentId || !firstName || !lastName) {
      return res.status(400).json({ message: 'Cédula/DNI, nombres y apellidos son obligatorios' });
    }

    const cleanNum = cleanDocNumber(documentId);
    const formattedDoc = documentId.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const medRec = `HC-${formattedDoc}`;

    let patient = await Patient.findOne({
      where: {
        [Op.or]: [
          { documentId: formattedDoc },
          { medicalRecordNumber: medRec }
        ]
      },
      include: [User]
    });

    if (!patient) {
      const patientRole = await Role.findOne({ where: { name: 'PATIENT' } });

      const user = await User.create({
        username: email || `pac.${formattedDoc.toLowerCase()}`,
        email: email || `pac.${formattedDoc.toLowerCase()}@medicusve.com`,
        password: 'MedicusvePatient123!',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        roleId: patientRole ? patientRole.id : null,
        organizationId
      });

      patient = await Patient.create({
        userId: user.id,
        documentId: formattedDoc,
        documentNumber: cleanNum,
        documentPrefix: formattedDoc.charAt(0) || 'V',
        medicalRecordNumber: medRec,
        phone,
        insuranceProvider: insuranceProvider || 'Particular',
        policyNumber: policyNumber || null,
        coverageType: coverageType || (policyNumber ? 'INSURANCE' : 'SELF_PAY'),
        coverageStatus: 'ACTIVE',
        organizationId
      });

      patient.User = user;
    }

    const ticketNumber = `TICKET-${Math.floor(100 + Math.random() * 900)}`;

    res.status(201).json({
      message: '✅ Admisión Express completada exitosamente',
      ticketNumber,
      admissionTime: new Date(),
      patient: {
        id: patient.id,
        documentId: patient.documentId,
        medicalRecordNumber: patient.medicalRecordNumber,
        name: `${patient.User?.firstName} ${patient.User?.lastName}`,
        insuranceProvider: patient.insuranceProvider,
        coverageType: patient.coverageType,
        coverageStatus: patient.coverageStatus
      }
    });
  } catch (error) {
    console.error('Error in expressAdmission:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.verifyInsuranceCoverage = async (req, res) => {
  try {
    const { id } = req.params;
    const { totalConsultationCost } = req.body;

    const patient = await Patient.findByPk(id, { include: [User, InsuranceCompany] });
    if (!patient) return res.status(404).json({ message: 'Paciente no encontrado' });

    const total = parseFloat(totalConsultationCost || 100);
    const isInsurance = (patient.hasInsurance || patient.coverageType === 'INSURANCE') && patient.coverageStatus === 'ACTIVE';

    const copayPercentage = isInsurance ? (patient.copayPercentage > 0 ? patient.copayPercentage : 15.00) : 100.00;
    const patientAmountToPay = (total * (copayPercentage / 100)).toFixed(2);
    const insuranceAmountCovered = (total - patientAmountToPay).toFixed(2);

    res.json({
      patientId: patient.id,
      patientName: `${patient.User?.firstName} ${patient.User?.lastName}`,
      medicalRecordNumber: patient.medicalRecordNumber,
      insuranceProvider: patient.InsuranceCompany?.name || patient.insuranceProvider,
      policyNumber: patient.policyNumber,
      coverageStatus: patient.coverageStatus,
      isApproved: isInsurance,
      financialBreakdown: {
        totalConsultationCost: total.toFixed(2),
        patientAmountToPay,
        insuranceAmountCovered,
        copayPercentage: `${parseFloat(copayPercentage)}%`
      }
    });
  } catch (error) {
    console.error('Error in verifyInsuranceCoverage:', error);
    res.status(500).json({ error: error.message });
  }
};
