const { Drug } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

exports.getAllDrugs = async (req, res) => {
  try {
    const { search, category, limit = 20, offset = 0 } = req.query;
    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { genericName: { [Op.iLike]: `%${search}%` } },
        { activeComponents: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (category) {
      where.category = category;
    }

    const { count, rows } = await Drug.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['name', 'ASC']]
    });

    res.json({
      total: count,
      drugs: rows,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching drugs');
    res.status(500).json({ message: 'Error al obtener los medicamentos' });
  }
};

exports.getDrugById = async (req, res) => {
  try {
    const drug = await Drug.findByPk(req.params.id);
    if (!drug) {
      return res.status(404).json({ message: 'Medicamento no encontrado' });
    }
    res.json(drug);
  } catch (error) {
    logger.error({ error }, 'Error fetching drug detail');
    res.status(500).json({ message: 'Error al obtener el detalle del medicamento' });
  }
};

exports.createDrug = async (req, res) => {
  try {
    const drug = await Drug.create(req.body);
    res.status(201).json(drug);
  } catch (error) {
    logger.error({ error }, 'Error creating drug');
    res.status(500).json({ message: 'Error al crear el medicamento' });
  }
};

exports.updateDrug = async (req, res) => {
  try {
    const drug = await Drug.findByPk(req.params.id);
    if (!drug) {
      return res.status(404).json({ message: 'Medicamento no encontrado' });
    }
    await drug.update(req.body);
    res.json(drug);
  } catch (error) {
    logger.error({ error }, 'Error updating drug');
    res.status(500).json({ message: 'Error al actualizar el medicamento' });
  }
};

exports.deleteDrug = async (req, res) => {
  try {
    const drug = await Drug.findByPk(req.params.id);
    if (!drug) {
      return res.status(404).json({ message: 'Medicamento no encontrado' });
    }
    await drug.destroy();
    res.json({ message: 'Medicamento eliminado' });
  } catch (error) {
    logger.error({ error }, 'Error deleting drug');
    res.status(500).json({ message: 'Error al eliminar el medicamento' });
  }
};
