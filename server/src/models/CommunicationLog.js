'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const CommunicationLog = sequelize.define('CommunicationLog', {
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
  channel: {
    type: DataTypes.ENUM('WHATSAPP', 'EMAIL', 'SMS'),
    defaultValue: 'WHATSAPP',
    allowNull: false
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'SIMULATION' // 'TWILIO', 'META_CLOUD', 'ULTRAMSG', 'SIMULATION'
  },
  recipient: {
    type: DataTypes.STRING,
    allowNull: false
  },
  messageType: {
    type: DataTypes.ENUM('APPOINTMENT_CONFIRMATION', 'APPOINTMENT_REMINDER', 'WAITLIST_OFFER', 'CANCELLATION_NOTICE', 'CUSTOM'),
    defaultValue: 'CUSTOM',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'),
    defaultValue: 'SENT',
    allowNull: false
  },
  providerMessageId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['organizationId'] },
    { fields: ['status'] },
    { fields: ['providerMessageId'] },
    { fields: ['recipient'] },
    { fields: ['channel'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = CommunicationLog;
