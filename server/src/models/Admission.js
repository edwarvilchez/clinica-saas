const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Admission = sequelize.define('Admission', {
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
  admissionNumber: {
    type: DataTypes.STRING,
    allowNull: false // e.g. 'ADM-2026-00042'
  },
  episodeNumber: {
    type: DataTypes.STRING,
    allowNull: false, // e.g. 'EP-2026-00042'
    comment: 'Número secuencial no inmutable del episodio de admisión médica'
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Patients',
      key: 'id'
    }
  },
  medicalRecordNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Número de Historia Médica del Paciente vinculado (generado por CI)'
  },
  attendingDoctorId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  admissionType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'HOSPITALIZATION',
    comment: 'ELECTIVE_SURGICAL, EMERGENCY, AMBULATORY, HOSPITALIZATION, SERVICE, CONSULTATION'
  },
  admissionDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  dischargeDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  paymentType: {
    type: DataTypes.ENUM('PRIVATE', 'INSURANCE', 'CONVENIO', 'COURTESY'),
    defaultValue: 'PRIVATE'
  },
  hasInsurance: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indica si el paciente ingresa con seguro médico'
  },
  insuranceCompanyId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'InsuranceCompanies',
      key: 'id'
    }
  },
  insurancePolicyNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  insurancePlan: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Plan del paciente (ej. Cobertura Total, Dorado, Básico)'
  },
  insuranceHolderType: {
    type: DataTypes.STRING,
    defaultValue: 'TITULAR',
    comment: 'Titular o Beneficiario'
  },
  insuranceCoverageAmountUSD: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    comment: 'Monto de cobertura o suma asegurada'
  },
  insuranceAuthorizationCode: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Claves de emergencia / Código de autorización'
  },
  insuranceClaimNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Número de siniestro asignado por la aseguradora'
  },
  insuranceCartaAval: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Número o referencia de Carta Aval emitida'
  },
  initialDiagnosis: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  dischargeDiagnosis: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'ADMITTED',
    comment: 'ADMITTED (Admitido), IN_TREATMENT, DISCHARGED, TRANSFERRED, CANCELLED'
  },
  currentArea: {
    type: DataTypes.STRING,
    defaultValue: 'ADMISIÓN',
    comment: 'Área clínica actual del paciente'
  },
  areaMovements: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Trazabilidad y auditoría de cambios de área: [{ fromArea, toArea, timestamp, performedBy, authorizedBy, reason }]'
  },
  missingDemographicsWarning: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indica si es un ingreso de emergencia con datos demográficos pendientes'
  },
  missingDemographicsFields: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Campos demográficos faltantes por completar'
  },
  patientDataSnapshot: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Datos de solo lectura del paciente en el momento de la admisión'
  },
  titularData: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Datos del titular: nombre, tipo y número de documento, parentesco, teléfono, dirección'
  },
  guarantorData: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Datos del garante de pago: nombre, tipo y número de documento, parentesco, teléfono, dirección, compromiso de pago'
  },
  insuredPatientData: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Datos del paciente como asegurado/beneficiario'
  },
  companionName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  companionPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  paranoid: true,
  indexes: [
    { fields: ['organizationId'] },
    { fields: ['patientId'] },
    { fields: ['status'] },
    { fields: ['organizationId', 'createdAt'] },
    { fields: ['organizationId', 'status'] },
    { fields: ['organizationId', 'patientId'] },
    { fields: ['patientId', 'status'] }
  ]
});

module.exports = Admission;
