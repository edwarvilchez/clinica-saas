const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const JournalEntry = sequelize.define('JournalEntry', {
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
  entryNumber: {
    type: DataTypes.STRING,
    allowNull: false // e.g. 'AS-2026-0001'
  },
  entryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  concept: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  sourceModule: {
    type: DataTypes.ENUM('MANUAL', 'BILLING', 'PAYMENT', 'DOCTOR_FEES', 'SALES', 'PAYROLL', 'EXPENSE'),
    defaultValue: 'MANUAL'
  },
  sourceId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  bcvRate: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false,
    defaultValue: 1.0000
  },
  totalDebitUSD: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  totalCreditUSD: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  totalDebitVES: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  totalCreditVES: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  isBalanced: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'POSTED', 'CANCELLED'),
    defaultValue: 'POSTED'
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  paranoid: true
});

module.exports = JournalEntry;
