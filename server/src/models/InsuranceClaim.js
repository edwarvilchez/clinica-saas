const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const InsuranceClaim = sequelize.define('InsuranceClaim', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  claimNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  claimToken: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
    unique: true
  },
  insuranceCompanyId: {
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
  policyNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  authorizationCode: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Carta Aval / Clave de Emergencia / Código de Autorización'
  },
  serviceType: {
    type: DataTypes.ENUM(
      'CONSULTATION',
      'SURGERY',
      'HOSPITALIZATION',
      'PROCEDURE',
      'EMERGENCY',
      'LAB_IMAGING',
      'OTHER'
    ),
    defaultValue: 'CONSULTATION'
  },
  serviceStartDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  serviceEndDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  diagnosis: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Diagnóstico CIE-11 / Motivo de Reclamo / Informe Clínico'
  },
  items: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Desglose de servicios, insumos y honorarios reclamados'
  },
  grossAmountUSD: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  deductibleUSD: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  claimedAmountUSD: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  bcvRate: {
    type: DataTypes.DECIMAL(12, 4),
    defaultValue: 1.0000
  },
  status: {
    type: DataTypes.ENUM(
      'EMITTED',
      'UNDER_REVIEW',
      'APPROVED',
      'PARTIALLY_APPROVED',
      'REJECTED',
      'PAID',
      'CANCELLED'
    ),
    defaultValue: 'EMITTED'
  },
  settledAmountUSD: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  settledDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'InsuranceClaims'
});

module.exports = InsuranceClaim;
