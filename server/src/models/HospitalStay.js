const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const HospitalStay = sequelize.define('HospitalStay', {
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
  admissionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Admissions',
      key: 'id'
    }
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Patients',
      key: 'id'
    }
  },
  bedId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'HospitalBeds',
      key: 'id'
    }
  },
  attendingDoctorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  entryDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  dischargeDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dailyRateUSD: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 150.00
  },
  totalStayUSD: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  dietType: {
    type: DataTypes.STRING,
    defaultValue: 'Completa / Normal'
  },
  isolationType: {
    type: DataTypes.STRING,
    defaultValue: 'Ninguno'
  },
  evolutionNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'DISCHARGED', 'TRANSFERRED'),
    defaultValue: 'ACTIVE'
  }
}, {
  paranoid: true
});

module.exports = HospitalStay;
