/**
 * ==============================================================================
 * PHARMACY CONTROLLER & FEFO DISPENSATION ENGINE
 * ==============================================================================
 * @file        pharmacy.controller.js
 * @description Manages inventory items, batch entry, and FEFO dispensation algorithm.
 * @author      CGK Core Engineering Team
 * @license     Enterprise / Proprietary
 * ==============================================================================
 */

const PharmacyItem = require('../models/PharmacyItem');
const PharmacyBatch = require('../models/PharmacyBatch');
const sequelize = require('../../../config/db.config');
const { Op } = require('sequelize');

class PharmacyController {
  /**
   * Get all pharmacy items with active batches
   */
  async getInventory(req, res) {
    try {
      const items = await PharmacyItem.findAll({
        include: [{
          model: PharmacyBatch,
          as: 'batches',
          where: { status: 'AVAILABLE', quantity: { [Op.gt]: 0 } },
          required: false
        }],
        order: [['tradeName', 'ASC']]
      });
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Add a new inventory item
   */
  async createItem(req, res) {
    try {
      const { code, tradeName, genericName, presentation, unitPrice, reorderPoint } = req.body;
      const organizationId = req.user?.organizationId || null;

      const item = await PharmacyItem.create({
        code,
        tradeName,
        genericName,
        presentation,
        unitPrice,
        reorderPoint,
        organizationId
      });

      res.status(201).json({ message: 'Ítem de farmacia creado exitosamente', item });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Register a new batch with expiration date for an item
   */
  async addBatch(req, res) {
    try {
      const { itemId, batchNumber, expirationDate, quantity, costPrice } = req.body;

      const item = await PharmacyItem.findByPk(itemId);
      if (!item) return res.status(404).json({ message: 'Ítem de farmacia no encontrado' });

      const batch = await PharmacyBatch.create({
        itemId,
        batchNumber,
        expirationDate,
        quantity,
        costPrice,
        status: 'AVAILABLE'
      });

      // Recalculate total stock
      const totalStock = await PharmacyBatch.sum('quantity', {
        where: { itemId, status: 'AVAILABLE' }
      });
      await item.update({ totalStock: totalStock || 0 });

      res.status(201).json({ message: 'Lote registrado con éxito', batch, totalStock });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * FEFO ALGORITHM: Dispense medication deducting from the batch with earliest expiration date
   * @param {Object} req.body - { itemId, requestedQuantity }
   */
  async dispenseFEFO(req, res) {
    const t = await sequelize.transaction();
    try {
      const { itemId, requestedQuantity } = req.body;
      const qtyToDispense = parseInt(requestedQuantity);

      if (!itemId || !qtyToDispense || qtyToDispense <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Ítem y cantidad válida son requeridos' });
      }

      const item = await PharmacyItem.findByPk(itemId, { transaction: t });
      if (!item) {
        await t.rollback();
        return res.status(404).json({ message: 'Ítem de farmacia no encontrado' });
      }

      // Fetch available batches ordered by expirationDate ASC (FEFO First Expired, First Out)
      const batches = await PharmacyBatch.findAll({
        where: {
          itemId,
          status: 'AVAILABLE',
          quantity: { [Op.gt]: 0 },
          expirationDate: { [Op.gte]: new Date().toISOString().split('T')[0] } // Exclude expired
        },
        order: [['expirationDate', 'ASC']],
        transaction: t
      });

      let remainingToDispense = qtyToDispense;
      const deductedBatches = [];

      for (const batch of batches) {
        if (remainingToDispense <= 0) break;

        const deductFromThisBatch = Math.min(batch.quantity, remainingToDispense);
        const newBatchQty = batch.quantity - deductFromThisBatch;
        remainingToDispense -= deductFromThisBatch;

        await batch.update({
          quantity: newBatchQty,
          status: newBatchQty === 0 ? 'EXHAUSTED' : 'AVAILABLE'
        }, { transaction: t });

        deductedBatches.push({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          expirationDate: batch.expirationDate,
          quantityDeducted: deductFromThisBatch
        });
      }

      if (remainingToDispense > 0) {
        await t.rollback();
        return res.status(400).json({
          error: 'INSUFFICIENT_FEFO_STOCK',
          message: `Stock disponible en lotes vigentes insuficiente. Faltaron ${remainingToDispense} unidades.`
        });
      }

      // Update total stock on item
      const newTotalStock = await PharmacyBatch.sum('quantity', {
        where: { itemId, status: 'AVAILABLE' },
        transaction: t
      });
      await item.update({ totalStock: newTotalStock || 0 }, { transaction: t });

      await t.commit();

      res.json({
        message: '✅ Dispensación FEFO completada exitosamente',
        itemId,
        dispensedQuantity: qtyToDispense,
        deductedBatches,
        remainingTotalStock: newTotalStock || 0
      });
    } catch (error) {
      await t.rollback();
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PharmacyController();
