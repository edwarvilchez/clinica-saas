/**
 * ==============================================================================
 * PHARMACY BATCH MODEL (FEFO INVENTORY)
 * ==============================================================================
 * @file        PharmacyBatch.js
 * @description Batch tracking for FEFO (First Expired, First Out) inventory.
 * ==============================================================================
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/db.config');
const PharmacyItem = require('./PharmacyItem');

const PharmacyBatch = sequelize.define('PharmacyBatch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  expirationDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  costPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.ENUM('AVAILABLE', 'EXPIRED', 'EXHAUSTED'),
    defaultValue: 'AVAILABLE'
  }
}, {
  timestamps: true
});

PharmacyBatch.belongsTo(PharmacyItem, { foreignKey: 'itemId', as: 'item' });
PharmacyItem.hasMany(PharmacyBatch, { foreignKey: 'itemId', as: 'batches' });

module.exports = PharmacyBatch;
