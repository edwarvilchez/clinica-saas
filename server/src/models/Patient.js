const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Patient = sequelize.define('Patient', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  medicalRecordNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Número de Historia Médica generado a partir de la CI/Documento del paciente'
  },
  documentType: {
    type: DataTypes.ENUM('CEDULA', 'PASAPORTE', 'RIF'),
    defaultValue: 'CEDULA',
    allowNull: false
  },
  documentPrefix: {
    type: DataTypes.STRING,
    defaultValue: 'V',
    allowNull: false,
    comment: 'Prefijo V, E para Cédula; PAS para Pasaporte; J, G, V, E, C, P para RIF'
  },
  documentNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Solo números sin puntos, comas, guiones ni espacios'
  },
  documentId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Documento completo formateado, ej: V12345678, PAS884912, J123456789'
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
  state: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Estado de Venezuela o región'
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  municipality: {
    type: DataTypes.STRING,
    allowNull: true
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
  hasInsurance: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indica si el paciente viene por seguro médico privado'
  },
  insuranceCompanyId: {
    type: DataTypes.UUID,
    allowNull: true
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
  familyInfo: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Lista de familiares y contactos de emergencia'
  },
  beneficiaries: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Lista de beneficiarios asociados al paciente'
  },
  preexistingDiseases: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Enfermedades crónicas, antecedentes y patologías'
  },
  clinicalHistorySummary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Resumen de antecedentes clínicos, cirugías, tratamientos habituales'
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
      fields: ['medicalRecordNumber']
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
    },
    {
      fields: ['organizationId', 'createdAt']
    }
  ]
});

module.exports = Patient;
