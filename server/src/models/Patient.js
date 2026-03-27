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
