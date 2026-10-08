const { MedicalRecord, Patient, Doctor, User, Prescription, Drug } = require('../models');
const auditService = require('../services/audit.service');

const validatePatientAccess = async (patientId, organizationId, role) => {
  const isSuperAdmin = role === 'SUPERADMIN' || role === 'SUPERADMIN';
  if (isSuperAdmin) return true;

  const patient = await Patient.findByPk(patientId, { include: [User] });
  if (!patient) return false;
  
  return patient.User.organizationId === organizationId;
};

exports.createRecord = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { patientId } = req.body;

    const hasAccess = await validatePatientAccess(patientId, organizationId, role);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes acceso a este paciente' });
    }

    const doctor = await Doctor.findOne({ where: { userId: req.user.id } });
    
    if (doctor) {
        req.body.doctorId = doctor.id;
    } 
    
    if (!req.body.doctorId) {
        return res.status(400).json({ error: 'Doctor identifier is missing. User must be a Doctor.' });
    }

    req.body.organizationId = organizationId;
    const record = await MedicalRecord.create(req.body);

    if (req.body.prescriptions && Array.isArray(req.body.prescriptions)) {
      const prescriptionsData = req.body.prescriptions.map(p => ({
        ...p,
        organizationId,
        medicalRecordId: record.id
      }));
      await Prescription.bulkCreate(prescriptionsData, { individualHooks: true });
    }

    // Tamper-evident Audit Log: Clinical record creation
    auditService.logClinicalAccess({
      action: 'CREATE_MEDICAL_RECORD',
      actorUserId: req.user.id,
      patientId,
      medicalRecordId: record.id,
      organizationId,
      req,
      newValues: {
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        notes: record.notes
      }
    }).catch(err => console.error('Audit clinical create error:', err));

    res.status(201).json(record);
  } catch (error) {
    console.error('Error creating record:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPatientHistory = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { patientId } = req.params;

    const hasAccess = await validatePatientAccess(patientId, organizationId, role);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes acceso a este paciente' });
    }

    const records = await MedicalRecord.findAll({
      where: { patientId },
      include: [
        { model: Doctor, include: [User] },
        { model: Prescription, as: 'prescriptions', include: [{ model: Drug, as: 'drug' }] }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Tamper-evident Audit Log: Clinical history access (HIPAA access tracking)
    auditService.logClinicalAccess({
      action: 'VIEW_MEDICAL_RECORD',
      actorUserId: req.user.id,
      patientId,
      organizationId,
      req,
      details: { recordCount: records.length }
    }).catch(err => console.error('Audit clinical view error:', err));

    res.json(records);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: error.message });
  }
};

const aiCopilot = require('../utils/aiCopilot.service');

exports.getAISummary = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { patientId } = req.params;

    const hasAccess = await validatePatientAccess(patientId, organizationId, role);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes acceso a este paciente' });
    }

    const patient = await Patient.findByPk(patientId, { include: [User] });
    if (!patient) return res.status(404).json({ message: 'Paciente no encontrado' });

    const patientName = patient.User ? `${patient.User.firstName} ${patient.User.lastName}` : 'Paciente';

    const records = await MedicalRecord.findAll({
      where: { patientId },
      include: [
        { model: Prescription, as: 'prescriptions' }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Tamper-evident Audit Log: AI summary query access
    auditService.logClinicalAccess({
      action: 'VIEW_AI_SUMMARY',
      actorUserId: req.user.id,
      patientId,
      organizationId,
      req,
      details: { patientName }
    }).catch(err => console.error('Audit AI summary view error:', err));

    const summary = await aiCopilot.generatePatientSummary(patientName, records);
    res.json(summary);
  } catch (error) {
    console.error('Error generating AI summary:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.suggestICD11 = async (req, res) => {
  try {
    const { symptoms, diagnosis } = req.body;
    const suggestions = await aiCopilot.suggestCIE11Codes(symptoms || '', diagnosis || '');
    res.json(suggestions);
  } catch (error) {
    console.error('Error suggesting ICD11 codes:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.signRecord = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { id } = req.params;

    const record = await MedicalRecord.findByPk(id);
    if (!record) {
      return res.status(404).json({ message: 'Historia médica no encontrada' });
    }

    const hasAccess = await validatePatientAccess(record.patientId, organizationId, role);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes acceso a este paciente' });
    }

    record.isSigned = true;
    record.signedAt = new Date();
    record.signedByDoctorId = req.user.id;
    await record.save();

    auditService.logClinicalAccess({
      action: 'SIGN_MEDICAL_RECORD',
      actorUserId: req.user.id,
      patientId: record.patientId,
      medicalRecordId: record.id,
      organizationId,
      req,
      details: { signedAt: record.signedAt }
    }).catch(err => console.error('Audit sign error:', err));

    res.json({ success: true, message: 'Historia médica firmada digitalmente', record });
  } catch (error) {
    console.error('Error signing record:', error);
    res.status(500).json({ error: error.message });
  }
};

