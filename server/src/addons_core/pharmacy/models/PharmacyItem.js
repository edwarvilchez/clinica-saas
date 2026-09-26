/**
 * ==============================================================================
 * PHARMACY ITEM MODEL
 * ==============================================================================
 * @file        PharmacyItem.js
 * @description Catalog item definition for drugs and clinical supplies.
 * ==============================================================================
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/db.config');

const PharmacyItem = sequelize.define('PharmacyItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  tradeName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  genericName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  presentation: {
    type: DataTypes.STRING,
    defaultValue: 'Caja'
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  reorderPoint: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  totalStock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = PharmacyItem;
