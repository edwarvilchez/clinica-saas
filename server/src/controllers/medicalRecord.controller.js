const { MedicalRecord, Patient, Doctor, User, Prescription, Drug, sequelize } = require('../models');
const auditService = require('../services/audit.service');
const tenantRls = require('../utils/tenantRls');

const getTenantTransaction = (req) => {
  if (typeof req.withTenantTransaction === 'function') {
    return req.withTenantTransaction.bind(req);
  }
  return (cb) => tenantRls.withTenantTransaction(sequelize, {
    organizationId: req.user?.organizationId,
    isSuperAdmin: req.user?.role === 'SUPERADMIN' || req.user?.role === 'PLATFORM_ADMIN'
  }, cb);
};

const validatePatientAccess = async (patientId, organizationId, role, transaction = null) => {
  const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
  if (isSuperAdmin) return true;

  const patient = await Patient.findByPk(patientId, { include: [User], transaction });
  if (!patient) return false;
  
  return patient.User?.organizationId === organizationId || patient.organizationId === organizationId;
};

exports.createRecord = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { patientId } = req.body;
    const withTx = getTenantTransaction(req);

    const result = await withTx(async (t) => {
      const hasAccess = await validatePatientAccess(patientId, organizationId, role, t);
      if (!hasAccess) {
        return { status: 403, payload: { message: 'No tienes acceso a este paciente' } };
      }

      const doctor = await Doctor.findOne({ where: { userId: req.user.id }, transaction: t });
      
      if (doctor) {
          req.body.doctorId = doctor.id;
      } 
      
      if (!req.body.doctorId) {
          return { status: 400, payload: { error: 'Doctor identifier is missing. User must be a Doctor.' } };
      }

      req.body.organizationId = organizationId;
      const record = await MedicalRecord.create(req.body, { transaction: t });

      if (req.body.prescriptions && Array.isArray(req.body.prescriptions)) {
        const prescriptionsData = req.body.prescriptions.map(p => ({
          ...p,
          organizationId,
          medicalRecordId: record.id
        }));
        await Prescription.bulkCreate(prescriptionsData, { individualHooks: true, transaction: t });
      }

      return { status: 201, payload: record };
    });

    if (result.status !== 201) {
      return res.status(result.status).json(result.payload);
    }

    const record = result.payload;

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
    const withTx = getTenantTransaction(req);

    const result = await withTx(async (t) => {
      const hasAccess = await validatePatientAccess(patientId, organizationId, role, t);
      if (!hasAccess) {
        return { status: 403, payload: { message: 'No tienes acceso a este paciente' } };
      }

      const records = await MedicalRecord.findAll({
        where: { patientId },
        include: [
          { model: Doctor, include: [User] },
          { model: Prescription, as: 'prescriptions', include: [{ model: Drug, as: 'drug' }] }
        ],
        order: [['createdAt', 'DESC']],
        transaction: t
      });

      return { status: 200, payload: records };
    });

    if (result.status !== 200) {
      return res.status(result.status).json(result.payload);
    }

    const records = result.payload;

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
    const withTx = getTenantTransaction(req);

    const result = await withTx(async (t) => {
      const hasAccess = await validatePatientAccess(patientId, organizationId, role, t);
      if (!hasAccess) {
        return { status: 403, payload: { message: 'No tienes acceso a este paciente' } };
      }

      const patient = await Patient.findByPk(patientId, { include: [User], transaction: t });
      if (!patient) return { status: 404, payload: { message: 'Paciente no encontrado' } };

      const records = await MedicalRecord.findAll({
        where: { patientId },
        include: [
          { model: Prescription, as: 'prescriptions' }
        ],
        order: [['createdAt', 'DESC']],
        transaction: t
      });

      return { status: 200, payload: { patient, records } };
    });

    if (result.status !== 200) {
      return res.status(result.status).json(result.payload);
    }

    const { patient, records } = result.payload;
    const patientName = patient.User ? `${patient.User.firstName} ${patient.User.lastName}` : 'Paciente';

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
    const withTx = getTenantTransaction(req);

    const result = await withTx(async (t) => {
      const record = await MedicalRecord.findByPk(id, { transaction: t });
      if (!record) {
        return { status: 404, payload: { message: 'Historia médica no encontrada' } };
      }

      const hasAccess = await validatePatientAccess(record.patientId, organizationId, role, t);
      if (!hasAccess) {
        return { status: 403, payload: { message: 'No tienes acceso a este paciente' } };
      }

      record.isSigned = true;
      record.signedAt = new Date();
      record.signedByDoctorId = req.user.id;
      await record.save({ transaction: t });

      return { status: 200, payload: record };
    });

    if (result.status !== 200) {
      return res.status(result.status).json(result.payload);
    }

    const record = result.payload;

    auditService.logClinicalAccess({
      action: 'SIGN_MEDICAL_RECORD',
      actorUserId: req.user.id,
      patientId: record.patientId,
      medicalRecordId: record.id,
      organizationId,
      req,
      details: { signedAt: record.signedAt }
    }).catch(err => console.error('Audit sign error:', err));

    // Domain Event Bus Dispatch
    try {
      const { eventBus, DOMAIN_EVENTS } = require('../events/eventBus');
      eventBus.publish(DOMAIN_EVENTS.MEDICAL_RECORD_SIGNED, {
        medicalRecordId: record.id,
        patientId: record.patientId,
        doctorId: req.user.id,
        signedAt: record.signedAt
      }, {
        organizationId,
        userId: req.user.id,
        requestId: req.headers ? req.headers['x-request-id'] : null
      });
    } catch (busErr) {
      // Non-blocking dispatch
    }

    res.json({ success: true, message: 'Historia médica firmada digitalmente', record });
  } catch (error) {
    console.error('Error signing record:', error);
    res.status(500).json({ error: error.message });
  }
};

