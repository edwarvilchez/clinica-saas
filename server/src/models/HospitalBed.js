const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const HospitalBed = sequelize.define('HospitalBed', {
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
  bedNumber: {
    type: DataTypes.STRING,
    allowNull: false // e.g. 'HAB-201-A'
  },
  roomNumber: {
    type: DataTypes.STRING,
    allowNull: false // e.g. '201'
  },
  floor: {
    type: DataTypes.STRING,
    defaultValue: 'Piso 2'
  },
  wing: {
    type: DataTypes.STRING,
    defaultValue: 'Ala Norte'
  },
  roomType: {
    type: DataTypes.ENUM('INDIVIDUAL', 'SHARED', 'ICU', 'NEONATAL_ICU', 'ISOLATION', 'EMERGENCY_OBSERVATION', 'RECOVERY'),
    defaultValue: 'INDIVIDUAL'
  },
  dailyRateUSD: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 150.00
  },
  status: {
    type: DataTypes.ENUM('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE'),
    defaultValue: 'AVAILABLE'
  },
  currentPatientId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Patients',
      key: 'id'
    }
  },
  features: {
    type: DataTypes.TEXT,
    allowNull: true // e.g., 'Oxígeno central, monitor multiparamétrico, cama articulada'
  }
}, {
  paranoid: true,
  indexes: [
    {
      fields: ['bedNumber', 'organizationId'],
      unique: true
    }
  ]
});

module.exports = HospitalBed;
