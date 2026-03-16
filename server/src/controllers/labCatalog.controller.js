const { LabTest, LabCombo, User } = require('../models');
const logger = require('../utils/logger');
const fs = require('fs');
const { parseCsv, isCsvFile } = require('../services/importService');

// Lab Tests Controllers
exports.getTests = async (req, res) => {
  try {
    const tests = await LabTest.findAll({
      where: { isActive: true },
      order: [['category', 'ASC'], ['name', 'ASC']]
    });
    res.json(tests);
  } catch (error) {
    logger.error('Error fetching lab tests:', error);
    res.status(500).json({ error: 'Error al obtener los exámenes.' });
  }
};

exports.createTest = async (req, res) => {
  try {
    const test = await LabTest.create(req.body);
    res.status(201).json(test);
  } catch (error) {
    logger.error('Error creating lab test:', error);
    res.status(500).json({ error: 'Error al crear el examen.' });
  }
};

exports.updateTest = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await LabTest.update(req.body, { where: { id } });
    if (updated) {
      const updatedTest = await LabTest.findByPk(id);
      return res.json(updatedTest);
    }
    res.status(404).json({ error: 'Examen no encontrado.' });
  } catch (error) {
    logger.error('Error updating lab test:', error);
    res.status(500).json({ error: 'Error al actualizar el examen.' });
  }
};

exports.deleteTest = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await LabTest.destroy({ where: { id } });
    if (deleted) return res.status(204).send();
    res.status(404).json({ error: 'Examen no encontrado.' });
  } catch (error) {
    logger.error('Error deleting lab test:', error);
    res.status(500).json({ error: 'Error al eliminar el examen.' });
  }
};

// Lab Combos Controllers
exports.getCombos = async (req, res) => {
  try {
    const combos = await LabCombo.findAll({
      where: { isActive: true },
      include: [{
        model: LabTest,
        as: 'tests',
        through: { attributes: [] }
      }]
    });
    res.json(combos);
  } catch (error) {
    logger.error('Error fetching lab combos:', error);
    res.status(500).json({ error: 'Error al obtener los combos.' });
  }
};

exports.createCombo = async (req, res) => {
  try {
    const { name, description, totalPrice, testIds } = req.body;
    const combo = await LabCombo.create({ name, description, totalPrice });
    
    if (testIds && testIds.length > 0) {
      await combo.setTests(testIds);
    }
    
    const fullCombo = await LabCombo.findByPk(combo.id, {
      include: [{ model: LabTest, as: 'tests', through: { attributes: [] } }]
    });
    
    res.status(201).json(fullCombo);
  } catch (error) {
    logger.error('Error creating lab combo:', error);
    res.status(500).json({ error: 'Error al crear el combo.' });
  }
};

exports.updateCombo = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, totalPrice, testIds, isActive } = req.body;
    
    const [updated] = await LabCombo.update(
      { name, description, totalPrice, isActive },
      { where: { id } }
    );
    
    if (updated || testIds) {
      const combo = await LabCombo.findByPk(id);
      if (testIds) {
        await combo.setTests(testIds);
      }
      const updatedCombo = await LabCombo.findByPk(id, {
        include: [{ model: LabTest, as: 'tests', through: { attributes: [] } }]
      });
      return res.json(updatedCombo);
    }
    res.status(404).json({ error: 'Combo no encontrado.' });
  } catch (error) {
    logger.error('Error updating lab combo:', error);
    res.status(500).json({ error: 'Error al actualizar el combo.' });
  }
};

exports.deleteCombo = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await LabCombo.destroy({ where: { id } });
    if (deleted) return res.status(204).send();
    res.status(404).json({ error: 'Combo no encontrado.' });
  } catch (error) {
    logger.error('Error deleting lab combo:', error);
    res.status(500).json({ error: 'Error al eliminar el combo.' });
  }
};

exports.bulkImport = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
  }

  const filePath = req.file.path;
  const errors = [];
  let successCount = 0;

  try {
    if (!isCsvFile(filePath)) {
      throw new Error('Formato de archivo no soportado. Debe ser CSV.');
    }

    const records = await parseCsv(filePath);
    if (records.length > 1000) {
      throw new Error('El archivo es demasiado grande. Máximo 1000 registros.');
    }

    for (const record of records) {
      try {
        // Basic validation of CSV headers (case insensitive)
        const name = record.name || record.Nombre || record.nombre;
        const price = record.price || record.Precio || record.precio;
        const category = record.category || record.Categoria || record.categoría || record.categoria || 'General';
        const description = record.description || record.Descripcion || record.descripción || record.descripcion || '';

        if (!name || isNaN(parseFloat(price))) {
          errors.push({ record, error: 'Nombre o precio inválido.' });
          continue;
        }

        await LabTest.create({
          name: name.trim(),
          price: parseFloat(price),
          category: category.trim(),
          description: description.trim(),
          isActive: true
        });
        successCount++;
      } catch (err) {
        errors.push({ record, error: err.message });
      }
    }

    // Cleanup file
    fs.unlinkSync(filePath);

    res.json({
      message: `Importación completada: ${successCount} exitosos, ${errors.length} fallidos.`,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 10) // Only return first 10 errors to avoid huge response
    });
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    logger.error('Bulk import error (Lab Catalog):', error);
    res.status(500).json({ error: error.message });
  }
};
