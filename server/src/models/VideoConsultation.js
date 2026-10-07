const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const VideoConsultation = sequelize.define('VideoConsultation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  appointmentId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  roomId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'active', 'completed', 'cancelled'),
    defaultValue: 'scheduled'
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER, // en minutos
    allowNull: true
  },
  recordingUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'VideoConsultations',
  timestamps: true,
  indexes: [
    { fields: ['organizationId'] },
    { fields: ['appointmentId'] },
    { fields: ['roomId'] }
  ]
});

module.exports = VideoConsultation;
