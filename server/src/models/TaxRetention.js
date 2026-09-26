const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const TaxRetention = sequelize.define('TaxRetention', {
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
  voucherNumber: {
    type: DataTypes.STRING,
    allowNull: false // e.g. '20260900000123'
  },
  retentionType: {
    type: DataTypes.ENUM('IVA', 'ISLR', 'MUNICIPAL'),
    allowNull: false
  },
  beneficiaryName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  beneficiaryRif: {
    type: DataTypes.STRING,
    allowNull: false
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  invoiceControlNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  invoiceDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  baseAmountUSD: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false
  },
  baseAmountVES: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  taxPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 16.00 // IVA 16%
  },
  taxAmountUSD: {
    type: DataTypes.DECIMAL(14, 2),
    defaultValue: 0.00
  },
  taxAmountVES: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0.00
  },
  retentionPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false // 75% o 100% para IVA, 3% o 5% para ISLR
  },
  retainedAmountUSD: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false
  },
  retainedAmountVES: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  bcvRate: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'EMITTED', 'DECLARED', 'ANNULLED'),
    defaultValue: 'EMITTED'
  }
}, {
  paranoid: true
});

module.exports = TaxRetention;
