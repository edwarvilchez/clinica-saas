const { Prescription, Drug, MedicalRecord, Patient, User } = require('../models');
const logger = require('../utils/logger');

const validatePrescriptionAccess = async (prescriptionId, organizationId, role) => {
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
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

    const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
    
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

    const prescription = await Prescription.create(req.body);
    res.status(201).json(prescription);
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
