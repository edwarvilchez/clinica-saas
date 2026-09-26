const { Specialty, Department, Doctor, User } = require('../models');

// List all specialties with their department and doctors count
exports.getAllSpecialties = async (req, res) => {
  try {
    const specialties = await Specialty.findAll({
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { 
          model: Doctor, 
          attributes: ['id', 'licenseNumber'],
          include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'isActive'] }]
        }
      ],
      order: [['name', 'ASC']]
    });
    res.json(specialties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new specialty
exports.createSpecialty = async (req, res) => {
  try {
    const { code, name, nameEn, description, baseFeeUSD, departmentId, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'El nombre de la especialidad es obligatorio' });
    }

    const specialty = await Specialty.create({
      code,
      name,
      nameEn,
      description,
      baseFeeUSD: baseFeeUSD || 40.00,
      departmentId: departmentId || null,
      isActive: isActive !== undefined ? isActive : true
    });

    const populated = await Specialty.findByPk(specialty.id, {
      include: [{ model: Department, attributes: ['id', 'name'] }]
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a specialty
exports.updateSpecialty = async (req, res) => {
  try {
    const { id } = req.params;
    const specialty = await Specialty.findByPk(id);

    if (!specialty) {
      return res.status(404).json({ message: 'Especialidad no encontrada' });
    }

    await specialty.update(req.body);

    const updated = await Specialty.findByPk(id, {
      include: [{ model: Department, attributes: ['id', 'name'] }]
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a specialty
exports.deleteSpecialty = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorCount = await Doctor.count({ where: { specialtyId: id } });

    if (doctorCount > 0) {
      return res.status(400).json({ 
        message: `No se puede eliminar la especialidad porque tiene ${doctorCount} médico(s) asociado(s).` 
      });
    }

    const specialty = await Specialty.findByPk(id);
    if (!specialty) {
      return res.status(404).json({ message: 'Especialidad no encontrada' });
    }

    await specialty.destroy();
    res.json({ message: 'Especialidad eliminada con éxito' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
