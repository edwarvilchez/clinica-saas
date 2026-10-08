'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const CLINICAL_SAFETY_DISCLAIMER = 'AVISO MÉDICO LEGAL OBLIGATORIO: Esta síntesis y sugerencias diagnósticas son generadas por un modelo computacional de soporte a la decisión clínica (CDSS). No constituyen diagnóstico médico vinculante ni prescripción médica definitiva. Requiere evaluación, criterio autónomo y aprobación formal obligatoria por parte del médico tratante (Paradigma Doctor reviews & approves) antes de su incorporación a la historia clínica o indicación terapéutica al paciente.';

const ClinicalAiDraft = sequelize.define('ClinicalAiDraft', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
    allowNull: true,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Organizations',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('PRE_CONSULTATION_BRIEF', 'CIE11_DIFFERENTIAL', 'SOAP_NOTE', 'PRESCRIPTION_SAFETY_CHECK'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('PROPOSED', 'DOCTOR_APPROVED', 'DOCTOR_MODIFIED', 'DOCTOR_REJECTED'),
    defaultValue: 'PROPOSED',
    allowNull: false
  },
  inputData: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  aiOutput: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  doctorFeedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reviewedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  medicalRecordId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'MedicalRecords',
      key: 'id'
    }
  },
  disclaimer: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: CLINICAL_SAFETY_DISCLAIMER
  },
  isAiGenerated: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  confidenceScore: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 85.00
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['organizationId'] },
    { fields: ['patientId'] },
    { fields: ['doctorId'] },
    { fields: ['status'] },
    { fields: ['type'] }
  ]
});

ClinicalAiDraft.CLINICAL_SAFETY_DISCLAIMER = CLINICAL_SAFETY_DISCLAIMER;

module.exports = ClinicalAiDraft;
