const { Organization } = require('../models');

exports.getSettings = async (req, res) => {
  console.log('--- Branding Request Received for User:', req.user?.id, '---');
  try {
    const { organizationId } = req.user;
    if (!organizationId) {
      return res.status(200).json({ settings: { primaryColor: '#10b981', name: 'Clinica SaaS' } });
    }

    const org = await Organization.findByPk(organizationId);
    if (!org) {
       return res.status(200).json({ settings: { primaryColor: '#10b981', name: 'Clinica SaaS' } });
    }
    res.json(org);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { organizationId, role } = req.user;
    const isOwner = role === 'SUPERADMIN' || role === 'SUPER_ADMIN'; // Simple check for now, ideally verify ownerId

    if (!organizationId) {
      return res.status(404).json({ message: 'No tienes una organización asignada' });
    }

    const org = await Organization.findByPk(organizationId);
    if (!org) {
      return res.status(404).json({ message: 'Organización no encontrada' });
    }

    // Merge new settings with existing ones
    const newSettings = {
      ...org.settings,
      ...req.body.settings
    };

    await org.update({
      name: req.body.name || org.name,
      settings: newSettings
    });

    res.json(org);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
