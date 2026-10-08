const { 
  Patient, 
  User, 
  Role, 
  InsuranceCompany, 
  Appointment, 
  MedicalRecord, 
  Prescription, 
  Drug, 
  LabResult, 
  Payment, 
  Admission, 
  Doctor, 
  Specialty, 
  sequelize 
} = require('../models');
const { Op } = require('sequelize');
const { hasPermission } = require('../middlewares/authorization.middleware');
const IdentityDocumentService = require('../services/identityDocument.service');

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
      const sClean = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
      patientWhere[Op.or] = [
        { documentId: { [Op.iLike]: `%${s}%` } },
        { documentNumberNormalized: { [Op.iLike]: `%${sClean || s}%` } },
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

    const cleanNorm = recordNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const patient = await Patient.findOne({
      where: {
        [Op.or]: [
          { medicalRecordNumber: recordNumber },
          { documentId: recordNumber },
          { documentNumberNormalized: cleanNorm }
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

    const rawInput = req.body.documentId || ((documentPrefix && documentNumber) ? `${documentPrefix}${documentNumber}` : documentNumber);

    if (!firstName || !lastName || !rawInput) {
      await t.rollback();
      return res.status(400).json({ message: 'Nombres, apellidos y número de documento son obligatorios.' });
    }

    const isCedula = !documentType || documentType === 'CEDULA';
    let cleanPref = (documentPrefix || 'V').toUpperCase();
    let cleanNum = '';
    let formattedDocumentId = '';
    let normalizedDocumentId = '';
    let medicalRecordNumber = '';

    if (isCedula) {
      const parsedDoc = IdentityDocumentService.parse(rawInput);
      if (!parsedDoc.isValid) {
        await t.rollback();
        return res.status(400).json({
          code: 'INVALID_IDENTITY_DOCUMENT',
          message: parsedDoc.error || 'El documento de identidad no tiene un formato válido. Utilice V-12345678 o E-12345678.'
        });
      }
      cleanPref = parsedDoc.prefix;
      cleanNum = parsedDoc.number;
      formattedDocumentId = parsedDoc.canonical;
      normalizedDocumentId = parsedDoc.normalized;
      medicalRecordNumber = `HC-${formattedDocumentId}`;
    } else {
      cleanNum = cleanDocNumber(documentNumber || rawInput);
      cleanPref = (documentPrefix || 'PAS').toUpperCase();
      formattedDocumentId = `${cleanPref}${cleanNum}`;
      normalizedDocumentId = formattedDocumentId;
      medicalRecordNumber = `HC-${formattedDocumentId}`;
    }

    // 1. DUPLICATE CHECK: Verify if patient with documentId or normalized document already exists in this organization
    const dupCheck = await IdentityDocumentService.checkDuplicate({
      documentInput: formattedDocumentId,
      organizationId,
      PatientModel: Patient,
      transaction: t
    });

    if (dupCheck.isDuplicate) {
      await t.rollback();
      return res.status(409).json({
        code: 'IDENTITY_DOCUMENT_ALREADY_EXISTS',
        message: 'El registro ya existe. Verifique el número de documento ingresado.'
      });
    }

    // 2. DUPLICATE CHECK: Verify if medicalRecordNumber already exists in this organization
    const existingMedRec = await Patient.findOne({
      where: {
        medicalRecordNumber,
        organizationId: organizationId || null
      },
      transaction: t
    });
    if (existingMedRec) {
      await t.rollback();
      return res.status(409).json({
        code: 'IDENTITY_DOCUMENT_ALREADY_EXISTS',
        message: 'El registro ya existe. Verifique el número de documento ingresado.'
      });
    }

    // 3. DUPLICATE CHECK: Verify if User email already exists
    const userEmail = email ? email.trim().toLowerCase() : `pac.${normalizedDocumentId.toLowerCase()}@medicusve.com`;
    const existingUser = await User.findOne({ where: { email: userEmail }, transaction: t });
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
      username: email ? email.split('@')[0] : `pac.${normalizedDocumentId.toLowerCase()}`,
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
      documentNumberNormalized: normalizedDocumentId,
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
    if (IdentityDocumentService.handleUniqueViolationError(error, res)) {
      return;
    }
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
    let documentNumberNormalized = patient.documentNumberNormalized;
    let medicalRecordNumber = patient.medicalRecordNumber;
    let cleanNum = patient.documentNumber;
    let cleanPref = patient.documentPrefix;

    if (documentNumber || req.body.documentId) {
      const rawInput = req.body.documentId || ((documentPrefix || patient.documentPrefix || 'V') + documentNumber);
      const isCedula = (documentType || patient.documentType || 'CEDULA') === 'CEDULA';

      if (isCedula) {
        const parsedDoc = IdentityDocumentService.parse(rawInput);
        if (!parsedDoc.isValid) {
          await t.rollback();
          return res.status(400).json({
            code: 'INVALID_IDENTITY_DOCUMENT',
            message: parsedDoc.error || 'El documento de identidad no tiene un formato válido. Utilice V-12345678 o E-12345678.'
          });
        }
        cleanPref = parsedDoc.prefix;
        cleanNum = parsedDoc.number;
        documentId = parsedDoc.canonical;
        documentNumberNormalized = parsedDoc.normalized;
        medicalRecordNumber = `HC-${documentId}`;
      } else {
        cleanNum = cleanDocNumber(documentNumber || rawInput);
        cleanPref = (documentPrefix || patient.documentPrefix || 'PAS').toUpperCase();
        documentId = `${cleanPref}${cleanNum}`;
        documentNumberNormalized = documentId;
        medicalRecordNumber = `HC-${documentId}`;
      }

      // Validar si existe otro paciente con este mismo documento en esta organización
      const dupCheck = await IdentityDocumentService.checkDuplicate({
        documentInput: documentId,
        organizationId: patient.organizationId,
        excludePatientId: id,
        PatientModel: Patient,
        transaction: t
      });

      if (dupCheck.isDuplicate) {
        await t.rollback();
        return res.status(409).json({
          code: 'IDENTITY_DOCUMENT_ALREADY_EXISTS',
          message: 'El registro ya existe. Verifique el número de documento ingresado.'
        });
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
      documentNumberNormalized,
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
    if (IdentityDocumentService.handleUniqueViolationError(error, res)) {
      return;
    }
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

    const parsedDoc = IdentityDocumentService.parse(documentId);
    if (!parsedDoc.isValid) {
      return res.status(400).json({
        code: 'INVALID_IDENTITY_DOCUMENT',
        message: parsedDoc.error || 'El documento de identidad no tiene un formato válido. Utilice V-12345678 o E-12345678.'
      });
    }

    const cleanNum = parsedDoc.number;
    const formattedDoc = parsedDoc.canonical;
    const normalizedDoc = parsedDoc.normalized;
    const medRec = `HC-${formattedDoc}`;

    let patient = await Patient.findOne({
      where: {
        [Op.or]: [
          { documentNumberNormalized: normalizedDoc },
          { documentId: formattedDoc },
          { medicalRecordNumber: medRec }
        ],
        ...(organizationId ? { organizationId } : { organizationId: null })
      },
      include: [User]
    });

    if (!patient) {
      const patientRole = await Role.findOne({ where: { name: 'PATIENT' } });

      const user = await User.create({
        username: email || `pac.${normalizedDoc.toLowerCase()}`,
        email: email || `pac.${normalizedDoc.toLowerCase()}@medicusve.com`,
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
        documentPrefix: parsedDoc.prefix,
        documentNumberNormalized: normalizedDoc,
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

/**
 * 🏥 Fase 18: Timeline Longitudinal del Paciente
 * Visión unificada y cronológica de citas, historias clínicas, recetas,
 * resultados de laboratorio, admisiones hospitalarias y pagos.
 * Incluye autorización estricta contra IDOR y aislamiento multi-tenant.
 */
exports.getPatientTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, organizationId, id: userId } = req.user;
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';

    // 1. Localizar al paciente
    const patient = await Patient.findByPk(id, {
      include: [
        { model: User, attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: InsuranceCompany, attributes: ['id', 'name'] }
      ]
    });

    if (!patient) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    // 2. Control de Acceso: Aislamiento multi-tenant
    if (!isSuperAdmin && patient.organizationId && patient.organizationId !== organizationId) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    // 3. Control de Autorización & Protección Anti-IDOR
    const canReadPatients = hasPermission(role, 'patients:read');
    const isOwnPatient = role === 'PATIENT' && patient.userId === userId;

    if (!canReadPatients && !isOwnPatient) {
      return res.status(403).json({
        message: 'Acceso denegado: permisos insuficientes para consultar el timeline del paciente'
      });
    }

    // 4. Parámetros de filtrado opcionales
    const { type: typeFilter, startDate, endDate } = req.query;
    const requestedTypes = typeFilter ? typeFilter.split(',').map(t => t.trim().toUpperCase()) : null;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter[Op.between] = [new Date(startDate), new Date(endDate)];
    } else if (startDate) {
      dateFilter[Op.gte] = new Date(startDate);
    } else if (endDate) {
      dateFilter[Op.lte] = new Date(endDate);
    }

    const timelineEvents = [];

    // Helper para doctor
    const formatDoctor = (doc) => {
      if (!doc) return null;
      const docUser = doc.User;
      return {
        id: doc.id,
        name: docUser ? `Dr. ${docUser.firstName} ${docUser.lastName}`.trim() : 'Médico Tratante',
        specialty: doc.Specialty?.name || 'Medicina General'
      };
    };

    // 5. Cargar Citas Médicas (APPOINTMENT)
    if (!requestedTypes || requestedTypes.includes('APPOINTMENT')) {
      const aptWhere = { patientId: patient.id };
      if (Object.keys(dateFilter).length > 0) aptWhere.date = dateFilter;

      const appointments = await Appointment.findAll({
        where: aptWhere,
        include: [
          {
            model: Doctor,
            attributes: ['id'],
            include: [
              { model: User, attributes: ['firstName', 'lastName'] },
              { model: Specialty, attributes: ['id', 'name'] }
            ]
          }
        ],
        order: [['date', 'DESC']]
      });

      appointments.forEach(apt => {
        timelineEvents.push({
          id: apt.id,
          type: 'APPOINTMENT',
          date: apt.date,
          title: `Cita Médica (${apt.type || 'Presencial'})`,
          description: apt.reason || 'Consulta médica',
          status: apt.status,
          doctor: formatDoctor(apt.Doctor),
          details: {
            appointmentType: apt.type,
            notes: apt.notes
          }
        });
      });
    }

    // 6. Cargar Historias Médicas y Prescripciones (MEDICAL_RECORD / PRESCRIPTION)
    const loadRecords = !requestedTypes || requestedTypes.includes('MEDICAL_RECORD');
    const loadPrescriptions = !requestedTypes || requestedTypes.includes('PRESCRIPTION');

    if (loadRecords || loadPrescriptions) {
      const mrWhere = { patientId: patient.id };
      if (Object.keys(dateFilter).length > 0) mrWhere.createdAt = dateFilter;

      const medicalRecords = await MedicalRecord.findAll({
        where: mrWhere,
        include: [
          {
            model: Doctor,
            attributes: ['id'],
            include: [
              { model: User, attributes: ['firstName', 'lastName'] },
              { model: Specialty, attributes: ['id', 'name'] }
            ]
          },
          {
            model: Prescription,
            as: 'prescriptions',
            include: [{ model: Drug, as: 'drug', attributes: ['id', 'name', 'presentation'] }]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      medicalRecords.forEach(mr => {
        if (loadRecords) {
          timelineEvents.push({
            id: mr.id,
            type: 'MEDICAL_RECORD',
            date: mr.createdAt,
            title: 'Evolución Clínica / Consulta',
            description: mr.diagnosis,
            status: 'Signed',
            doctor: formatDoctor(mr.Doctor),
            details: {
              treatment: mr.treatment,
              indications: mr.indications,
              physicalExam: mr.physicalExam,
              medicalLeaveDays: mr.medicalLeaveDays
            }
          });
        }

        if (loadPrescriptions && mr.prescriptions && mr.prescriptions.length > 0) {
          mr.prescriptions.forEach(p => {
            timelineEvents.push({
              id: p.id,
              type: 'PRESCRIPTION',
              date: p.createdAt || mr.createdAt,
              title: `Receta Médica: ${p.drugName || p.drug?.name || 'Medicamento'}`,
              description: `${p.dosage || ''} - ${p.frequency || ''} (${p.duration || ''})`.trim(),
              status: p.status,
              doctor: formatDoctor(mr.Doctor),
              details: {
                drugName: p.drugName || p.drug?.name,
                dosage: p.dosage,
                frequency: p.frequency,
                duration: p.duration,
                instructions: p.instructions,
                verificationHash: p.verificationHash
              }
            });
          });
        }
      });
    }

    // 7. Cargar Resultados de Laboratorio (LAB_RESULT)
    if (!requestedTypes || requestedTypes.includes('LAB_RESULT')) {
      const labWhere = { patientId: patient.id };
      if (Object.keys(dateFilter).length > 0) labWhere.createdAt = dateFilter;

      const labResults = await LabResult.findAll({
        where: labWhere,
        order: [['createdAt', 'DESC']]
      });

      labResults.forEach(lab => {
        timelineEvents.push({
          id: lab.id,
          type: 'LAB_RESULT',
          date: lab.createdAt,
          title: `Estudio de Laboratorio: ${lab.testName}`,
          description: lab.resultValue ? `Resultado: ${lab.resultValue}` : 'En procesamiento',
          status: lab.status,
          doctor: null,
          details: {
            testName: lab.testName,
            resultValue: lab.resultValue,
            referenceRange: lab.referenceRange,
            sampleStatus: lab.sampleStatus,
            fileUrl: lab.fileUrl
          }
        });
      });
    }

    // 8. Cargar Admisiones Hospitalarias (ADMISSION)
    if (!requestedTypes || requestedTypes.includes('ADMISSION')) {
      try {
        const admWhere = { patientId: patient.id };
        if (Object.keys(dateFilter).length > 0) admWhere.admissionDate = dateFilter;

        const admissions = await Admission.findAll({
          where: admWhere,
          include: [
            {
              model: Doctor,
              attributes: ['id'],
              include: [
                { model: User, attributes: ['firstName', 'lastName'] },
                { model: Specialty, attributes: ['id', 'name'] }
              ]
            }
          ],
          order: [['admissionDate', 'DESC']]
        });

        admissions.forEach(adm => {
          timelineEvents.push({
            id: adm.id,
            type: 'ADMISSION',
            date: adm.admissionDate,
            title: `Admisión Hospitalaria (${adm.admissionType || 'General'})`,
            description: adm.initialDiagnosis || 'Hospitalización',
            status: adm.status,
            doctor: formatDoctor(adm.Doctor),
            details: {
              admissionDate: adm.admissionDate,
              dischargeDate: adm.dischargeDate,
              roomNumber: adm.roomNumber,
              bedNumber: adm.bedNumber
            }
          });
        });
      } catch (e) {
        // Best effort si el modelo no está habilitado
      }
    }

    // 9. Cargar Pagos Realizados (PAYMENT)
    if (!requestedTypes || requestedTypes.includes('PAYMENT')) {
      const payWhere = { patientId: patient.id };
      if (Object.keys(dateFilter).length > 0) payWhere.createdAt = dateFilter;

      const payments = await Payment.findAll({
        where: payWhere,
        order: [['createdAt', 'DESC']]
      });

      payments.forEach(pay => {
        timelineEvents.push({
          id: pay.id,
          type: 'PAYMENT',
          date: pay.createdAt,
          title: `Pago Recaudado: ${pay.amount} ${pay.currency || 'USD'}`,
          description: `Método: ${pay.method || 'General'}`,
          status: pay.status,
          doctor: null,
          details: {
            amount: pay.amount,
            amountBs: pay.amountBs,
            currency: pay.currency,
            method: pay.method
          }
        });
      });
    }

    // 10. Ordenar cronológicamente descendente
    timelineEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 11. Resumen consolidado
    const summary = {
      totalEvents: timelineEvents.length,
      appointmentsCount: timelineEvents.filter(e => e.type === 'APPOINTMENT').length,
      medicalRecordsCount: timelineEvents.filter(e => e.type === 'MEDICAL_RECORD').length,
      prescriptionsCount: timelineEvents.filter(e => e.type === 'PRESCRIPTION').length,
      labResultsCount: timelineEvents.filter(e => e.type === 'LAB_RESULT').length,
      admissionsCount: timelineEvents.filter(e => e.type === 'ADMISSION').length,
      paymentsCount: timelineEvents.filter(e => e.type === 'PAYMENT').length
    };

    res.json({
      patient: {
        id: patient.id,
        fullName: patient.User ? `${patient.User.firstName} ${patient.User.lastName}`.trim() : 'Paciente',
        medicalRecordNumber: patient.medicalRecordNumber,
        documentId: patient.documentId,
        gender: patient.gender,
        bloodType: patient.bloodType,
        allergies: patient.allergies,
        insuranceProvider: patient.InsuranceCompany?.name || patient.insuranceProvider || 'Particular'
      },
      summary,
      timeline: timelineEvents
    });
  } catch (error) {
    console.error('Error fetching patient longitudinal timeline:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 🔍 Endpoint para validación y verificación de duplicados de cédula en tiempo real
 * GET /api/patients/check-document?document=...&excludeId=...
 */
exports.checkDocumentAvailability = async (req, res) => {
  try {
    const { document, excludeId } = req.query;
    const { organizationId } = req.user;

    if (!document) {
      return res.status(400).json({ isValid: false, message: 'Documento requerido.' });
    }

    const parsed = IdentityDocumentService.parse(document);
    if (!parsed.isValid) {
      return res.status(200).json({
        isValid: false,
        isAvailable: false,
        message: parsed.error || 'El documento de identidad no tiene un formato válido. Utilice V-12345678 o E-12345678.'
      });
    }

    const dupCheck = await IdentityDocumentService.checkDuplicate({
      documentInput: parsed.canonical,
      organizationId,
      excludePatientId: excludeId || null
    });

    if (dupCheck.isDuplicate) {
      return res.status(200).json({
        isValid: true,
        isAvailable: false,
        canonical: parsed.canonical,
        normalized: parsed.normalized,
        message: 'El registro ya existe. Verifique el número de documento ingresado.'
      });
    }

    return res.status(200).json({
      isValid: true,
      isAvailable: true,
      canonical: parsed.canonical,
      normalized: parsed.normalized,
      message: 'Documento disponible.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

