const { MedicalRecord, Patient, Doctor, User, Prescription, Drug } = require('../models');

exports.createRecord = async (req, res) => {
  try {
    // 1. Resolve Doctor ID from logged-in user
    const doctor = await Doctor.findOne({ where: { userId: req.user.id } });
    
    // If user is a Doctor, use their profile ID
    if (doctor) {
        req.body.doctorId = doctor.id;
    } 
    
    // If not a doctor (e.g. Admin), ensure doctorId is provided in body
    if (!req.body.doctorId) {
        return res.status(400).json({ error: 'Doctor identifier is missing. User must be a Doctor.' });
    }

    const record = await MedicalRecord.create(req.body);

    // Save associated prescriptions if present
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
    const { patientId } = req.params;
    
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
