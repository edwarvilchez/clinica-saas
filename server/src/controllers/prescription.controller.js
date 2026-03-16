const { Prescription, Drug } = require('../models');
const logger = require('../utils/logger');

exports.createPrescription = async (req, res) => {
  try {
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
    const { id } = req.params;
    const deleted = await Prescription.destroy({ where: { id } });
    if (!deleted) return res.status(404).json({ message: 'Prescripción no encontrada' });
    res.json({ message: 'Prescripción eliminada' });
  } catch (error) {
    logger.error({ error }, 'Error deleting prescription');
    res.status(500).json({ message: 'Error al eliminar la prescripción' });
  }
}
