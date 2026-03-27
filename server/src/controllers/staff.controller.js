const { Staff, User } = require('../models');

exports.getStaff = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';

    const whereClause = {};
    
    if (!isSuperAdmin && organizationId) {
      whereClause.organizationId = organizationId;
    }

    const staff = await Staff.findAll({ 
      where: whereClause,
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'organizationId', 'isActive'] }]
    });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN';
    const { id } = req.params;
    
    const item = await Staff.findByPk(id, { include: [User] });
    if (!item) return res.status(404).json({ message: 'Staff member not found' });

    if (!isSuperAdmin && item.User.organizationId !== organizationId) {
      return res.status(403).json({ message: 'No tienes permisos sobre este miembro del staff' });
    }

    await User.destroy({ where: { id: item.userId } });
    res.json({ message: 'Staff deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
