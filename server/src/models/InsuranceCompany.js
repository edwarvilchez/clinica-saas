const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const InsuranceCompany = sequelize.define('InsuranceCompany', {
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
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  rif: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  contactPerson: {
    type: DataTypes.STRING,
    allowNull: true
  },
  defaultCoveragePercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 80.00
  },
  paymentTermDays: {
    type: DataTypes.INTEGER,
    defaultValue: 30
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
  paranoid: true
});

module.exports = InsuranceCompany;
