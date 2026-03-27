const { Patient, User } = require('../models');

exports.getPatients = async (req, res) => {
  try {
    const { organizationId, role } = req.user;

    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let whereClause = {};
    const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
    
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
