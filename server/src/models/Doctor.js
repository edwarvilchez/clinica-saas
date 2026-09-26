const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Doctor = sequelize.define('Doctor', {
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
  licenseNumber: {
    type: DataTypes.STRING,
    unique: true
  },
  phone: {
    type: DataTypes.STRING
  },
  address: {
    type: DataTypes.TEXT
  },
  specialtyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Specialties', 
      key: 'id'
    }
  },
  additionalSpecialties: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  university: {
    type: DataTypes.STRING,
    allowNull: true
  },
  degreeTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mppsNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  collegeNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  credentialsIssueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  credentialsExpiryDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  chargesProfessionalFees: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  feeType: {
    type: DataTypes.STRING,
    defaultValue: 'PERCENTAGE' // 'PERCENTAGE', 'FIXED_AMOUNT', 'INSURANCE_BAREMO'
  },
  doctorPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 70.00
  },
  fixedFeeUSD: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 30.00
  },
  insuranceDoctorPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 65.00
  },
  insuranceFixedFeeUSD: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 25.00
  },
  acceptsInsurance: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
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
  paranoid: true
});

module.exports = Doctor;
