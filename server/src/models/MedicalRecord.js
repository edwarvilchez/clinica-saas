const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const MedicalRecord = sequelize.define('MedicalRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  diagnosis: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  treatment: {
    type: DataTypes.TEXT
  },
  indications: {
    type: DataTypes.TEXT
  },
  physicalExam: {
    type: DataTypes.TEXT
  },
  medicalLeaveDays: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  medicalLeaveStartDate: {
    type: DataTypes.DATEONLY
  },
  medicalLeaveEndDate: {
    type: DataTypes.DATEONLY
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Patients',
      key: 'id'
    }
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deletedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  paranoid: true,
  indexes: [
    { fields: ['organizationId'] },
    { fields: ['patientId'] },
    { fields: ['doctorId'] },
    { fields: ['organizationId', 'createdAt'] },
    { fields: ['organizationId', 'patientId'] },
    { fields: ['organizationId', 'doctorId'] }
  ]
});

module.exports = MedicalRecord;
