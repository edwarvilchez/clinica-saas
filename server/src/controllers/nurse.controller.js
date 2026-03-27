const { Nurse, User } = require('../models');

exports.getNurses = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';

    const whereClause = {};
    
    if (!isSuperAdmin && organizationId) {
      whereClause.organizationId = organizationId;
    }

    const nurses = await Nurse.findAll({ 
      where: whereClause,
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId', 'isActive'] }]
    });
    res.json(nurses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteNurse = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
    const { id } = req.params;
    
    const nurse = await Nurse.findByPk(id, { include: [User] });
    if (!nurse) return res.status(404).json({ message: 'Nurse not found' });

    if (!isSuperAdmin && nurse.User.organizationId !== organizationId) {
      return res.status(403).json({ message: 'No tienes permisos sobre esta enfermera' });
    }

    await User.destroy({ where: { id: nurse.userId } });
    res.json({ message: 'Nurse deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
