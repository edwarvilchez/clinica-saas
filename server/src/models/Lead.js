'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Lead = sequelize.define('Lead', {
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
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  documentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  source: {
    type: DataTypes.ENUM('WHATSAPP', 'WEB_FORM', 'CALL_INBOUND', 'REFERRAL', 'CAMPAIGN', 'WALK_IN', 'OTHER'),
    defaultValue: 'WHATSAPP',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('NEW', 'CONTACTED', 'SCHEDULED', 'CONVERTED', 'LOST'),
    defaultValue: 'NEW',
    allowNull: false
  },
  channel: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Campaña o punto de contacto específico (ej. Campaña Chequeo Cardíaco 2026)'
  },
  assignedUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  specialtyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Specialties',
      key: 'id'
    }
  },
  convertedPatientId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Patients',
      key: 'id'
    }
  },
  conversionDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lossReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Razón de pérdida (ej. Costo elevado, Falta de disponibilidad, Decidió otra clínica)'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  estimatedValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
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
  timestamps: true,
  paranoid: true,
  indexes: [
    { fields: ['organizationId'] },
    { fields: ['status'] },
    { fields: ['source'] },
    { fields: ['assignedUserId'] },
    { fields: ['phone'] },
    { fields: ['organizationId', 'status'] },
    { fields: ['organizationId', 'createdAt'] }
  ]
});

module.exports = Lead;
