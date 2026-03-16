const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Prescription = sequelize.define('Prescription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  drugName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  drugId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Drugs',
      key: 'id'
    }
  },
  dosage: {
    type: DataTypes.STRING
  },
  frequency: {
    type: DataTypes.STRING
  },
  duration: {
    type: DataTypes.STRING
  },
  instructions: {
    type: DataTypes.TEXT
  },
  medicalRecordId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'MedicalRecords',
      key: 'id'
    }
  }
}, {
  timestamps: true
});

module.exports = Prescription;
