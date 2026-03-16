const { Doctor, User, Specialty } = require('../models');

exports.getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.findAll({ include: [User, Specialty] });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.toggleDoctorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByPk(id, { include: [User] });
    
    if (!doctor || !doctor.User) {
      return res.status(404).json({ message: 'Doctor or associated user not found' });
    }

    const newStatus = !doctor.User.isActive;
    await doctor.User.update({ isActive: newStatus });

    res.json({ 
      message: `Doctor ${newStatus ? 'activado' : 'desactivado'} con éxito`,
      isActive: newStatus 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const doctor = await Doctor.findByPk(id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    
    await User.destroy({ where: { id: doctor.userId } });
    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.toggleDoctorBypass = async (req, res) => {
  try {
    const authorizedEmails = ['edwarvilchez1977@gmail.com', 'admin@medicus.com'];
    if (!authorizedEmails.includes(req.user.email)) {
      return res.status(403).json({ message: 'No tienes permisos de nivel Fundador para esta acción.' });
    }

    const { id } = req.params;
    const doctor = await Doctor.findByPk(id, { include: [User] });
    
    if (!doctor || !doctor.User) {
      return res.status(404).json({ message: 'Doctor or associated user not found' });
    }

    const newBypass = !doctor.User.subscriptionBypass;
    await doctor.User.update({ subscriptionBypass: newBypass });

    res.json({ 
      message: `Bypass de suscripción ${newBypass ? 'activado' : 'desactivado'} con éxito`,
      subscriptionBypass: newBypass 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
