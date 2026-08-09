const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Patient = sequelize.define('Patient', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  documentId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Organizations',
      key: 'id'
    }
  },
  birthDate: {
    type: DataTypes.DATEONLY
  },
  gender: {
    type: DataTypes.ENUM('Male', 'Female', 'Other')
  },
  phone: {
    type: DataTypes.STRING
  },
  address: {
    type: DataTypes.TEXT
  },
  bloodType: {
    type: DataTypes.STRING
  },
  allergies: {
    type: DataTypes.TEXT
  },
  insuranceProvider: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Particular'
  },
  policyNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  coverageType: {
    type: DataTypes.ENUM('INSURANCE', 'SELF_PAY'),
    defaultValue: 'SELF_PAY'
  },
  copayPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0.00
  },
  coverageStatus: {
    type: DataTypes.ENUM('ACTIVE', 'PENDING_APPROVAL', 'EXPIRED', 'INACTIVE'),
    defaultValue: 'ACTIVE'
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deletedBy: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  paranoid: true,
  indexes: [
    {
      unique: true,
      fields: ['documentId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['bloodType']
    },
    {
      fields: ['gender']
    },
    {
      fields: ['organizationId']
    }
  ]
});

module.exports = Patient;
