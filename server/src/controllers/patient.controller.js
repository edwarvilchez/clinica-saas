const { Patient, User } = require('../models');

exports.getPatients = async (req, res) => {
  try {
    const { organizationId, role } = req.user;

    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let whereClause = {};
    const isSuperAdmin = role === 'SUPERADMIN' || role === 'SUPERADMIN';
    
    if (isSuperAdmin) {
      whereClause = {};
    } else if (organizationId) {
      whereClause = { organizationId };
    } else {
      // If user has no organization, they shouldn't be listing patients
      return res.json({ patients: [], totalPages: 0, currentPage: 1, total: 0 });
    }

    const { count, rows } = await Patient.findAndCountAll({
      limit,
      offset,
      include: [{
        model: User,
        where: whereClause,
        attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId']
      }],
      distinct: true
    });

    res.json({
      patients: rows,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error({ err: error }, 'Error fetching patients');
    res.status(500).json({ error: error.message });
  }
};

exports.getPatientByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const patient = await Patient.findOne({ where: { userId }, include: [User] });
    if (!patient) return res.status(404).json({ message: 'Patient profile not found' });
    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findByPk(id);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    
    // The User will be deleted due to CASCADE
    await User.destroy({ where: { id: patient.userId } });
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Express Admission for Patients: Searches or creates patient by Document ID and assigns queue ticket.
 */
exports.expressAdmission = async (req, res) => {
  try {
    const { documentId, firstName, lastName, email, phone, insuranceProvider, policyNumber, coverageType } = req.body;
    const { organizationId } = req.user;

    if (!documentId || !firstName || !lastName) {
      return res.status(400).json({ message: 'Cédula/DNI, nombres y apellidos son obligatorios' });
    }

    let patient = await Patient.findOne({
      where: { documentId },
      include: [User]
    });

    if (!patient) {
      const { Role } = require('../models');
      const patientRole = await Role.findOne({ where: { name: 'PATIENT' } });

      const user = await User.create({
        username: email || `pac.${documentId.toLowerCase()}`,
        email: email || `pac.${documentId.toLowerCase()}@medicusve.com`,
        password: 'MedicusvePatient123!',
        firstName,
        lastName,
        roleId: patientRole ? patientRole.id : null,
        organizationId
      });

      patient = await Patient.create({
        userId: user.id,
        documentId,
        phone,
        insuranceProvider: insuranceProvider || 'Particular',
        policyNumber: policyNumber || null,
        coverageType: coverageType || (policyNumber ? 'INSURANCE' : 'SELF_PAY'),
        coverageStatus: 'ACTIVE',
        organizationId
      });

      patient.User = user;
    } else {
      // Update coverage info if provided
      if (insuranceProvider || policyNumber) {
        await patient.update({
          insuranceProvider: insuranceProvider || patient.insuranceProvider,
          policyNumber: policyNumber || patient.policyNumber,
          coverageType: coverageType || (policyNumber ? 'INSURANCE' : 'SELF_PAY')
        });
      }
    }

    const ticketNumber = `TICKET-${Math.floor(100 + Math.random() * 900)}`;

    res.status(201).json({
      message: '✅ Admisión Express completada exitosamente',
      ticketNumber,
      admissionTime: new Date(),
      patient: {
        id: patient.id,
        documentId: patient.documentId,
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

/**
 * Verify Insurance Coverage and calculate copay / deductible
 */
exports.verifyInsuranceCoverage = async (req, res) => {
  try {
    const { id } = req.params;
    const { totalConsultationCost } = req.body;

    const patient = await Patient.findByPk(id, { include: [User] });
    if (!patient) return res.status(404).json({ message: 'Paciente no encontrado' });

    const total = parseFloat(totalConsultationCost || 100);
    const isInsurance = patient.coverageType === 'INSURANCE' && patient.coverageStatus === 'ACTIVE';

    const copayPercentage = isInsurance ? (patient.copayPercentage > 0 ? patient.copayPercentage : 15.00) : 100.00;
    const patientAmountToPay = (total * (copayPercentage / 100)).toFixed(2);
    const insuranceAmountCovered = (total - patientAmountToPay).toFixed(2);

    res.json({
      patientId: patient.id,
      patientName: `${patient.User?.firstName} ${patient.User?.lastName}`,
      insuranceProvider: patient.insuranceProvider,
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
