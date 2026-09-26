const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const AccountChart = sequelize.define('AccountChart', {
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
    allowNull: false // e.g., '1.1.01.01' (Bancos), '4.1.01.01' (Ingresos por Consultas)
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  accountType: {
    type: DataTypes.ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COST', 'EXPENSE'),
    allowNull: false // Activo, Pasivo, Patrimonio, Ingresos, Costos, Gastos
  },
  category: {
    type: DataTypes.ENUM('CURRENT', 'NON_CURRENT', 'OPERATIONAL', 'NON_OPERATIONAL', 'TAX'),
    defaultValue: 'OPERATIONAL'
  },
  parentCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  allowsMovement: {
    type: DataTypes.BOOLEAN,
    defaultValue: true // Only movement accounts can have journal lines
  },
  balanceUSD: {
    type: DataTypes.DECIMAL(14, 2),
    defaultValue: 0.00
  },
  balanceVES: {
    type: DataTypes.DECIMAL(18, 2),
    defaultValue: 0.00
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  paranoid: true,
  indexes: [
    {
      fields: ['code', 'organizationId'],
      unique: true
    }
  ]
});

module.exports = AccountChart;
