const { LabResult, Patient, User } = require('../models');

const validatePatientAccess = async (patientId, organizationId, role) => {
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
  if (isSuperAdmin) return true;

  const patient = await Patient.findByPk(patientId, { include: [User] });
  if (!patient) return false;
  
  return patient.User.organizationId === organizationId;
};

exports.createLabResult = async (req, res) => {
  try {
    const { organizationId, role, id: userId } = req.user;
    const { patientId } = req.body;

    const hasAccess = await validatePatientAccess(patientId, organizationId, role);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes acceso a este paciente' });
    }

    const result = await LabResult.create(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPatientLabs = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const { patientId } = req.params;

    const hasAccess = await validatePatientAccess(patientId, organizationId, role);
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes acceso a este paciente' });
    }

    const labs = await LabResult.findAll({ 
      where: { patientId }, 
      order: [['createdAt', 'DESC']] 
    });
    res.json(labs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllLabs = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';

    const options = {
      order: [['createdAt', 'DESC']],
      include: [{
        model: Patient,
        as: 'Patient',
        include: [{
          model: User,
          where: isSuperAdmin ? {} : { organizationId }
        }]
      }]
    };

    const labs = await LabResult.findAll(options);
    res.json(labs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
