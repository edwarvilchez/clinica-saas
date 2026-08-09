const { Prescription, Drug, MedicalRecord, Patient, User } = require('../models');
const logger = require('../utils/logger');

const validatePrescriptionAccess = async (prescriptionId, organizationId, role) => {
  const isSuperAdmin = role === 'SUPERADMIN' || role === 'SUPERADMIN';
  if (isSuperAdmin) return true;

  const prescription = await Prescription.findByPk(prescriptionId, {
    include: [{
      model: MedicalRecord,
      include: [{
        model: Patient,
        include: [{ model: User, attributes: ['organizationId'] }]
      }]
    }]
  });

  if (!prescription) return false;

  return prescription.MedicalRecord?.Patient?.User?.organizationId === organizationId;
};

exports.createPrescription = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { medicalRecordId } = req.body;

    const isSuperAdmin = role === 'SUPERADMIN' || role === 'SUPERADMIN';
    
    if (!isSuperAdmin && organizationId) {
      const record = await MedicalRecord.findByPk(medicalRecordId, {
        include: [{
          model: Patient,
          include: [{ model: User, attributes: ['organizationId'] }]
        }]
      });

      if (!record || record.Patient?.User?.organizationId !== organizationId) {
        return res.status(403).json({ message: 'No tienes acceso a este registro médico' });
      }
    }

    const crypto = require('crypto');
    const secret = process.env.JWT_SECRET || 'secret888_medicalcare';
    const timestamp = Date.now();
    const verificationHash = crypto.createHash('sha256').update(`${medicalRecordId}-${req.body.drugName}-${timestamp}-${Math.random()}`).digest('hex');
    const digitalSignature = crypto.createHmac('sha256', secret).update(`${verificationHash}:${medicalRecordId}:${req.user.id}:${timestamp}`).digest('hex');

    const prescriptionData = {
      ...req.body,
      verificationHash,
      digitalSignature,
      status: req.body.status || 'active'
    };

    const prescription = await Prescription.create(prescriptionData);
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
}

exports.getRecordPrescriptions = async (req, res) => {
  try {
    const { medicalRecordId } = req.params;
    const prescriptions = await Prescription.findAll({
      where: { medicalRecordId },
      include: [{ model: Drug, as: 'drug' }]
    });
    res.json(prescriptions);
  } catch (error) {
    logger.error({ error }, 'Error fetching prescriptions');
    res.status(500).json({ message: 'Error al obtener las prescripciones' });
  }
}

exports.deletePrescription = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { id } = req.params;

    const hasAccess = await validatePrescriptionAccess(id, organizationId, role);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes acceso a esta prescripción' });
    }

    const deleted = await Prescription.destroy({ where: { id } });
    if (!deleted) return res.status(404).json({ message: 'Prescripción no encontrada' });
    res.json({ message: 'Prescripción eliminada' });
  } catch (error) {
    logger.error({ error }, 'Error deleting prescription');
    res.status(500).json({ message: 'Error al eliminar la prescripción' });
  }
}
