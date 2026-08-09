const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  reason: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Confirmed', 'Cancelled', 'Completed'),
    defaultValue: 'Pending'
  },
  notes: {
    type: DataTypes.TEXT
  },
  type: {
    type: DataTypes.ENUM('In-Person', 'Video'),
    defaultValue: 'In-Person'
  },
  reminderSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  reminder24hSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
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
      fields: ['patientId']
    },
    {
      fields: ['doctorId']
    },
    {
      fields: ['date']
    },
    {
      fields: ['status']
    },
    {
      fields: ['type']
    },
    {
      fields: ['reminderSent']
    },
    {
      // Índice compuesto para búsquedas comunes
      fields: ['doctorId', 'date', 'status']
    },
    {
      // Índice compuesto para pacientes
      fields: ['patientId', 'date', 'status']
    }
  ]
});

module.exports = Appointment;
