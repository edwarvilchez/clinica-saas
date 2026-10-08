'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const WaitlistEntry = sequelize.define('WaitlistEntry', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  doctorId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  specialtyId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
    defaultValue: 'MEDIUM',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('WAITING', 'OFFERED', 'ACCEPTED', 'EXPIRED', 'CANCELLED'),
    defaultValue: 'WAITING',
    allowNull: false
  },
  preferredDays: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  preferredTimeRange: {
    type: DataTypes.ENUM('ANY', 'MORNING', 'AFTERNOON'),
    defaultValue: 'ANY'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  offeredAppointmentDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  offeredAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  offerExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  convertedAppointmentId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'WaitlistEntries',
  paranoid: true,
  indexes: [
    { fields: ['organizationId', 'status'] },
    { fields: ['organizationId', 'specialtyId'] },
    { fields: ['organizationId', 'doctorId'] },
    { fields: ['organizationId', 'priority'] },
    { fields: ['patientId'] },
    { fields: ['offerExpiresAt'] }
  ]
});

module.exports = WaitlistEntry;
