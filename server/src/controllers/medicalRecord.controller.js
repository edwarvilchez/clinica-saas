const { MedicalRecord, Patient, Doctor, User, Prescription, Drug } = require('../models');

const validatePatientAccess = async (patientId, organizationId, role) => {
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
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

    const record = await MedicalRecord.create(req.body);

    if (req.body.prescriptions && Array.isArray(req.body.prescriptions)) {
      const prescriptionsData = req.body.prescriptions.map(p => ({
        ...p,
        medicalRecordId: record.id
      }));
      await Prescription.bulkCreate(prescriptionsData);
    }

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
    
    res.json(records);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: error.message });
  }
};
