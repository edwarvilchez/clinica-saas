const { Prescription, Drug, MedicalRecord, Patient, User, sequelize } = require('../models');
const logger = require('../utils/logger');
const appConfig = require('../config/app.config');
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

const validatePrescriptionAccess = async (prescriptionId, organizationId, role, transaction = null) => {
  const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
  if (isSuperAdmin) return true;

  const prescription = await Prescription.findByPk(prescriptionId, {
    include: [{
      model: MedicalRecord,
      include: [{
        model: Patient,
        include: [{ model: User, attributes: ['organizationId'] }]
      }]
    }],
    transaction
  });

  if (!prescription) return false;

  return prescription.MedicalRecord?.Patient?.User?.organizationId === organizationId || prescription.organizationId === organizationId;
};

exports.createPrescription = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { medicalRecordId } = req.body;
    const withTx = getTenantTransaction(req);

    const result = await withTx(async (t) => {
      const isSuperAdmin = role === 'SUPERADMIN' || role === 'PLATFORM_ADMIN';
      
      if (!isSuperAdmin && organizationId) {
        const record = await MedicalRecord.findByPk(medicalRecordId, {
          include: [{
            model: Patient,
            include: [{ model: User, attributes: ['organizationId'] }]
          }],
          transaction: t
        });

        if (!record || (record.Patient?.User?.organizationId !== organizationId && record.organizationId !== organizationId)) {
          return { status: 403, payload: { message: 'No tienes acceso a este registro médico' } };
        }
      }

      const crypto = require('crypto');
      const secret = appConfig.auth.jwtSecret;
      const timestamp = Date.now();
      const verificationHash = crypto.createHash('sha256').update(`${medicalRecordId}-${req.body.drugName}-${timestamp}-${Math.random()}`).digest('hex');
      const digitalSignature = crypto.createHmac('sha256', secret).update(`${verificationHash}:${medicalRecordId}:${req.user.id}:${timestamp}`).digest('hex');

      const prescriptionData = {
        ...req.body,
        organizationId: organizationId || req.body.organizationId,
        verificationHash,
        digitalSignature,
        status: req.body.status || 'active'
      };

      const prescription = await Prescription.create(prescriptionData, { transaction: t });
      return { status: 201, payload: { prescription, verificationHash } };
    });

    if (result.status !== 201) {
      return res.status(result.status).json(result.payload);
    }

    const { prescription, verificationHash } = result.payload;
    const clientUrl = process.env.CLIENT_URL || 'https://clinicasaas.app';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${clientUrl}/prescriptions/verify/${verificationHash}`)}`;

    res.status(201).json({
      ...prescription.toJSON(),
      qrUrl,
      verificationUrl: `${clientUrl}/prescriptions/verify/${verificationHash}`
    });
  } catch (error) {
    logger.error({ error }, 'Error creating prescription');
    res.status(500).json({ message: 'Error al crear la prescripción' });
  }
};

exports.getRecordPrescriptions = async (req, res) => {
  try {
    const { medicalRecordId } = req.params;
    const withTx = getTenantTransaction(req);

    const prescriptions = await withTx(async (t) => {
      return Prescription.findAll({
        where: { medicalRecordId },
        include: [{ model: Drug, as: 'drug' }],
        transaction: t
      });
    });

    res.json(prescriptions);
  } catch (error) {
    logger.error({ error }, 'Error fetching prescriptions');
    res.status(500).json({ message: 'Error al obtener las prescripciones' });
  }
};

exports.deletePrescription = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { id } = req.params;
    const withTx = getTenantTransaction(req);

    const result = await withTx(async (t) => {
      const hasAccess = await validatePrescriptionAccess(id, organizationId, role, t);
      if (!hasAccess) {
        return { status: 403, payload: { message: 'No tienes acceso a esta prescripción' } };
      }

      const deleted = await Prescription.destroy({ where: { id }, transaction: t });
      if (!deleted) return { status: 404, payload: { message: 'Prescripción no encontrada' } };
      return { status: 200, payload: { message: 'Prescripción eliminada' } };
    });

    res.status(result.status).json(result.payload);
  } catch (error) {
    logger.error({ error }, 'Error deleting prescription');
    res.status(500).json({ message: 'Error al eliminar la prescripción' });
  }
};
