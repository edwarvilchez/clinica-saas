const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ClinicalPackage = sequelize.define('ClinicalPackage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Organizations',
      key: 'id'
    }
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    defaultValue: 'SURGERY',
    comment: 'SURGERY, MATERNITY, LABORATORY, EMERGENCY, CONSULTATION, HOSPITALIZATION, SPECIALTY'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  totalPriceUSD: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  estimatedDurationHours: {
    type: DataTypes.DECIMAL(6, 2),
    defaultValue: 2.0
  },
  items: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Desglose predeterminado del combo: [{ concept, type, quantity, unitPriceUSD, notes }]'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  paranoid: true
});

module.exports = ClinicalPackage;
