const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const DoctorFee = sequelize.define('DoctorFee', {
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
  doctorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Doctors',
      key: 'id'
    }
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Patients',
      key: 'id'
    }
  },
  paymentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Payments',
      key: 'id'
    }
  },
  serviceConcept: {
    type: DataTypes.STRING,
    allowNull: false
  },
  serviceType: {
    type: DataTypes.ENUM('CONSULTATION', 'SURGERY', 'PROCEDURE', 'INTERCONSULTATION', 'EMERGENCY_ATTENTION'),
    defaultValue: 'CONSULTATION'
  },
  totalAmountUSD: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  totalAmountVES: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: true
  },
  bcvRate: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true
  },
  doctorPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 70.00
  },
  clinicPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 30.00
  },
  doctorAmountUSD: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  clinicAmountUSD: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  retentionIslrPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 3.00 // SENIAT retention standard for professional fees
  },
  retentionIslrUSD: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  netPayableUSD: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  feeType: {
    type: DataTypes.STRING,
    defaultValue: 'PERCENTAGE'
  },
  insuranceCompanyId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'InsuranceCompanies',
      key: 'id'
    }
  },
  clinicalServiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'ClinicalServices',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'RECONCILED', 'SETTLED', 'PAID', 'CANCELLED'),
    defaultValue: 'PENDING'
  },
  settlementDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  paidAmountUSD: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  paidAmountVES: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: true
  },
  paidPaymentMethod: {
    type: DataTypes.STRING,
    allowNull: true
  },
  receiptNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  receiptToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  paymentReference: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  paranoid: true
});

module.exports = DoctorFee;
