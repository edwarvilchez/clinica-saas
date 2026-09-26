const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const InsurancePolicy = sequelize.define('InsurancePolicy', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Patients',
      key: 'id'
    }
  },
  insuranceCompanyId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'InsuranceCompanies',
      key: 'id'
    }
  },
  policyNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  certificateNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  holderName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  holderDocumentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  relationship: {
    type: DataTypes.STRING,
    defaultValue: 'Titular'
  },
  coveragePercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 80.00
  },
  deductibleUSD: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  expirationDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  paranoid: true
});

module.exports = InsurancePolicy;
