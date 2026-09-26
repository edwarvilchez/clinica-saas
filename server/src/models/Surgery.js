const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Surgery = sequelize.define('Surgery', {
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
  surgeryNumber: {
    type: DataTypes.STRING,
    allowNull: false // e.g. 'CIR-2026-0034'
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Patients',
      key: 'id'
    }
  },
  admissionId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Admissions',
      key: 'id'
    }
  },
  procedureName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  specialtyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Specialties',
      key: 'id'
    }
  },
  leadSurgeonId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  assistantSurgeonId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  anesthesiologistId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  operatingRoom: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Quirófano 1'
  },
  scheduledStartTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  scheduledEndTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  actualStartTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  actualEndTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  anesthesiaType: {
    type: DataTypes.ENUM('GENERAL', 'REGIONAL', 'LOCAL', 'SEDATION', 'EPIDURAL'),
    defaultValue: 'GENERAL'
  },
  preOperativeDiagnosis: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  postOperativeDiagnosis: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  surgicalFindings: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  totalCostUSD: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.ENUM('SCHEDULED', 'PRE_OP', 'IN_SURGERY', 'RECOVERY', 'COMPLETED', 'SUSPENDED', 'CANCELLED'),
    defaultValue: 'SCHEDULED'
  }
}, {
  paranoid: true
});

module.exports = Surgery;
