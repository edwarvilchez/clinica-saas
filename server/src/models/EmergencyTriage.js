const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const EmergencyTriage = sequelize.define('EmergencyTriage', {
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
  triageNumber: {
    type: DataTypes.STRING,
    allowNull: false // e.g. 'TRI-2026-0012'
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
  nurseId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Nurses',
      key: 'id'
    }
  },
  assignedDoctorId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  triageLevel: {
    type: DataTypes.ENUM('LEVEL_1_RED', 'LEVEL_2_ORANGE', 'LEVEL_3_YELLOW', 'LEVEL_4_GREEN', 'LEVEL_5_BLUE'),
    allowNull: false,
    defaultValue: 'LEVEL_3_YELLOW'
  },
  chiefComplaint: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  // Signos Vitales
  systolicBP: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  diastolicBP: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  heartRate: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  respiratoryRate: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  temperature: {
    type: DataTypes.DECIMAL(4, 1),
    allowNull: true
  },
  oxygenSaturation: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  painScale: {
    type: DataTypes.INTEGER, // 0-10
    defaultValue: 0
  },
  assignedBox: {
    type: DataTypes.STRING,
    allowNull: true // e.g. 'Box Trauma-Shock', 'Box 3'
  },
  status: {
    type: DataTypes.ENUM('TRIAGED', 'ATTENDING', 'OBSERVATION', 'DISCHARGED', 'HOSPITALIZED', 'TRANSFERRED'),
    defaultValue: 'TRIAGED'
  },
  treatmentGiven: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  paranoid: true
});

module.exports = EmergencyTriage;
