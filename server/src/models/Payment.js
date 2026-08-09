const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  amountBs: {
    type: DataTypes.DECIMAL(20, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  method: {
    type: DataTypes.STRING,
    defaultValue: 'Cash'
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USD'
  },
  status: {
    type: DataTypes.ENUM('Paid', 'Pending', 'Cancelled'),
    defaultValue: 'Pending'
  },
  reference: {
    type: DataTypes.STRING
  },
  concept: {
    type: DataTypes.STRING
  },
  bank: {
    type: DataTypes.STRING
  },
  instrument: {
    type: DataTypes.STRING
  },
  receiptUrl: {
    type: DataTypes.STRING
  },
  paymentType: {
    type: DataTypes.STRING,
    defaultValue: 'APPOINTMENT' // 'APPOINTMENT', 'SUBSCRIPTION'
  },
  billingCycle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  planType: {
    type: DataTypes.STRING, // 'PROFESSIONAL', 'CLINIC', 'HOSPITAL'
    allowNull: true
  },
  doctorFeePercentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 70.00
  },
  doctorFeeAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  clinicFeeAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  pharmacyDiscount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  reconciliationStatus: {
    type: DataTypes.ENUM('PENDING', 'RECONCILED', 'DISBURSED'),
    defaultValue: 'PENDING'
  },
  organizationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Organizations',
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

module.exports = Payment;
